// QA untuk peer rating (komponen peer_rating_norm rumus Experience,
// Blueprint Bagian 08). Menguji pagar anti-gaming langsung ke DATABASE
// sungguhan — bukan meniru logikanya. Data uji dibuat dan dihapus lagi.
// Jalankan:
// npx tsx --env-file=.env scripts/smoke-test-peer-rating.ts
import { prisma } from "../src/lib/prisma";
import {
  computePeerRatingNorm,
  computeExperience,
  MIN_PEER_RATERS,
  PEER_RATING_NEUTRAL,
} from "../src/lib/matching/experience";

const OWNER_ID = "41a68f64-c51f-4510-8e3e-6c6dbb216ade";

let lolos = 0;
let gagal = 0;
function cek(label: string, kondisi: boolean) {
  if (kondisi) {
    console.log(`  ✅ ${label}`);
    lolos++;
  } else {
    console.log(`  ❌ ${label}`);
    gagal++;
  }
}

async function main() {
  // Butuh cukup banyak orang untuk menguji ambang MIN_PEER_RATERS.
  const orang = await prisma.profile.findMany({
    where: { id: { not: OWNER_ID } },
    take: MIN_PEER_RATERS + 1,
    select: { id: true, fullName: true },
  });
  if (orang.length < MIN_PEER_RATERS + 1) {
    throw new Error(`Butuh minimal ${MIN_PEER_RATERS + 1} profil untuk uji ini`);
  }
  const dinilai = orang[0];
  const penilai = orang.slice(1);
  console.log(`Yang dinilai: ${dinilai.fullName} | penilai: ${penilai.length} orang\n`);

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        ownerId: OWNER_ID,
        title: "__smoketest peer-rating",
        goal: "uji peer rating",
        status: "COMPLETED",
        visibility: "PRIVATE",
      },
    });
    await tx.team.create({
      data: {
        projectId: p.id,
        members: {
          create: [
            { profileId: OWNER_ID, role: "Owner" },
            ...orang.map((o) => ({ profileId: o.id, role: "Member" })),
          ],
        },
      },
    });
    return p;
  });
  console.log("Proyek uji dibuat:", project.id);

  try {
    console.log("\n1. Pagar di lapisan DATABASE");
    for (const [label, data] of [
      [
        "nilai di luar rentang (0) ditolak",
        { raterId: penilai[0].id, ratedId: dinilai.id, timeliness: 0, quality: 3, communication: 3 },
      ],
      [
        "nilai di luar rentang (6) ditolak",
        { raterId: penilai[0].id, ratedId: dinilai.id, timeliness: 3, quality: 6, communication: 3 },
      ],
      [
        "menilai diri sendiri ditolak",
        { raterId: dinilai.id, ratedId: dinilai.id, timeliness: 3, quality: 3, communication: 3 },
      ],
    ] as const) {
      let ditolak = false;
      try {
        await prisma.peerRating.create({ data: { projectId: project.id, ...data } });
      } catch {
        ditolak = true;
      }
      cek(label, ditolak);
    }

    console.log("\n2. Satu penilai tidak bisa mengangkat siapa pun sendirian");
    await prisma.peerRating.create({
      data: {
        projectId: project.id,
        raterId: penilai[0].id,
        ratedId: dinilai.id,
        timeliness: 5,
        quality: 5,
        communication: 5,
      },
    });
    let ratings = await prisma.peerRating.findMany({ where: { ratedId: dinilai.id } });
    cek(
      `dengan 1 penilai (ambang ${MIN_PEER_RATERS}) skornya tetap netral`,
      computePeerRatingNorm(ratings) === PEER_RATING_NEUTRAL,
    );

    console.log("\n3. Penilaian ganda dari orang yang sama tidak menambah baris");
    await prisma.peerRating.upsert({
      where: {
        projectId_raterId_ratedId: {
          projectId: project.id,
          raterId: penilai[0].id,
          ratedId: dinilai.id,
        },
      },
      create: {
        projectId: project.id,
        raterId: penilai[0].id,
        ratedId: dinilai.id,
        timeliness: 1,
        quality: 1,
        communication: 1,
      },
      update: { timeliness: 1, quality: 1, communication: 1 },
    });
    ratings = await prisma.peerRating.findMany({ where: { ratedId: dinilai.id } });
    cek("tetap 1 baris setelah menilai ulang (bukan 2)", ratings.length === 1);
    cek("nilainya yang diperbarui", ratings[0].timeliness === 1);

    console.log("\n4. Skor aktif setelah penilai berbeda mencapai ambang");
    for (const p of penilai.slice(1)) {
      await prisma.peerRating.create({
        data: {
          projectId: project.id,
          raterId: p.id,
          ratedId: dinilai.id,
          timeliness: 5,
          quality: 5,
          communication: 5,
        },
      });
    }
    ratings = await prisma.peerRating.findMany({ where: { ratedId: dinilai.id } });
    const norm = computePeerRatingNorm(ratings);
    cek(`penilai berbeda kini ${MIN_PEER_RATERS}`, new Set(ratings.map((r) => r.raterId)).size === MIN_PEER_RATERS);
    cek("skor tidak lagi netral", norm !== PEER_RATING_NEUTRAL);

    console.log("\n5. Berpengaruh ke Experience");
    const dasar = {
      completedProjectsCount: 2,
      completedMilestonesOnTime: 2,
      completedMilestonesTotal: 2,
    };
    const tanpa = computeExperience(dasar)!;
    const dengan = computeExperience({ ...dasar, peerRatingNorm: norm })!;
    console.log(`   Experience tanpa peer rating: ${tanpa.toFixed(3)} -> dengan: ${dengan.toFixed(3)}`);
    cek("angkanya benar-benar berubah", tanpa !== dengan);
  } finally {
    // Bersihkan: peer_ratings ikut terhapus lewat cascade projectId.
    await prisma.project.delete({ where: { id: project.id } });
    console.log("\nData uji dihapus.");
  }

  console.log(`\nHasil: ${lolos} lolos, ${gagal} gagal`);
  if (gagal > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());

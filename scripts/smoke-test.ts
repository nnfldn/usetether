// Skrip QA sementara — bukan bagian dari aplikasi. Membuat data uji minimal,
// menjalankan query yang sama persis dipakai halaman-halaman baru malam ini,
// lalu MENGHAPUS SEMUA data uji di akhir (lihat blok finally). Dijalankan
// manual lewat `npx tsx scripts/smoke-test.ts`.
import { prisma } from "../src/lib/prisma";
import { computeMatch, applyExplorationSlot, type TeamContext } from "../src/lib/matching/score";
import { computeForecast } from "../src/lib/health/score";

const OWNER_ID = "41a68f64-c51f-4510-8e3e-6c6dbb216ade"; // profil Naufal yang sudah ada

async function main() {
  console.log("1. Buat skill katalog...");
  const skillReact = await prisma.skill.upsert({
    where: { name: "__smoketest_react" },
    create: { name: "__smoketest_react" },
    update: {},
  });
  const skillDesign = await prisma.skill.upsert({
    where: { name: "__smoketest_design" },
    create: { name: "__smoketest_design" },
    update: {},
  });

  console.log("2. Buat proyek + requirement + team (createProjectAction path)...");
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        ownerId: OWNER_ID,
        title: "__smoketest project",
        goal: "Validasi query runtime sebelum Naufal bangun.",
        tags: ["web"],
        deadline: new Date(Date.now() + 5 * 86_400_000),
        visibility: "PUBLIC",
        status: "ACTIVE",
      },
    });
    await tx.requirement.create({
      data: { projectId: created.id, skillId: skillReact.id, importance: 0.8 },
    });
    await tx.requirement.create({
      data: { projectId: created.id, skillId: skillDesign.id, importance: 0.5 },
    });
    await tx.team.create({
      data: { projectId: created.id, members: { create: { profileId: OWNER_ID, role: "Owner" } } },
    });
    return created;
  });
  console.log("   OK, projectId =", project.id);

  console.log("3. Query overview page (requirements + memberCount + snapshot + lateMilestone)...");
  const [requirements, memberCount] = await Promise.all([
    prisma.requirement.findMany({ where: { projectId: project.id }, include: { skill: true } }),
    prisma.teamMember.count({ where: { team: { projectId: project.id }, status: "ACTIVE" } }),
  ]);
  console.log("   OK, requirements:", requirements.length, "members:", memberCount);

  console.log("4. Query team page (coverage + candidates + computeMatch)...");
  const activeMembers = await prisma.teamMember.findMany({
    where: { team: { projectId: project.id }, status: "ACTIVE" },
    include: { profile: { include: { skills: true, availability: true } } },
  });
  const coverageBySkill = new Map<string, number>();
  for (const m of activeMembers) {
    for (const ps of m.profile.skills) {
      coverageBySkill.set(ps.skillId, Math.max(coverageBySkill.get(ps.skillId) ?? 0, ps.evidenceLevel));
    }
  }
  const teamContext: TeamContext = {
    requirements: requirements.map((r) => ({ skillId: r.skillId, importance: r.importance })),
    currentCoverage: Array.from(coverageBySkill.entries()).map(([skillId, coverage]) => ({ skillId, coverage })),
    teamAvailability: [],
  };
  const candidateProfiles = await prisma.profile.findMany({
    where: { id: { notIn: activeMembers.map((m) => m.profileId) } },
    include: { skills: true, availability: true },
    take: 5,
  });
  const ranked = applyExplorationSlot(
    candidateProfiles
      .map((p) =>
        computeMatch(
          {
            profileId: p.id,
            skills: p.skills.map((s) => ({ skillId: s.skillId, level: s.evidenceLevel })),
            availability: p.availability.map((a) => ({ dayOfWeek: a.dayOfWeek, block: a.block })),
            interests: p.interests,
          },
          teamContext.requirements,
          project.tags,
          teamContext,
        ),
      )
      .sort((a, b) => b.score - a.score),
  );
  console.log("   OK, kandidat dinilai:", ranked.length);

  console.log("5. Buat milestone + task, selesaikan task (workspace actions path)...");
  const milestone = await prisma.milestone.create({
    data: {
      projectId: project.id,
      ownerId: OWNER_ID,
      title: "__smoketest milestone",
      deadline: new Date(Date.now() + 3 * 86_400_000),
      weight: 3,
    },
  });
  const task = await prisma.task.create({
    data: { milestoneId: milestone.id, title: "__smoketest task", weight: 2 },
  });
  await prisma.task.update({ where: { id: task.id }, data: { status: "DONE" } });
  await prisma.activity.create({
    data: { projectId: project.id, actorId: OWNER_ID, eventType: "TASK_SELESAI", weight: 3 },
  });
  console.log("   OK, milestone:", milestone.id, "task:", task.id);

  console.log("6. Query workspace page (milestones + tasks + members)...");
  const milestonesWithTasks = await prisma.milestone.findMany({
    where: { projectId: project.id },
    include: { tasks: { include: { assignee: true } } },
  });
  console.log("   OK, milestones:", milestonesWithTasks.length, "tasks di milestone pertama:", milestonesWithTasks[0]?.tasks.length);

  console.log("7. Query forecast wiring (cron route path)...");
  const remainingWeightResult = await prisma.task.aggregate({
    where: { status: { not: "DONE" }, milestone: { projectId: project.id } },
    _sum: { weight: true },
  });
  const forecast = computeForecast(remainingWeightResult._sum.weight ?? 0, 5, [3]);
  console.log("   OK, remainingWeight:", remainingWeightResult._sum.weight, "forecast:", forecast);

  console.log("8. Query health dashboard alert inputs (lateMilestone/lastActivity)...");
  const lateMilestone = await prisma.milestone.findFirst({
    where: { projectId: project.id, status: { not: "DONE" }, deadline: { lt: new Date() } },
    orderBy: { deadline: "asc" },
  });
  const lastActivity = await prisma.activity.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
  });
  console.log("   OK, lateMilestone:", lateMilestone?.id ?? null, "lastActivity:", lastActivity?.id ?? null);

  console.log("\nSEMUA QUERY JALAN TANPA ERROR.");
}

main()
  .catch((e) => {
    console.error("SMOKE TEST GAGAL:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    console.log("\nMembersihkan data uji...");
    const project = await prisma.project.findFirst({ where: { title: "__smoketest project" } });
    if (project) {
      await prisma.activity.deleteMany({ where: { projectId: project.id } });
      await prisma.task.deleteMany({ where: { milestone: { projectId: project.id } } });
      await prisma.milestone.deleteMany({ where: { projectId: project.id } });
      await prisma.requirement.deleteMany({ where: { projectId: project.id } });
      await prisma.teamMember.deleteMany({ where: { team: { projectId: project.id } } });
      await prisma.team.deleteMany({ where: { projectId: project.id } });
      await prisma.project.delete({ where: { id: project.id } });
    }
    await prisma.skill.deleteMany({ where: { name: { startsWith: "__smoketest" } } });
    console.log("Data uji sudah dihapus.");
    await prisma.$disconnect();
  });

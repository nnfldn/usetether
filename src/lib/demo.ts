import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "./prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

// Akun demo publik: pengunjung halaman /sign-in bisa masuk sekali klik tanpa
// mengisi form, menjelajah semua fitur, lalu data demo dikembalikan ke kondisi
// awal saat keluar (reset-on-signout) atau saat pengunjung berikutnya masuk
// (reset-on-login). Semua data demo ditandai tag "demo-live" supaya tidak
// bercampur dengan proyek seed biasa ("seed-demo") dan tidak ikut terhapus
// saat `pnpm seed` dijalankan ulang.
export const DEMO_EMAIL = "demo@tether.test";
export const DEMO_PASSWORD = "admin123";
// Penanda profil demo. Profile.id === auth.users.id (trigger Supabase) dan
// email tidak tersimpan di tabel profiles, jadi nama profil ini yang dipakai
// untuk menemukan akun demo tanpa enumeration lewat Admin API.
const DEMO_PROFILE_NAME = "Pengunjung Demo";
const DEMO_TAG = "demo-live";

const DAY_MS = 24 * 60 * 60 * 1000;
const future = (days: number) => new Date(Date.now() + days * DAY_MS);
const ago = (days: number) => new Date(Date.now() - days * DAY_MS);

export function isDemoEmail(email: string | undefined | null): boolean {
  return email?.toLowerCase() === DEMO_EMAIL;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const DEMO_PROFILE_FIELDS = {
  fullName: DEMO_PROFILE_NAME,
  faculty: "Universitas Tether",
  interests: ["web", "data", "mobile"],
};

// Menemukan id akun demo lewat baris profilnya, tanpa menyentuh Supabase.
async function findDemoId(): Promise<string | null> {
  const profile = await prisma.profile.findFirst({
    where: { fullName: DEMO_PROFILE_NAME },
    select: { id: true, faculty: true, interests: true },
  });
  if (!profile) return null;
  // Lewati UPDATE kalau isinya sudah sama — jalur cepat yang dipakai hampir
  // setiap reset jadi tidak perlu satu round trip hanya untuk menulis ulang
  // data yang memang tidak berubah.
  const same =
    profile.faculty === DEMO_PROFILE_FIELDS.faculty &&
    profile.interests.length === DEMO_PROFILE_FIELDS.interests.length &&
    DEMO_PROFILE_FIELDS.interests.every((i) => profile.interests.includes(i));
  if (!same) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: DEMO_PROFILE_FIELDS,
    });
  }
  return profile.id;
}

async function createDemoAccount(): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: DEMO_PROFILE_NAME },
  });
  if (error || !data.user)
    throw new Error(`Gagal membuat akun demo: ${error?.message}`);
  await prisma.profile.update({
    where: { id: data.user.id },
    data: DEMO_PROFILE_FIELDS,
  });
  return data.user.id;
}

type DemoPeople = ReturnType<typeof buildDemoPeople>;

type DemoInputs = {
  skills: { id: string; name: string }[];
  profiles: { id: string }[];
};

// Sengaja memakai profil yang sama di beberapa proyek (a,b,c ada di dua
// proyek) supaya proyek tidak terlihat seperti silet, dan fitur yang menghitung
// pengalaman lintas proyek punya sesuatu untuk dihitung.
function buildDemoPeople({ skills, profiles }: DemoInputs) {
  const skillId = (name: string) => {
    const found = skills.find((s) => s.name === name);
    if (!found)
      throw new Error(`Skill "${name}" tidak ada — jalankan pnpm seed`);
    return found.id;
  };
  if (profiles.length === 0) {
    throw new Error("Demo butuh minimal satu profil lain — jalankan pnpm seed");
  }
  const person = (n: number) => profiles[n % profiles.length].id;
  return { skillId, person };
}

// Empat proyek, sengaja tidak seragam: dua milik pengunjung sendiri dan dua
// dia hanya anggota di proyek orang lain. Alasannya fitur tidak bisa dicoba dari
// proyek yang semua bentuknya sama — kendali owner hanya muncul kalau DIA yang
// pemilik, penilaian rekan hanya kalau proyek selesai dan timnya cukup besar,
// dan proyek yang baru dibuat tampilannya jauh lebih kosong daripada proyek yang
// sudah berjalan. Satu proyek yang kelihatan rapi justru membuat sebagian
// besar menu di aplikasi tidak bisa dicoba penghuni.
async function seedDemoProjects(
  db: PrismaClient | Prisma.TransactionClient,
  demoId: string,
  { skillId, person }: DemoPeople,
): Promise<void> {
  const [a, b, c, d, e, f, g, h, i, j, k] = Array.from({ length: 11 }, (_, n) =>
    person(n),
  );
  const uuid = () => randomUUID();
  const now = new Date();

  // Semua baris dikumpulkan per tingkat foreign key lalu ditulis dengan
  // createMany. Sebelumnya tiap proyek di-nest, dan satu nested create
  // ternyata memecah diri jadi 15 statement terpisah (terukur lewat query log)
  // — 4 proyek x 15 = sekitar 52 putaran database. Dengan id yang di-generate
  // sendiri, seluruh isi demo cukup 3 putaran.
  const projects: Prisma.ProjectCreateManyInput[] = [];
  const requirements: Prisma.RequirementCreateManyInput[] = [];
  const teams: Prisma.TeamCreateManyInput[] = [];
  const members: Prisma.TeamMemberCreateManyInput[] = [];
  const milestones: Prisma.MilestoneCreateManyInput[] = [];
  const tasks: Prisma.TaskCreateManyInput[] = [];
  const posts: Prisma.DiscussionPostCreateManyInput[] = [];
  const replies: Prisma.DiscussionReplyCreateManyInput[] = [];
  const updates: Prisma.ProgressUpdateCreateManyInput[] = [];
  const activities: Prisma.ActivityCreateManyInput[] = [];
  const invitations: Prisma.TeamInvitationCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];

  const team = (projectId: string, list: [string, string, Date][]) => {
    const id = uuid();
    teams.push({ id, projectId, createdAt: now });
    for (const [profileId, role, joinedAt] of list) {
      members.push({
        id: uuid(),
        teamId: id,
        profileId,
        role,
        status: "ACTIVE",
        joinedAt,
      });
    }
  };

  const milestone = (
    projectId: string,
    ownerId: string,
    title: string,
    deadline: Date,
    weight: number,
    status: "TODO" | "IN_PROGRESS" | "DONE" | "LATE",
  ) => {
    const id = uuid();
    milestones.push({
      id,
      projectId,
      ownerId,
      title,
      deadline,
      status,
      weight,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  };

  const task = (
    milestoneId: string,
    title: string,
    weight: number,
    status: "TODO" | "IN_PROGRESS" | "PENDING_CONFIRM" | "DONE",
    assigneeId?: string,
    priority?: "LOW" | "MEDIUM" | "HIGH",
  ) => {
    tasks.push({
      id: uuid(),
      milestoneId,
      title,
      weight,
      status,
      priority: priority ?? "MEDIUM",
      assigneeId,
      createdAt: now,
      updatedAt: now,
    });
  };

  // 1. Punyainya, proyek yang sudah berjalan lama — semua fitur owner terpakai
  // di sini: kelola tim, konfirmasi task, dua arah undangan, sampai penilaian.
  const p1 = uuid();
  projects.push({
    id: p1,
    ownerId: demoId,
    title: "Proyek Demo: Platform Pendataan Kegiatan Kampus",
    goal: "Aplikasi web untuk mendata dan mempublikasikan kegiatan mahasiswa lintas jurusan, dari pengajuan sampai laporan akhir.",
    tags: [DEMO_TAG, "web", "data"],
    deadline: future(25),
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  for (const [name, importance] of [
    ["Next.js", 0.8],
    ["UX Research", 0.5],
    ["Data Analysis", 0.6],
  ] as [string, number][]) {
    requirements.push({
      id: uuid(),
      projectId: p1,
      skillId: skillId(name),
      importance,
    });
  }
  team(p1, [
    [demoId, "Owner", ago(20)],
    [a, "Member", ago(15)],
    [b, "Member", ago(14)],
    [c, "Member", ago(12)],
  ]);
  const riset = milestone(
    p1,
    demoId,
    "Riset & Desain Solusi",
    future(5),
    3,
    "IN_PROGRESS",
  );
  const rilis = milestone(
    p1,
    demoId,
    "Implementasi & Rilis",
    future(20),
    4,
    "TODO",
  );
  task(riset, "Wawancara pengguna mahasiswa", 1, "DONE", a, "HIGH");
  task(riset, "Wireframe halaman utama", 2, "PENDING_CONFIRM", b);
  task(riset, "Rancangan basis data kegiatan", 1, "DONE", c);
  task(rilis, "Setup basis data kegiatan", 2, "TODO");
  task(rilis, "Uji coba ke user uji", 1, "TODO", undefined, "LOW");
  const post1 = uuid();
  posts.push({
    id: post1,
    projectId: p1,
    authorId: demoId,
    body: "Hasil wawancara sudah dirangkum, silakan dicek di Ruang Kerja.",
    createdAt: ago(3),
    updatedAt: ago(3),
  });
  for (const [authorId, body, createdAt] of [
    [a, "Siap, lanjut ke wireframe minggu ini.", ago(2)],
    [c, "Rancangan basis datanya sudah saya unggah di dokumen proyek.", ago(2)],
  ] as [string, string, Date][]) {
    replies.push({
      id: uuid(),
      postId: post1,
      authorId,
      body,
      createdAt,
      updatedAt: createdAt,
    });
  }
  for (const [authorId, body, createdAt] of [
    [b, "Wireframe halaman utama selesai, menunggu konfirmasi owner.", ago(1)],
    [
      c,
      "Skema tabel kegiatan sudah final, tidak ada relasi many-to-many yang perlu dipisah.",
      ago(6),
    ],
  ] as [string, string, Date][]) {
    updates.push({ id: uuid(), projectId: p1, authorId, body, createdAt });
  }
  for (const [actorId, eventType, weight, createdAt] of [
    [a, "TASK_SELESAI", 3, ago(4)],
    [c, "TASK_SELESAI", 3, ago(6)],
    [b, "PROGRESS_UPDATE", 2, ago(1)],
    [demoId, "DISKUSI_BERMAKNA", 1, ago(3)],
  ] as [
    string,
    "TASK_SELESAI" | "PROGRESS_UPDATE" | "DISKUSI_BERMAKNA",
    number,
    Date,
  ][]) {
    activities.push({
      id: uuid(),
      projectId: p1,
      actorId,
      eventType,
      weight,
      createdAt,
    });
  }
  // Dua arah sekaligus supaya penghuni bisa mencoba keduanya: ada yang melamar
  // ke dia, ada yang diaundang dan masih nunggu balasan.
  invitations.push(
    {
      id: uuid(),
      projectId: p1,
      profileId: d,
      direction: "CANDIDATE_APPLIED",
      status: "PENDING",
      createdAt: ago(2),
    },
    {
      id: uuid(),
      projectId: p1,
      profileId: e,
      direction: "OWNER_INVITED",
      status: "PENDING",
      createdAt: ago(1),
    },
  );
  notifications.push({
    id: uuid(),
    profileId: demoId,
    type: "INVITATION",
    message:
      "Kandidat melamar ke Proyek Demo: Platform Pendataan Kegiatan Kampus.",
    projectId: p1,
    createdAt: ago(2),
  });

  // 2. Punyainya juga, tapi baru dibuat: belum ada tim, belum ada milestone.
  // Ini yang memperlihatkan keadaan kosong yang tidak pernah terlihat kalau
  // semua proyek demo sudah jadi.
  const p2 = uuid();
  projects.push({
    id: p2,
    ownerId: demoId,
    title: "Proyek Demo: Portal Lowongan Magang Koordinator",
    goal: "Papan lowongan magang untuk mahasiswa, dengan alur verifikasi perusahaan dan batas kuota per lokasi.",
    tags: [DEMO_TAG, "web"],
    deadline: future(60),
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  });
  for (const [name, importance] of [
    ["UI Design", 0.9],
    ["Copywriting", 0.4],
  ] as [string, number][]) {
    requirements.push({
      id: uuid(),
      projectId: p2,
      skillId: skillId(name),
      importance,
    });
  }
  team(p2, [[demoId, "Owner", ago(3)]]);
  invitations.push({
    id: uuid(),
    projectId: p2,
    profileId: f,
    direction: "OWNER_INVITED",
    status: "PENDING",
    createdAt: ago(1),
  });
  notifications.push({
    id: uuid(),
    profileId: demoId,
    type: "INVITATION",
    message:
      "Undanganmu ke Proyek Demo: Portal Lowongan Magang Koordinator masih menunggu balasan.",
    projectId: p2,
    createdAt: ago(1),
  });

  // 3. Bukan miliknya — dia anggota di proyek orang lain. Di sini dia tidak
  // punya kendali owner: task yang ia kerjakan tidak bisa ia konfirmasi sendiri,
  // dan ada satu milestone yang sudah lewat tenggat tanpa ada yang
  // menindaklanjuti.
  const p3 = uuid();
  projects.push({
    id: p3,
    ownerId: g,
    title: "Proyek Demo: Sistem Absensi Sidang Skripsi",
    goal: "Sesi daring untuk absensi dan penilaian sidang skripsi, terhubung ke sistem akademik fakultas.",
    tags: [DEMO_TAG, "data", "mobile"],
    deadline: future(14),
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  for (const [name, importance] of [
    ["Python", 0.7],
    ["Data Visualization", 0.5],
  ] as [string, number][]) {
    requirements.push({
      id: uuid(),
      projectId: p3,
      skillId: skillId(name),
      importance,
    });
  }
  team(p3, [
    [g, "Owner", ago(30)],
    [h, "Member", ago(28)],
    [i, "Member", ago(20)],
    [demoId, "Member", ago(12)],
    [j, "Member", ago(9)],
  ]);
  const persiapan = milestone(p3, g, "Persiapan Sidang", ago(12), 3, "DONE");
  const sesi = milestone(
    p3,
    g,
    "Implementasi Sesi Sidang",
    future(3),
    4,
    "IN_PROGRESS",
  );
  const rekap = milestone(p3, g, "Pelaporan Hasil Sidang", ago(2), 2, "LATE");
  task(persiapan, "Daftar sesi & penguji", 1, "DONE", h);
  task(persiapan, "Template berita acara", 1, "DONE", i);
  task(sesi, "Form penilaian daring", 2, "IN_PROGRESS", demoId, "HIGH");
  task(sesi, "Integrasi mesin sidik jari", 2, "PENDING_CONFIRM", h);
  task(sesi, "Uji beban saat puncak jam sidang", 1, "TODO", j, "LOW");
  task(rekap, "Rekap nilai otomatis", 1, "TODO");
  const post3 = uuid();
  posts.push({
    id: post3,
    projectId: p3,
    authorId: g,
    body: "Penguji fakultas minta sesi pertama bisa dicoba minggu ini, mohon diprioritaskan form penilaiannya.",
    createdAt: ago(5),
    updatedAt: ago(5),
  });
  for (const [authorId, body, createdAt] of [
    [
      demoId,
      "Form-nya sudah setengah jalan, butuh satu hari lagi untuk integrasi ke sistem akademik.",
      ago(4),
    ],
    [
      h,
      "Mesin sidik jarinya sudah dites dua unit, tinggal keputusan integrasinya kita ambil bareng.",
      ago(3),
    ],
  ] as [string, string, Date][]) {
    replies.push({
      id: uuid(),
      postId: post3,
      authorId,
      body,
      createdAt,
      updatedAt: createdAt,
    });
  }
  for (const [authorId, body, createdAt] of [
    [
      h,
      "Integrasi mesin sudah diuji di ruang lab, sidik jarinya terbaca normal.",
      ago(2),
    ],
    [
      demoId,
      "Form penilaian daring selesai 60%, endpoint untuk simpan nilai sudah siap.",
      ago(1),
    ],
  ] as [string, string, Date][]) {
    updates.push({ id: uuid(), projectId: p3, authorId, body, createdAt });
  }
  for (const [actorId, eventType, weight, createdAt] of [
    [g, "MILESTONE_SELESAI", 5, ago(12)],
    [h, "TASK_SELESAI", 3, ago(7)],
    [demoId, "PROGRESS_UPDATE", 2, ago(1)],
  ] as [
    string,
    "MILESTONE_SELESAI" | "TASK_SELESAI" | "PROGRESS_UPDATE",
    number,
    Date,
  ][]) {
    activities.push({
      id: uuid(),
      projectId: p3,
      actorId,
      eventType,
      weight,
      createdAt,
    });
  }
  // Milik owner proyek orang lain, jadi tab Tim memperlihatkan antrean yang
  // tombolnya memang tidak boleh bisa ia tekan.
  invitations.push({
    id: uuid(),
    projectId: p3,
    profileId: k,
    direction: "CANDIDATE_APPLIED",
    status: "PENDING",
    createdAt: ago(2),
  });
  notifications.push({
    id: uuid(),
    profileId: demoId,
    type: "MILESTONE_DEADLINE",
    message: 'Milestone "Implementasi Sesi Sidang" tinggal 3 hari lagi.',
    projectId: p3,
    createdAt: now,
  });

  // 4. Bukan miliknya dan sudah selesai tiga minggu lalu. Satu-satunya tempat
  // fitur penilaian rekan muncul — butuh tiga rekan lain yang masih aktif di
  // tim, jadi ukuran timnya tidak boleh dipangkas.
  const p4 = uuid();
  projects.push({
    id: p4,
    ownerId: a,
    title: "Proyek Demo: Marketplace Buku Bekas (Selesai)",
    goal: "Marketplace buku bekas antar mahasiswa, dengan garansi kondisi buku sampai barang diterima.",
    tags: [DEMO_TAG, "web"],
    deadline: ago(21),
    status: "COMPLETED",
    createdAt: ago(50),
    updatedAt: now,
  });
  for (const [name, importance] of [
    ["React", 0.8],
    ["TypeScript", 0.6],
  ] as [string, number][]) {
    requirements.push({
      id: uuid(),
      projectId: p4,
      skillId: skillId(name),
      importance,
    });
  }
  team(p4, [
    [a, "Owner", ago(50)],
    [b, "Member", ago(48)],
    [c, "Member", ago(40)],
    [demoId, "Member", ago(45)],
  ]);
  const ril = milestone(p4, a, "Rilis & Serah Terima", ago(22), 3, "DONE");
  task(ril, "Onboarding penjual buku", 2, "DONE", b);
  task(ril, "Halaman detail buku", 2, "DONE", demoId);
  updates.push({
    id: uuid(),
    projectId: p4,
    authorId: b,
    body: "Serah terima selesai, dokumentasinya sudah diunggah ke repository bersama.",
    createdAt: ago(25),
  });
  for (const [actorId, eventType, weight, createdAt] of [
    [a, "MILESTONE_SELESAI", 5, ago(22)],
    [demoId, "TASK_SELESAI", 3, ago(28)],
    [b, "TASK_SELESAI", 3, ago(30)],
  ] as [string, "MILESTONE_SELESAI" | "TASK_SELESAI", number, Date][]) {
    activities.push({
      id: uuid(),
      projectId: p4,
      actorId,
      eventType,
      weight,
      createdAt,
    });
  }

  // Tiga putaran tulis sesuai kedalaman foreign key. Baris kosong dilewati
  // supaya tidak membuang statement database untuk tabel yang memang tidak
  // dipakai proyek mana pun (mis. proyek draf tanpa milestone).
  const write = <T>(rows: T[], insert: (data: T[]) => Promise<unknown>) =>
    rows.length > 0 ? insert(rows) : Promise.resolve();

  await db.project.createMany({ data: projects });
  await Promise.all([
    write(requirements, (d) => db.requirement.createMany({ data: d })),
    write(teams, (d) => db.team.createMany({ data: d })),
    write(milestones, (d) => db.milestone.createMany({ data: d })),
    write(posts, (d) => db.discussionPost.createMany({ data: d })),
    write(updates, (d) => db.progressUpdate.createMany({ data: d })),
    write(activities, (d) => db.activity.createMany({ data: d })),
    write(invitations, (d) => db.teamInvitation.createMany({ data: d })),
    write(notifications, (d) => db.notification.createMany({ data: d })),
  ]);
  await Promise.all([
    write(members, (d) => db.teamMember.createMany({ data: d })),
    write(tasks, (d) => db.task.createMany({ data: d })),
    write(replies, (d) => db.discussionReply.createMany({ data: d })),
  ]);
}

export async function seedDemoData(): Promise<void> {
  // Tiap antrean database lewat pooler bisa beberapa ratus milidetik, jadi
  // semua yang tidak saling bergantung dimasukkan ke putaran yang sama.
  // Akun demo boleh dicari atau dibuat bersamaan: hasilnya baru dipakai
  // setelah putaran selesai.
  const demoId = (async () =>
    (await findDemoId()) ?? (await createDemoAccount()))();
  const [skills, profiles, , demo] = await Promise.all([
    prisma.skill.findMany({
      where: { category: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.profile.findMany({
      where: { skills: { some: {} } },
      orderBy: { createdAt: "asc" },
      take: 12,
      select: { id: true },
    }),
    prisma.project.deleteMany({ where: { tags: { has: DEMO_TAG } } }),
    demoId,
  ]);
  const people = buildDemoPeople({
    skills,
    profiles: profiles.filter((p) => p.id !== demo),
  });

  // Jejak pengunjung di proyek milik orang lain (melamar atau menilai rekan
  // di luar proyek demo) ikut berjalan di luar giliran tulis. Undangan milik
  // pengunjung pada proyek demo dikecualikan supaya baris yang baru dibuat
  // tidak ikut tersapu — bergantian atau tidak, hasilnya sama.
  const traces = Promise.all([
    prisma.teamInvitation.deleteMany({
      where: { profileId: demo, NOT: { project: { tags: { has: DEMO_TAG } } } },
    }),
    prisma.peerRating.deleteMany({ where: { raterId: demo } }),
  ]);
  await Promise.all([seedDemoProjects(prisma, demo, people), traces]);
}

// Seed tunggal untuk SELURUH data demo Tether — katalog skill, 100 akun
// kandidat uji terfragmentasi secara realistis dan variatif (bukan flat),
// serta 50 proyek skenario (5 flagship + 45 proyek kampus lintas bidang)
// yang menguji seluruh alur Discovery, Work Grid, Matching, dan Health.
//
// Jalankan: pnpm seed   (atau: npx tsx --env-file=.env prisma/seed.ts)
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../src/lib/prisma";
import {
  computePulse,
  computeMomentum,
  computeBalance,
  computeForecast,
  composeHealth,
} from "../src/lib/health/score";
import type { ActivityEventType } from "../src/generated/prisma/client";
import { wibCalendarDate } from "../src/lib/date";

// Akun owner utama (bisa dialihkan via SEED_OWNER_ID untuk pengujian)
const OWNER_ID = process.env.SEED_OWNER_ID ?? "41a68f64-c51f-4510-8e3e-6c6dbb216ade";

const SEED_FLAGSHIP_TITLES = {
  healthy: "Peta Ruang Terbuka Hijau Kampus",
  struggling: "Sistem Antrian Klinik Kampus",
  dormant: "Komunitas Riset Iklim Kampus",
  completed: "Aplikasi Booking Ruang Belajar",
  draft: "Newsletter Riset Mahasiswa Lintas Jurusan",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}
function midnightDaysAgo(n: number): Date {
  return wibCalendarDate(daysAgo(n));
}

// =====================================================================
// 1. KATALOG SKILL LENGKAP (31 SKILL)
// =====================================================================
const SKILLS: { name: string; category: string }[] = [
  { name: "React", category: "Pengembangan" },
  { name: "Next.js", category: "Pengembangan" },
  { name: "TypeScript", category: "Pengembangan" },
  { name: "Node.js", category: "Pengembangan" },
  { name: "Flutter", category: "Pengembangan" },
  { name: "Python", category: "Pengembangan" },
  { name: "Backend API", category: "Pengembangan" },
  { name: "Database/SQL", category: "Pengembangan" },
  { name: "DevOps/Deployment", category: "Pengembangan" },
  { name: "UI Design", category: "Desain" },
  { name: "UX Research", category: "Desain" },
  { name: "Figma", category: "Desain" },
  { name: "Branding/Visual", category: "Desain" },
  { name: "Motion/Video", category: "Desain" },
  { name: "Data Analysis", category: "Data & AI" },
  { name: "Machine Learning", category: "Data & AI" },
  { name: "Data Visualization", category: "Data & AI" },
  { name: "Product Management", category: "Produk & Bisnis" },
  { name: "Business Model", category: "Produk & Bisnis" },
  { name: "Pitching/Presentasi", category: "Produk & Bisnis" },
  { name: "Market Research", category: "Produk & Bisnis" },
  { name: "Financial Modeling", category: "Produk & Bisnis" },
  { name: "Riset Ilmiah", category: "Riset & Operasional" },
  { name: "Penulisan Akademik", category: "Riset & Operasional" },
  { name: "Manajemen Proyek", category: "Riset & Operasional" },
  { name: "Analisis Kebijakan", category: "Riset & Operasional" },
  { name: "Kesehatan Masyarakat", category: "Riset & Operasional" },
  { name: "Copywriting", category: "Komunikasi & Konten" },
  { name: "Media Sosial", category: "Komunikasi & Konten" },
  { name: "Fotografi/Videografi", category: "Komunikasi & Konten" },
  { name: "Public Speaking", category: "Komunikasi & Konten" },
];

async function seedSkills(): Promise<Map<string, string>> {
  console.log(`1. Katalog skill (${SKILLS.length})...`);
  for (const s of SKILLS) {
    await prisma.skill.upsert({ where: { name: s.name }, create: s, update: { category: s.category } });
  }
  const all = await prisma.skill.findMany();
  return new Map(all.map((s) => [s.name, s.id]));
}

// =====================================================================
// 2. 100 KANDIDAT UJI
// =====================================================================
const TARGET_CANDIDATES = 100;
const CANDIDATE_PASSWORD = "admin123";

const FIRST_NAMES = [
  "Alya", "Bima", "Citra", "Dimas", "Eka", "Fajar", "Gita", "Hana", "Ivan", "Jihan",
  "Kevin", "Laras", "Made", "Nadia", "Oscar", "Putri", "Qori", "Rafi", "Sinta", "Tegar",
  "Umar", "Vina", "Wahyu", "Xena", "Yusuf", "Zahra", "Andra", "Bella", "Chandra", "Dian",
  "Elang", "Farah", "Galih", "Hesti", "Ilham", "Julia", "Krisna", "Lestari", "Miko", "Naila",
  "Aditya", "Anindya", "Bagus", "Bayu", "Cantika", "Daniswara", "Devi", "Fauzan", "Gibran", "Gilang",
  "Hanif", "Indah", "Kalingga", "Kusuma", "Mahendra", "Maulana", "Naufal", "Nugraha", "Pandu", "Pranata",
  "Raden", "Rangga", "Reza", "Rian", "Rizky", "Satria", "Surya", "Syifa", "Tiara", "Vino",
  "Widya", "Wira", "Yolanda", "Yudha", "Zikri", "Aldo", "Bagas", "Cahya", "Daffa", "Erlangga",
  "Salma", "Rahmat", "Annisa", "Fikri", "Aurelia", "Taufik", "Nanda", "Reyhan", "Amalia", "Faris",
];

const LAST_NAMES = [
  "Pratama", "Saputra", "Dewi", "Aditya", "Nuraini", "Wijaya", "Kusuma", "Ramadhan", "Anggraini",
  "Setiawan", "Permata", "Hakim", "Utami", "Nugroho", "Salsabila", "Firmansyah", "Maharani",
  "Kurniawan", "Puspita", "Iskandar", "Wardani", "Prasetyo", "Handayani", "Gunawan", "Safitri",
  "Siregar", "Nasution", "Hutapea", "Simanjuntak", "Situmorang", "Wicaksono", "Wibowo", "Sutanto",
  "Tanjung", "Chaniago", "Piliang", "Ginting", "Tarigan", "Wahyudi", "Hermawan", "Subagyo",
  "Suhendra", "Sudrajat", "Kosasih", "Dananjaya", "Pangestu", "Suryanegara", "Baskoro", "Wiryawan",
  "Lubis", "Pasaribu", "Pohan", "Rangkuti", "Daulay", "Harahap", "Sumbayak", "Munthe", "Saragih",
];

const FACULTIES = [
  "Teknik Informatika", "Ilmu Komputer", "Sistem Informasi", "Desain Komunikasi Visual",
  "Manajemen", "Kedokteran", "Kesehatan Masyarakat", "Teknik Elektro", "Ilmu Komunikasi",
  "Akuntansi", "Hubungan Internasional", "Arsitektur", "Psikologi", "Statistika",
  "Teknik Industri", "Teknik Biomedis", "Bisnis Digital", "Ilmu Lingkungan", "Sains Data",
];

const BLOCKS = ["PAGI", "SIANG", "SORE", "MALAM"] as const;

const PERSONAS = [
  {
    type: "Frontend & UI Specialist",
    coreSkills: ["React", "Next.js", "TypeScript", "UI Design", "Figma"],
    interestCluster: ["web", "design", "ux"],
    scheduleType: "NIGHT_OWL",
    skillCountMin: 3,
    skillCountMax: 5,
    bioTemplates: [
      "Frontend developer dengan fokus pada performa web, interaktivitas, dan kepatuhan aksesibilitas.",
      "Suka merancang antarmuka modern dengan React, Next.js, dan Tailwind CSS. Tertarik pada micro-interaction.",
      "Menggabungkan kepekaan estetika desain UI dengan clean code architecture di sisi frontend.",
    ],
  },
  {
    type: "Backend & Systems Engineer",
    coreSkills: ["Node.js", "Backend API", "Database/SQL", "DevOps/Deployment", "Python"],
    interestCluster: ["web", "data", "iot"],
    scheduleType: "WEEKDAY_EVENING",
    skillCountMin: 3,
    skillCountMax: 5,
    bioTemplates: [
      "Backend engineer fokus pada API architecture, database optimization, dan integrasi cloud services.",
      "Suka membangun sistem backend yang tahan banting, concurrency tinggi, dan clean database schema.",
      "Eksplorasi infrastruktur cloud, Docker containerization, dan relational database modeling.",
    ],
  },
  {
    type: "Fullstack Product Builder",
    coreSkills: ["React", "TypeScript", "Node.js", "Backend API", "Product Management"],
    interestCluster: ["web", "business", "fintech"],
    scheduleType: "BALANCED",
    skillCountMin: 3,
    skillCountMax: 5,
    bioTemplates: [
      "Fullstack developer yang suka mengubah ide mentah menjadi prototipe fungsional siap rilis.",
      "Generalist builder: nyaman bekerja dari database layer hingga komponen UI interaktif.",
      "Fokus pada rapid prototyping dan integrasi end-to-end aplikasi web modern.",
    ],
  },
  {
    type: "Mobile App Developer",
    coreSkills: ["Flutter", "TypeScript", "Backend API", "UI Design", "Figma"],
    interestCluster: ["mobile", "design", "ux"],
    scheduleType: "WEEKEND_WARRIOR",
    skillCountMin: 2,
    skillCountMax: 4,
    bioTemplates: [
      "Mobile engineer dengan spesialisasi Flutter cross-platform untuk Android dan iOS.",
      "Tertarik pada arsitektur mobile yang responsif, offline-first sync, dan pengalaman pengguna mulus.",
    ],
  },
  {
    type: "Data Scientist & AI Researcher",
    coreSkills: ["Python", "Machine Learning", "Data Analysis", "Data Visualization", "Riset Ilmiah"],
    interestCluster: ["ai", "data", "climate"],
    scheduleType: "FLEXIBLE_DAY",
    skillCountMin: 3,
    skillCountMax: 5,
    bioTemplates: [
      "Mahasiswa sains data yang fokus pada pemodelan prediktif machine learning dan analisis data spasial.",
      "Suka membedah dataset besar untuk menemukan insight tersembunyi menggunakan Python dan pandas.",
      "Riset kecerdasan buatan terapan untuk isu keberlanjutan dan kesehatan lingkungan.",
    ],
  },
  {
    type: "Data Analyst & Business Intelligence",
    coreSkills: ["Data Analysis", "Data Visualization", "Database/SQL", "Financial Modeling"],
    interestCluster: ["data", "business", "fintech"],
    scheduleType: "BALANCED",
    skillCountMin: 2,
    skillCountMax: 4,
    bioTemplates: [
      "Menganalisis metrik bisnis dan membuat visualisasi data interaktif untuk pengambilan keputusan.",
      "Fokus pada SQL complex query, data modeling, dan dashboard visual analitik.",
    ],
  },
  {
    type: "Product Manager & Strategist",
    coreSkills: ["Product Management", "Business Model", "Pitching/Presentasi", "Market Research", "Manajemen Proyek"],
    interestCluster: ["business", "social-impact", "education"],
    scheduleType: "WEEKDAY_EVENING",
    skillCountMin: 3,
    skillCountMax: 5,
    bioTemplates: [
      "Menghubungkan kebutuhan pengguna, kelayakan teknis, dan strategi keberlanjutan produk tim.",
      "Fasilitator kolaborasi tim, penyusun roadmap prioritas fitur, dan presentasi dampak solusi.",
    ],
  },
  {
    type: "UX Researcher & Design Thinker",
    coreSkills: ["UX Research", "Figma", "UI Design", "Market Research", "Riset Ilmiah"],
    interestCluster: ["design", "ux", "social-impact"],
    scheduleType: "FLEXIBLE_DAY",
    skillCountMin: 2,
    skillCountMax: 4,
    bioTemplates: [
      "Melakukan riset kualitatif, user interview, dan usability testing untuk memvalidasi masalah nyata.",
      "Desainer UX yang mendasarkan keputusan interface pada data riset perilaku pengguna nyata.",
    ],
  },
  {
    type: "Creative Media & Visual Designer",
    coreSkills: ["Branding/Visual", "Motion/Video", "Fotografi/Videografi", "UI Design", "Media Sosial"],
    interestCluster: ["design", "education", "social-impact"],
    scheduleType: "WEEKEND_WARRIOR",
    skillCountMin: 3,
    skillCountMax: 4,
    bioTemplates: [
      "Kreator visual fokus pada identitas brand, motion graphics, dan penceritaan narasi digital.",
      "Menyusun aset visual konsisten untuk mendukung komunikasi produk dan kampanye proyek.",
    ],
  },
  {
    type: "Academic & Policy Researcher",
    coreSkills: ["Riset Ilmiah", "Penulisan Akademik", "Analisis Kebijakan", "Data Analysis"],
    interestCluster: ["social-impact", "climate", "education"],
    scheduleType: "FLEXIBLE_DAY",
    skillCountMin: 3,
    skillCountMax: 4,
    bioTemplates: [
      "Peneliti akademik dengan minat pada studi kebijakan publik, keberlanjutan kampus, dan tata kelola.",
      "Berpengalaman dalam telaah pustaka ilmiah, metodologi riset campuran, dan penulisan laporan teknis.",
    ],
  },
  {
    type: "Health Informatics & Community",
    coreSkills: ["Kesehatan Masyarakat", "Riset Ilmiah", "Data Analysis", "Manajemen Proyek"],
    interestCluster: ["health", "sustainability", "social-impact"],
    scheduleType: "BALANCED",
    skillCountMin: 2,
    skillCountMax: 4,
    bioTemplates: [
      "Menghubungkan data epidemiologi dan kesehatan komunitas dengan solusi teknologi aksesibel.",
      "Fokus pada efisiensi layanan antrian kesehatan kampus dan advokasi kesehatan preventif.",
    ],
  },
  {
    type: "Growth Hacker & Content Lead",
    coreSkills: ["Copywriting", "Media Sosial", "Public Speaking", "Market Research"],
    interestCluster: ["business", "education", "social-impact"],
    scheduleType: "FLEXIBLE_DAY",
    skillCountMin: 2,
    skillCountMax: 4,
    bioTemplates: [
      "Mengembangkan strategi komunikasi produk, copywriting persuasif, dan keterlibatan komunitas pengguna.",
      "Spesialis pertumbuhan organik, storytelling produk digital, dan presentasi publik.",
    ],
  },
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: readonly T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function generateAvailability(scheduleType: string) {
  const slots: { dayOfWeek: number; block: (typeof BLOCKS)[number] }[] = [];

  if (scheduleType === "NIGHT_OWL") {
    const days = [1, 2, 3, 4, 5, 6];
    for (const d of pickN(days, 2 + Math.floor(Math.random() * 3))) {
      slots.push({ dayOfWeek: d, block: "MALAM" });
      if (Math.random() < 0.45) slots.push({ dayOfWeek: d, block: "SORE" });
    }
  } else if (scheduleType === "WEEKEND_WARRIOR") {
    for (const b of pickN(["PAGI", "SIANG", "SORE", "MALAM"] as const, 2 + Math.floor(Math.random() * 2))) {
      slots.push({ dayOfWeek: 6, block: b });
    }
    for (const b of pickN(["SIANG", "SORE", "MALAM"] as const, 1 + Math.floor(Math.random() * 2))) {
      slots.push({ dayOfWeek: 0, block: b });
    }
  } else if (scheduleType === "FLEXIBLE_DAY") {
    const days = [1, 2, 3, 4, 5];
    for (const d of pickN(days, 2 + Math.floor(Math.random() * 3))) {
      slots.push({ dayOfWeek: d, block: pick(["PAGI", "SIANG"] as const) });
    }
  } else if (scheduleType === "WEEKDAY_EVENING") {
    const days = [1, 2, 3, 4, 5];
    for (const d of pickN(days, 2 + Math.floor(Math.random() * 3))) {
      slots.push({ dayOfWeek: d, block: "SORE" });
    }
  } else {
    const days = [0, 1, 2, 3, 4, 5, 6];
    for (const d of pickN(days, 2 + Math.floor(Math.random() * 3))) {
      slots.push({ dayOfWeek: d, block: pick(BLOCKS) });
    }
  }

  const seen = new Set<string>();
  return slots.filter((s) => {
    const key = `${s.dayOfWeek}-${s.block}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function generatePerson(usedEmails: Set<string>) {
  const fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  const emailBase = fullName.toLowerCase().replace(/\s+/g, ".");
  let email = `${emailBase}@tether.test`;
  let suffix = 1;
  while (usedEmails.has(email)) {
    email = `${emailBase}${suffix}@tether.test`;
    suffix++;
  }
  usedEmails.add(email);

  const persona = pick(PERSONAS);
  const targetSkillCount = persona.skillCountMin + Math.floor(Math.random() * (persona.skillCountMax - persona.skillCountMin + 1));
  const primarySkills = pickN(persona.coreSkills, Math.min(targetSkillCount, persona.coreSkills.length));
  
  const otherPersona = pick(PERSONAS.filter((p) => p.type !== persona.type));
  const crossSkill = Math.random() < 0.35 ? pick(otherPersona.coreSkills) : null;
  const skillNames = Array.from(new Set([...primarySkills, ...(crossSkill ? [crossSkill] : [])]));

  return {
    fullName,
    email,
    faculty: pick(FACULTIES),
    bio: pick(persona.bioTemplates),
    skillNames,
    availability: generateAvailability(persona.scheduleType),
    interests: Array.from(new Set([...persona.interestCluster, pick(["social-impact", "ai", "web", "health", "fintech", "climate"] as const)])),
  };
}

async function seedCandidates(skillIdByName: Map<string, string>): Promise<string[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY belum ada di .env");
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 250 });
  const testUsers = (userList?.users ?? []).filter((u) => u.email?.endsWith("@tether.test"));
  const existingTestEmails = new Set(testUsers.map((u) => u.email!));

  const needed = Math.max(0, TARGET_CANDIDATES - existingTestEmails.size);
  if (needed === 0) {
    console.log(`2. Populasi ${existingTestEmails.size} akun @tether.test sudah mencukupi target ${TARGET_CANDIDATES}.`);
    return testUsers.slice(0, TARGET_CANDIDATES).map((u) => u.id);
  }

  console.log(`2. Membuat ${needed} kandidat baru untuk mencapai target ${TARGET_CANDIDATES} user (saat ini ${existingTestEmails.size})...`);
  const usedEmails = new Set(existingTestEmails);
  let created = 0;

  for (let i = 0; i < needed; i++) {
    const person = generatePerson(usedEmails);
    const { data, error } = await admin.auth.admin.createUser({
      email: person.email,
      password: CANDIDATE_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: person.fullName },
    });
    if (error || !data.user) {
      console.error(`   GAGAL membuat ${person.email}: ${error?.message}`);
      continue;
    }
    const profileId = data.user.id;
    await prisma.profile.update({
      where: { id: profileId },
      data: {
        faculty: person.faculty,
        bio: person.bio,
        interests: person.interests,
      },
    });

    for (const skillName of person.skillNames) {
      const skillId = skillIdByName.get(skillName);
      if (!skillId) continue;
      const initialLevel = Math.random() < 0.35 ? 0.65 : 0.5;
      await prisma.profileSkill.create({
        data: {
          profileId,
          skillId,
          evidenceLevel: initialLevel,
          portfolioUrl: initialLevel === 0.65 ? `https://github.com/${person.email.split("@")[0]}` : null,
        },
      });
    }

    await prisma.availability.createMany({
      data: person.availability.map((a) => ({ profileId, ...a })),
      skipDuplicates: true,
    });

    created++;
    if (created % 15 === 0 || created === needed) {
      console.log(`   ...${created}/${needed} akun baru ditambahkan.`);
    }
  }

  const { data: after } = await admin.auth.admin.listUsers({ perPage: 250 });
  return (after?.users ?? []).filter((u) => u.email?.endsWith("@tether.test")).map((u) => u.id);
}

const MIN_HOLDERS_PER_SKILL = 8;

async function resetCandidateEvidence(candidateIds: string[]) {
  if (candidateIds.length === 0) return;
  await prisma.skillEndorsement.deleteMany({ where: { profileSkill: { profileId: { in: candidateIds } } } });

  const skills = await prisma.profileSkill.findMany({
    where: { profileId: { in: candidateIds } },
    include: { profile: { select: { fullName: true } } },
  });

  const withPortfolioIds: string[] = [];
  const withoutPortfolioIds: string[] = [];

  for (const s of skills) {
    if (Math.random() < 0.38) {
      withPortfolioIds.push(s.id);
    } else {
      withoutPortfolioIds.push(s.id);
    }
  }

  await prisma.$transaction([
    prisma.profileSkill.updateMany({
      where: { id: { in: withPortfolioIds } },
      data: {
        evidenceLevel: 0.65,
        portfolioUrl: "https://github.com/tether-student-showcase",
      },
    }),
    prisma.profileSkill.updateMany({
      where: { id: { in: withoutPortfolioIds } },
      data: {
        evidenceLevel: 0.5,
        portfolioUrl: null,
      },
    }),
  ]);

  console.log(
    `2c. Variasi jenjang bukti: ${skills.length} ProfileSkill ditata (${withoutPortfolioIds.length} klaim 0.50, ${withPortfolioIds.length} portofolio 0.65). Level 0.80 & 1.00 dihasilkan dinamis dari skenario proyek.`,
  );
}

async function rebalanceCandidateSkills(skillIdByName: Map<string, string>, candidateIds: string[]) {
  if (candidateIds.length === 0) return;
  let added = 0;

  const catalogNames = new Set(SKILLS.map((s) => s.name));
  const canonical = [...skillIdByName].filter(([name]) => catalogNames.has(name));

  for (const [skillName, skillId] of canonical) {
    const holders = await prisma.profileSkill.findMany({
      where: { skillId, profileId: { in: candidateIds } },
      select: { profileId: true },
    });
    const missing = MIN_HOLDERS_PER_SKILL - holders.length;
    if (missing <= 0) continue;

    const holderSet = new Set(holders.map((h) => h.profileId));
    const available = candidateIds.filter((id) => !holderSet.has(id));
    for (const profileId of pickN(available, missing)) {
      const hasPortfolio = Math.random() < 0.35;
      await prisma.profileSkill.create({
        data: {
          profileId,
          skillId,
          evidenceLevel: hasPortfolio ? 0.65 : 0.5,
          portfolioUrl: hasPortfolio ? "https://github.com/tether-student-showcase" : null,
        },
      });
      added++;
    }
    void skillName;
  }

  console.log(`2b. Penyeimbang skill: ${added} ProfileSkill didistribusikan (target min ${MIN_HOLDERS_PER_SKILL} pemilik per skill).`);
}

// =====================================================================
// 3. DAFTAR 50 PROYEK DEMO KAMPUS LENGKAP
// =====================================================================
type SeedProjectTemplate = {
  title: string;
  goal: string;
  tags: string[];
  status: "ACTIVE" | "COMPLETED" | "DRAFT" | "DORMANT";
  reqSkills: string[];
  deadlineDays: number;
};

const EXTRA_45_PROJECTS: SeedProjectTemplate[] = [
  {
    title: "EcoWaste: Bank Sampah & Daur Ulang Digital",
    goal: "Sistem digitalisasi penukaran sampah anorganik kampus menjadi poin voucher kantin untuk mendorong pemilahan sampah.",
    tags: ["sustainability", "web", "iot"],
    status: "ACTIVE",
    reqSkills: ["React", "Backend API", "Database/SQL", "UI Design"],
    deadlineDays: 45,
  },
  {
    title: "TutorSebaya: Platform Mentoring Peer-to-Peer",
    goal: "Menghubungkan mahasiswa senior dengan mahasiswa baru untuk asistensi mata kuliah kalkulus dan fisika dasar secara fleksibel.",
    tags: ["education", "web", "social-impact"],
    status: "ACTIVE",
    reqSkills: ["Next.js", "TypeScript", "UI Design", "Product Management"],
    deadlineDays: 30,
  },
  {
    title: "KantinGo: Pre-Order Makanan Kantin Tanpa Antre",
    goal: "Aplikasi mobile pesan makanan di jam istirahat untuk memangkas antrian kasir kantin fakultas teknik.",
    tags: ["mobile", "fintech", "ux"],
    status: "ACTIVE",
    reqSkills: ["Flutter", "Backend API", "Figma", "Firebase"],
    deadlineDays: 25,
  },
  {
    title: "KarierMu: Portal Magang & Proyek Riset Dosen",
    goal: "Pusat informasi lowongan asisten peneliti dosen dan magang industri terverifikasi khusus civitas akademika.",
    tags: ["web", "business", "education"],
    status: "ACTIVE",
    reqSkills: ["Next.js", "Database/SQL", "UX Research", "Copywriting"],
    deadlineDays: 35,
  },
  {
    title: "Aura: Pemantau Kualitas Udara Kampus Berbasis IoT",
    goal: "Jaringan sensor mikrokontroler pengukur PM2.5 di area gedung perkuliahan dan visualisasi live dashboard publik.",
    tags: ["iot", "data", "climate"],
    status: "ACTIVE",
    reqSkills: ["Python", "Data Visualization", "DevOps/Deployment", "UI Design"],
    deadlineDays: 20,
  },
  {
    title: "BukuSaku: Pertukaran Diktat & Buku Bekas Mahasiswa",
    goal: "Marketplace komunitas untuk sirkulasi buku teks perkuliahan bekas dengan sistem pinjam antar mahasiswa.",
    tags: ["social-impact", "education", "web"],
    status: "ACTIVE",
    reqSkills: ["React", "Node.js", "UI Design"],
    deadlineDays: 50,
  },
  {
    title: "SahabatMental: Konseling Sebaya & Jurnal Emosi",
    goal: "Aplikasi pencatat emosi harian dan booking sesi konseling privat dengan mahasiswa psikologi tingkat profesi.",
    tags: ["health", "ux", "mobile"],
    status: "ACTIVE",
    reqSkills: ["Flutter", "UX Research", "Figma", "Kesehatan Masyarakat"],
    deadlineDays: 40,
  },
  {
    title: "OpenDataset Kampus: Repositori Terbuka Riset Skripsi",
    goal: "Platform pengarsipan dan sitasi dataset riset mahasiswa yang dapat dipakai ulang untuk penelitian lanjutan.",
    tags: ["data", "ai", "education"],
    status: "ACTIVE",
    reqSkills: ["Python", "Data Analysis", "Database/SQL", "Penulisan Akademik"],
    deadlineDays: 60,
  },
  {
    title: "NavigasiFasilitas: Peta Aksesibilitas Difabel Kampus",
    goal: "Panduan navigasi rute ramah kursi roda, lift aktif, dan ramp landai di seluruh gedung fakultas.",
    tags: ["social-impact", "mobile", "ux"],
    status: "ACTIVE",
    reqSkills: ["UI Design", "UX Research", "Flutter", "Riset Ilmiah"],
    deadlineDays: 30,
  },
  {
    title: "SmartLocker: Sistem Loker Cerdas Berbasis QR Code",
    goal: "Otomasi peminjaman loker perpustakaan menggunakan kode QR terintegrasi kartu mahasiswa digital.",
    tags: ["iot", "backend", "security"],
    status: "ACTIVE",
    reqSkills: ["Backend API", "Node.js", "Database/SQL"],
    deadlineDays: 15,
  },
  {
    title: "EventHub: Kalender & Tiket Kegiatan Ormawa",
    goal: "Satu pintu pendaftaran webinar, seminar nasional, dan festival budaya yang diselenggarakan organisasi mahasiswa.",
    tags: ["web", "design", "media"],
    status: "ACTIVE",
    reqSkills: ["React", "UI Design", "Branding/Visual", "Media Sosial"],
    deadlineDays: 20,
  },
  {
    title: "Jemputan: Platform Carpooling & Tebengan Mahasiswa",
    goal: "Pencocokan rute pulang-pergi mahasiswa satu daerah domisili untuk menghemat bensin dan mengurangi kemacetan.",
    tags: ["sustainability", "mobile", "social-impact"],
    status: "ACTIVE",
    reqSkills: ["Flutter", "Backend API", "UX Research"],
    deadlineDays: 45,
  },
  {
    title: "LabInventory: Sistem Peminjaman Alat Laboratorium",
    goal: "Pencatatan sirkulasi mikroskop, osiloskop, dan sensor lab teknik agar tidak terjadi kehilangan aset.",
    tags: ["backend", "web", "productivity"],
    status: "ACTIVE",
    reqSkills: ["Database/SQL", "Backend API", "React"],
    deadlineDays: 35,
  },
  {
    title: "BeasiswaID: Agregator Informasi Beasiswa & Kurasi Esai",
    goal: "Wadah kurasi beasiswa luar negeri dan peer-review draf motivation letter antar pendaftar.",
    tags: ["education", "writing", "social-impact"],
    status: "ACTIVE",
    reqSkills: ["Penulisan Akademik", "Public Speaking", "UI Design", "Next.js"],
    deadlineDays: 50,
  },
  {
    title: "FoodShare: Distribusi Makanan Surplus Kantin",
    goal: "Penyaluran sisa makanan layak konsumsi dari katering acara kampus kepada asrama mahasiswa dan panti asuhan.",
    tags: ["social-impact", "sustainability", "health"],
    status: "ACTIVE",
    reqSkills: ["Manajemen Proyek", "Kesehatan Masyarakat", "Media Sosial"],
    deadlineDays: 25,
  },
  {
    title: "Kompilasi Hukum: Search Engine Regulasi Rektorat",
    goal: "Pencarian cerdas teks SK Rektor, pedoman akademik, dan aturan beasiswa menggunakan semantic vector search.",
    tags: ["ai", "policy", "web"],
    status: "ACTIVE",
    reqSkills: ["Python", "Machine Learning", "Analisis Kebijakan", "Backend API"],
    deadlineDays: 40,
  },
  {
    title: "SiniarKampus: Studio Podcast & Distribusi Audio",
    goal: "Produksi siniar berkala yang mengulas inovasi skripsi dan isu hangat kampus bersama narasumber dosen dan aktivis.",
    tags: ["media", "audio", "communication"],
    status: "ACTIVE",
    reqSkills: ["Fotografi/Videografi", "Motion/Video", "Public Speaking", "Copywriting"],
    deadlineDays: 30,
  },
  {
    title: "SertifikatVerify: Verifikasi Keaslian Sertifikat via Hash",
    goal: "Pengecekan keabsahan piagam kepanitiaan dan prestasi lomba mahasiswa menggunakan hash kriptografi transparan.",
    tags: ["security", "web", "education"],
    status: "ACTIVE",
    reqSkills: ["TypeScript", "Backend API", "React"],
    deadlineDays: 15,
  },
  {
    title: "DonorDarahHub: Notifikasi Donor Darah Darurat",
    goal: "Broadcast notifikasi cepat ketersediaan dan kebutuhan darah golongan langka untuk civitas kampus.",
    tags: ["health", "mobile", "social-impact"],
    status: "ACTIVE",
    reqSkills: ["Kesehatan Masyarakat", "Flutter", "Backend API"],
    deadlineDays: 20,
  },
  {
    title: "SentimenKampus: Analisis Opini Evaluasi Dosen",
    goal: "Pengolahan natural language processing terhadap survei masukan mahasiswa untuk perbaikan mutu perkuliahan.",
    tags: ["ai", "data", "education"],
    status: "ACTIVE",
    reqSkills: ["Python", "Machine Learning", "Data Visualization"],
    deadlineDays: 35,
  },
  {
    title: "KatalogUMKM: Digitalisasi Warung Sekitar Kampus",
    goal: "Pemberdayaan pedagang kaki lima dan warteg lingkar kampus dengan menu digital dan optimasi Google Maps.",
    tags: ["business", "social-impact", "web"],
    status: "ACTIVE",
    reqSkills: ["Business Model", "Market Research", "UI Design"],
    deadlineDays: 45,
  },
  {
    title: "PresensiGeofencing: Presensi GPS Radius Ruang Kuliah",
    goal: "Sistem presensi anti-titip absen yang memvalidasi radius koordinat GPS ruang perkuliahan fisik.",
    tags: ["mobile", "security", "education"],
    status: "ACTIVE",
    reqSkills: ["Flutter", "Backend API", "Database/SQL"],
    deadlineDays: 25,
  },
  {
    title: "KaryaRupa: Galeri Portofolio Mahasiswa DKV & Arsitektur",
    goal: "Pameran digital kurasi karya seni rupa, maket arsitektur, dan poster film karya tugas akhir mahasiswa.",
    tags: ["design", "media", "web"],
    status: "ACTIVE",
    reqSkills: ["Figma", "Branding/Visual", "Next.js", "Motion/Video"],
    deadlineDays: 30,
  },
  {
    title: "RoboFarm: Prototipe Hidroponik Cerdas Kebun Biologi",
    goal: "Otomasi pompa nutrisi dan sensor pH air tanaman selada hidroponik menggunakan mikrokontroler ESP32.",
    tags: ["iot", "sustainability", "hardware"],
    status: "ACTIVE",
    reqSkills: ["Python", "Data Analysis", "DevOps/Deployment"],
    deadlineDays: 40,
  },
  {
    title: "CekPlagiasi: Deteksi Kemiripan Draf Makalah Mandiri",
    goal: "Alat bantu mahasiswa untuk memeriksa orisinalitas tulisan sebelum diserahkan ke jurnal ilmiah.",
    tags: ["nlp", "writing", "education"],
    status: "ACTIVE",
    reqSkills: ["Python", "Penulisan Akademik", "Backend API"],
    deadlineDays: 30,
  },
  {
    title: "RuangTenang: Reservasi Silent Pod Perpustakaan",
    goal: "Manajemen kuota bilik belajar kedap suara perpustakaan untuk mahasiswa yang sedang menyusun tugas akhir.",
    tags: ["web", "productivity"],
    status: "ACTIVE",
    reqSkills: ["React", "UI Design", "Database/SQL"],
    deadlineDays: 15,
  },
  {
    title: "BursaBuku: Pasar Lelang Alat Studio Arsitektur",
    goal: "Platform jual-beli meja gambar, penggaris T, dan perlengkapan teknik bekas yang masih layak pakai.",
    tags: ["e-commerce", "design"],
    status: "ACTIVE",
    reqSkills: ["Next.js", "Business Model", "Figma"],
    deadlineDays: 50,
  },
  {
    title: "SurveiMahasiswa: Platform Kuesioner Akademik Terstandar",
    goal: "Pusat distribusi kuesioner skripsi dengan validasi responden mahasiswa aktif untuk mencegah data palsu.",
    tags: ["research", "data", "web"],
    status: "ACTIVE",
    reqSkills: ["Riset Ilmiah", "Data Analysis", "React"],
    deadlineDays: 20,
  },
  {
    title: "InfoLomba: Pelacak Kompetisi & Pembentukan Tim",
    goal: "Kurasi informasi kompetisi nasional dan pencarian rekan satu tim untuk Pekan Ilmiah Mahasiswa Nasional.",
    tags: ["collaboration", "education", "web"],
    status: "ACTIVE",
    reqSkills: ["Product Management", "UI Design", "Public Speaking"],
    deadlineDays: 25,
  },
  {
    title: "KalkulatorGizi: Analisis Nutrisi Menu Kantin",
    goal: "Aplikasi penghitung kalori dan nutrisi makanan kantin untuk mendukung pola hidup sehat mahasiswa.",
    tags: ["health", "mobile"],
    status: "ACTIVE",
    reqSkills: ["Kesehatan Masyarakat", "Flutter", "UI Design"],
    deadlineDays: 35,
  },
  {
    title: "PilahPlastik: Klasifikasi Sampah via Computer Vision",
    goal: "Model visi komputer untuk membedakan sampah botol PET, kaleng, dan organik menggunakan kamera smartphone.",
    tags: ["ai", "climate", "mobile"],
    status: "ACTIVE",
    reqSkills: ["Python", "Machine Learning", "Flutter"],
    deadlineDays: 45,
  },
  {
    title: "SimulasiSidang: Latihan Tanya Jawab Skripsi via LLM",
    goal: "Simulasi latihan uji sidang skripsi interaktif dengan agen AI yang membedah kelemahan metodologi penulisan.",
    tags: ["ai", "education", "web"],
    status: "ACTIVE",
    reqSkills: ["Python", "Next.js", "Riset Ilmiah", "Penulisan Akademik"],
    deadlineDays: 30,
  },
  {
    title: "LaporFasilitas: Pelaporan Kerusakan AC & Kursi Kuliah",
    goal: "Aplikasi crowdsourcing pelaporan proyektor mati dan kerusakan fasilitas ruang kelas langsung ke Biro Logistik.",
    tags: ["civic", "mobile", "productivity"],
    status: "ACTIVE",
    reqSkills: ["Flutter", "Backend API", "Manajemen Proyek"],
    deadlineDays: 15,
  },
  {
    title: "PetaAlumni: Direktori Sebaran Karier Lulusan",
    goal: "Visualisasi peta persebaran perusahaan tempat alumni bekerja untuk inspirasi karier mahasiswa aktif.",
    tags: ["data", "community", "web"],
    status: "ACTIVE",
    reqSkills: ["Data Visualization", "React", "Market Research"],
    deadlineDays: 40,
  },
  {
    title: "BebasSampahVisual: Kampanye Penertiban Spanduk",
    goal: "Inisiatif mahasiswa desain untuk menata papan pengumuman kampus agar bebas dari polusi pamflet liar.",
    tags: ["design", "social-impact"],
    status: "ACTIVE",
    reqSkills: ["Branding/Visual", "Media Sosial", "Fotografi/Videografi"],
    deadlineDays: 20,
  },
  {
    title: "PenerjemahJurnal: Glosarium Istilah Ilmiah Indonesia",
    goal: "Kamus crowdsourcing istilah sains dan rekayasa bahasa Inggris ke padanan baku bahasa Indonesia.",
    tags: ["education", "nlp"],
    status: "ACTIVE",
    reqSkills: ["Penulisan Akademik", "Riset Ilmiah", "TypeScript"],
    deadlineDays: 35,
  },
  {
    title: "AudioBookDiktat: Materi Kuliah Audio untuk Tunanetra",
    goal: "Rekaman suara bab buku ajar perkuliahan untuk membantu mahasiswa dengan keterbatasan penglihatan.",
    tags: ["accessibility", "social-impact"],
    status: "ACTIVE",
    reqSkills: ["Public Speaking", "Copywriting", "Fotografi/Videografi"],
    deadlineDays: 45,
  },
  {
    title: "ForumIde: Brainstorming Proposal Hackathon",
    goal: "Papan kolaborasi ide kreatif untuk inkubasi ide proposal kompetisi nasional sebelum pengajuan resmi.",
    tags: ["collaboration", "business"],
    status: "ACTIVE",
    reqSkills: ["Business Model", "Pitching/Presentasi", "UI Design"],
    deadlineDays: 15,
  },
  {
    title: "PengelolaKas: Transparansi Keuangan Himpunan",
    goal: "Buku kas publik digital untuk organisasi kemahasiswaan dengan laporan pengeluaran dana transparan.",
    tags: ["fintech", "web"],
    status: "ACTIVE",
    reqSkills: ["Database/SQL", "Financial Modeling", "React"],
    deadlineDays: 25,
  },
  {
    title: "JadwalKuliahSync: Sinkronisasi KRS ke Kalender",
    goal: "Ekstensi browser yang otomatis mengekspor jadwal kuliah dari portal akademik ke format iCal/Google Calendar.",
    tags: ["productivity", "web"],
    status: "ACTIVE",
    reqSkills: ["TypeScript", "Next.js", "UI Design"],
    deadlineDays: 10,
  },
  {
    title: "Sistem Antrian Perpustakaan Pusat",
    goal: "Pernah dipakai untuk mengelola kuota reservasi kursi baca di masa pembatasan kapasitas kampus.",
    tags: ["web", "library"],
    status: "COMPLETED",
    reqSkills: ["Backend API", "React", "Database/SQL"],
    deadlineDays: -10,
  },
  {
    title: "Peta Jalur Sepeda Ramah Lingkungan",
    goal: "Riset pemetaan rute jalur aman bersepeda di dalam dan lingkar luar kampus.",
    tags: ["sustainability", "gis"],
    status: "COMPLETED",
    reqSkills: ["Data Visualization", "Riset Ilmiah", "UI Design"],
    deadlineDays: -15,
  },
  {
    title: "Portal Riset Panel Surya Rektorat",
    goal: "Dashboard pemantauan daya listrik yang dihasilkan panel surya atap gedung rektorat.",
    tags: ["iot", "data", "climate"],
    status: "COMPLETED",
    reqSkills: ["Python", "Data Analysis", "React"],
    deadlineDays: -20,
  },
  {
    title: "Inkubator Startup Mahasiswa: Batch 2026",
    goal: "Program akselerasi 3 bulan untuk memvalidasi model bisnis rintisan teknologi mahasiswa.",
    tags: ["business", "incubation"],
    status: "DRAFT",
    reqSkills: ["Business Model", "Pitching/Presentasi", "Product Management"],
    deadlineDays: 60,
  },
  {
    title: "Platform Magang Mandiri Lintas Kampus",
    goal: "Inisiasi jejaring pertukaran proyek penelitian antar universitas di Indonesia.",
    tags: ["career", "education"],
    status: "DRAFT",
    reqSkills: ["Manajemen Proyek", "Analisis Kebijakan", "Public Speaking"],
    deadlineDays: 70,
  },
];

type ActivitySeed = { actorId: string; eventType: ActivityEventType; weight: number; createdAt: Date };

async function insertActivities(projectId: string, activities: ActivitySeed[]) {
  await prisma.activity.createMany({ data: activities.map((a) => ({ projectId, ...a })) });
}

async function notifySeed(
  profileId: string,
  type: "INVITATION" | "HEALTH_ALERT" | "MILESTONE_DEADLINE",
  message: string,
  projectId: string,
  createdAt: Date,
) {
  await prisma.notification.create({ data: { profileId, type, message, projectId, createdAt } });
}

async function seedHealthHistory(
  projectId: string,
  activities: ActivitySeed[],
  deadline: Date | null,
  totalTaskWeight: number,
  taskCompletions: { weight: number; completedAt: Date }[],
  historyDays: number,
  stopDaysBack = 0,
) {
  for (let daysBack = historyDays; daysBack >= stopDaysBack; daysBack--) {
    const asOf = daysAgo(daysBack);
    const activitiesSoFar = activities
      .filter((a) => a.createdAt <= asOf)
      .map((a) => ({ weight: a.weight, createdAt: a.createdAt, actorId: a.actorId }));

    const pulse = computePulse(activitiesSoFar, asOf);
    const momentum = computeMomentum(activitiesSoFar, asOf);
    const byMember = new Map<string, number>();
    for (const a of activitiesSoFar) byMember.set(a.actorId, (byMember.get(a.actorId) ?? 0) + a.weight);
    const balance = computeBalance(Array.from(byMember.values()));

    let forecast = 100;
    if (deadline) {
      const daysUntilDeadline = (deadline.getTime() - asOf.getTime()) / DAY_MS;
      const completedByThen = taskCompletions.filter((t) => t.completedAt <= asOf);
      const remainingWeight = totalTaskWeight - completedByThen.reduce((s, t) => s + t.weight, 0);
      const buckets = new Array(10).fill(0);
      for (const t of completedByThen) {
        const idx = 9 - Math.floor((asOf.getTime() - t.completedAt.getTime()) / DAY_MS);
        if (idx >= 0 && idx < 10) buckets[idx] += t.weight;
      }
      forecast = computeForecast(Math.max(0, remainingWeight), daysUntilDeadline, buckets);
    }

    const { status: _status, ...health } = composeHealth(pulse, momentum, balance, forecast);
    void _status;
    const snapshotDate = midnightDaysAgo(daysBack);
    await prisma.healthSnapshot.upsert({
      where: { projectId_snapshotDate: { projectId, snapshotDate } },
      create: { projectId, snapshotDate, ...health },
      update: { ...health },
    });
  }
}

async function clearPreviousSeedProjects() {
  const allKnownTitles = [
    ...Object.values(SEED_FLAGSHIP_TITLES),
    ...EXTRA_45_PROJECTS.map((p) => p.title),
  ];

  const old = await prisma.project.findMany({
    where: {
      OR: [
        { title: { in: allKnownTitles } },
        { tags: { has: "seed-demo" } },
      ],
    },
    select: { id: true },
  });

  if (old.length === 0) return;
  console.log(`3. Menghapus ${old.length} proyek seed lama dari run sebelumnya...`);
  const ids = old.map((p) => p.id);

  await prisma.healthSnapshot.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.progressUpdate.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.activity.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.discussionReply.deleteMany({ where: { post: { projectId: { in: ids } } } });
  await prisma.discussionPost.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.peerRating.deleteMany({ where: { projectId: { in: ids } } });

  const endorsedSkills = await prisma.profileSkill.findMany({
    where: { profile: { teamMemberships: { some: { team: { projectId: { in: ids } } } } } },
    select: { id: true },
  });
  await prisma.skillEndorsement.deleteMany({ where: { profileSkillId: { in: endorsedSkills.map((s) => s.id) } } });
  const tasks = await prisma.task.findMany({ where: { milestone: { projectId: { in: ids } } }, select: { id: true } });
  await prisma.task.deleteMany({ where: { id: { in: tasks.map((t) => t.id) } } });
  await prisma.milestone.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.teamInvitation.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.teamMember.deleteMany({ where: { team: { projectId: { in: ids } } } });
  await prisma.team.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.requirement.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.project.deleteMany({ where: { id: { in: ids } } });
}

// =====================================================================
// 4. MEMBUAT 50 PROYEK LENGKAP (1 User tidak terbatas ambil 1 proyek)
// =====================================================================
async function seedAll50Projects(skillIdByName: Map<string, string>, candidateIds: string[]) {
  console.log("4. Membuat 50 skenario proyek...");

  // --- Proyek 1: SEHAT (Flagship A) ---
  const reqA = ["React", "UI Design", "Data Visualization", "Manajemen Proyek"];
  const memA = pickN(candidateIds, 3);
  const projA = await prisma.project.create({
    data: {
      ownerId: OWNER_ID,
      title: SEED_FLAGSHIP_TITLES.healthy,
      goal: "Memetakan & memvisualisasikan ruang terbuka hijau di area kampus supaya mahasiswa gampang menemukan tempat belajar/istirahat outdoor.",
      tags: ["sustainability", "web", "data", "seed-demo"],
      deadline: daysAgo(-30),
      status: "ACTIVE",
    },
  });
  for (const name of reqA) {
    await prisma.requirement.create({
      data: { projectId: projA.id, skillId: skillIdByName.get(name)!, importance: 0.8 },
    });
  }
  await prisma.team.create({
    data: {
      projectId: projA.id,
      members: {
        create: [
          { profileId: OWNER_ID, role: "Owner" },
          ...memA.map((id) => ({ profileId: id, role: "Member" })),
        ],
      },
    },
  });
  const m1A = await prisma.milestone.create({
    data: { projectId: projA.id, ownerId: OWNER_ID, title: "Riset & Requirement", deadline: daysAgo(-3), weight: 3, status: "DONE" },
  });
  const m2A = await prisma.milestone.create({
    data: { projectId: projA.id, ownerId: OWNER_ID, title: "Desain UI & Prototipe Peta", deadline: daysAgo(-15), weight: 4, status: "IN_PROGRESS" },
  });
  await prisma.task.create({ data: { milestoneId: m1A.id, title: "Survei titik kumpul mahasiswa", weight: 1, status: "DONE", assigneeId: memA[0] } });
  await prisma.task.create({ data: { milestoneId: m2A.id, title: "Wireframe UI Peta", weight: 2, status: "DONE", assigneeId: OWNER_ID } });
  await prisma.task.create({ data: { milestoneId: m2A.id, title: "Implementasi Komponen Peta", weight: 2, status: "IN_PROGRESS", assigneeId: memA[1] } });
  const postA = await prisma.discussionPost.create({
    data: { projectId: projA.id, authorId: OWNER_ID, body: "Data titik kampus timur sudah siap diolah.", createdAt: daysAgo(5) },
  });
  await prisma.discussionReply.create({
    data: { postId: postA.id, authorId: memA[0], body: "Siap, langsung diintegrasikan ke map layer.", createdAt: daysAgo(4) },
  });
  await seedHealthHistory(projA.id, [{ actorId: OWNER_ID, eventType: "TASK_SELESAI", weight: 3, createdAt: daysAgo(6) }], projA.deadline, 5, [{ weight: 1, completedAt: daysAgo(6) }], 10);

  // --- Proyek 2: STRUGGLING (Flagship B) ---
  const memB = pickN(candidateIds, 2);
  const projB = await prisma.project.create({
    data: {
      ownerId: OWNER_ID,
      title: SEED_FLAGSHIP_TITLES.struggling,
      goal: "Sistem antrian digital untuk klinik kesehatan kampus supaya mahasiswa tidak perlu antre fisik berjam-jam.",
      tags: ["health", "web", "seed-demo"],
      deadline: daysAgo(-10),
      status: "ACTIVE",
      weightGapCoverage: 0.3,
      weightAvailability: 0.4,
    },
  });
  for (const name of ["Backend API", "Database/SQL", "Kesehatan Masyarakat"]) {
    await prisma.requirement.create({ data: { projectId: projB.id, skillId: skillIdByName.get(name)!, importance: 0.7 } });
  }
  await prisma.team.create({
    data: {
      projectId: projB.id,
      members: {
        create: [
          { profileId: OWNER_ID, role: "Owner" },
          ...memB.map((id) => ({ profileId: id, role: "Member" })),
        ],
      },
    },
  });
  const m1B = await prisma.milestone.create({
    data: { projectId: projB.id, ownerId: OWNER_ID, title: "Skema Antrian & Backend", deadline: daysAgo(5), weight: 5, status: "IN_PROGRESS" },
  });
  await prisma.task.create({ data: { milestoneId: m1B.id, title: "Skema Database Antrian", weight: 2, status: "DONE", assigneeId: OWNER_ID } });
  await prisma.task.create({ data: { milestoneId: m1B.id, title: "Endpoint Nomor Antrian", weight: 2, status: "IN_PROGRESS", assigneeId: OWNER_ID } });

  // --- Proyek 3: DORMANT (Flagship C) ---
  const projC = await prisma.project.create({
    data: {
      ownerId: candidateIds[0],
      title: SEED_FLAGSHIP_TITLES.dormant,
      goal: "Wadah mahasiswa lintas jurusan untuk riset bersama isu perubahan iklim di lingkungan kampus.",
      tags: ["climate", "social-impact", "seed-demo"],
      status: "DORMANT",
    },
  });
  await prisma.requirement.create({ data: { projectId: projC.id, skillId: skillIdByName.get("Riset Ilmiah")!, importance: 0.6 } });
  await prisma.team.create({
    data: {
      projectId: projC.id,
      members: {
        create: [
          { profileId: candidateIds[0], role: "Owner", joinedAt: daysAgo(35) },
          { profileId: candidateIds[1], role: "Member", joinedAt: daysAgo(32) },
        ],
      },
    },
  });

  // --- Proyek 4: COMPLETED (Flagship D) ---
  const projD = await prisma.project.create({
    data: {
      ownerId: OWNER_ID,
      title: SEED_FLAGSHIP_TITLES.completed,
      goal: "Aplikasi mobile untuk booking ruang belajar/diskusi di perpustakaan kampus, menghindari rebutan ruang manual.",
      tags: ["mobile", "education", "seed-demo"],
      deadline: daysAgo(5),
      status: "COMPLETED",
    },
  });
  for (const name of ["Flutter", "TypeScript", "DevOps/Deployment"]) {
    await prisma.requirement.create({ data: { projectId: projD.id, skillId: skillIdByName.get(name)!, importance: 0.6 } });
  }
  const memD = pickN(candidateIds, 3);
  await prisma.team.create({
    data: {
      projectId: projD.id,
      members: {
        create: [
          { profileId: OWNER_ID, role: "Owner", joinedAt: daysAgo(30) },
          ...memD.map((id, i) => ({ profileId: id, role: "Member", joinedAt: daysAgo(28 - i) })),
        ],
      },
    },
  });

  // --- Proyek 5: DRAFT (Flagship E) ---
  const projE = await prisma.project.create({
    data: {
      ownerId: candidateIds[2],
      title: SEED_FLAGSHIP_TITLES.draft,
      goal: "Newsletter bulanan yang merangkum riset-riset menarik mahasiswa dari berbagai jurusan.",
      tags: ["education", "social-impact", "seed-demo"],
      status: "DRAFT",
    },
  });
  await prisma.team.create({
    data: {
      projectId: projE.id,
      members: { create: { profileId: candidateIds[2], role: "Owner" } },
    },
  });

  console.log("   ✓ 5 Proyek Flagship (Sehat, Berisiko, Dormant, Completed, Draft) terbuat.");

  // --- Proyek 6 s/d 50: 45 Proyek Kampus Lintas Disiplin ---
  // Pastikan OWNER_ID juga terdaftar sebagai Owner/Member di beberapa proyek aktif
  // agar halaman /work menampilkan Work Grid yang kaya!
  let count = 5;
  for (const p of EXTRA_45_PROJECTS) {
    count++;
    // Tiap user TIDAK TERBATAS ambil 1 proyek (kandidat diambil bebas dari kolam 100)
    const assignedMembers = pickN(candidateIds, 2 + Math.floor(Math.random() * 3));
    
    // Berikan OWNER_ID peran di ~4 proyek tambahan agar halaman /work memiliki banyak proyek aktif
    const shouldIncludeOwner = (count % 8 === 0 || count === 6 || count === 7 || count === 10);
    const ownerOfThisProject = count === 6 || count === 10 ? OWNER_ID : assignedMembers[0];

    const project = await prisma.project.create({
      data: {
        ownerId: ownerOfThisProject,
        title: p.title,
        goal: p.goal,
        tags: [...p.tags, "seed-demo"],
        deadline: p.deadlineDays !== 0 ? daysAgo(-p.deadlineDays) : null,
        status: p.status,
      },
    });

    // Pasang requirement skills
    for (const sName of p.reqSkills) {
      const skillId = skillIdByName.get(sName);
      if (skillId) {
        await prisma.requirement.create({
          data: {
            projectId: project.id,
            skillId,
            importance: 0.5 + Math.random() * 0.4,
          },
        });
      }
    }

    // Bangun tim anggota (termasuk OWNER_ID bila terpilih)
    const teamMembersData: { profileId: string; role: string; joinedAt: Date }[] = [
      { profileId: ownerOfThisProject, role: "Owner", joinedAt: daysAgo(20 + Math.floor(Math.random() * 15)) },
    ];

    for (const mId of assignedMembers) {
      if (mId !== ownerOfThisProject) {
        teamMembersData.push({
          profileId: mId,
          role: "Member",
          joinedAt: daysAgo(10 + Math.floor(Math.random() * 10)),
        });
      }
    }

    if (shouldIncludeOwner && ownerOfThisProject !== OWNER_ID) {
      teamMembersData.push({
        profileId: OWNER_ID,
        role: "Member",
        joinedAt: daysAgo(8),
      });
    }

    await prisma.team.create({
      data: {
        projectId: project.id,
        members: { create: teamMembersData },
      },
    });

    // Jika ACTIVE atau COMPLETED, buatkan milestone & task
    if (p.status === "ACTIVE" || p.status === "COMPLETED") {
      const m1 = await prisma.milestone.create({
        data: {
          projectId: project.id,
          ownerId: ownerOfThisProject,
          title: "Tahap 1: Validasi Masalah & Desain Solusi",
          deadline: daysAgo(-10),
          weight: 3,
          status: p.status === "COMPLETED" ? "DONE" : "IN_PROGRESS",
        },
      });

      const m2 = await prisma.milestone.create({
        data: {
          projectId: project.id,
          ownerId: ownerOfThisProject,
          title: "Tahap 2: Implementasi & Rilis Terbuka",
          deadline: daysAgo(-30),
          weight: 4,
          status: p.status === "COMPLETED" ? "DONE" : "TODO",
        },
      });

      // Buat 3-4 tasks
      await prisma.task.create({
        data: {
          milestoneId: m1.id,
          title: "Menyusun skema arsitektur & wireframe",
          weight: 2,
          status: "DONE",
          assigneeId: teamMembersData[0].profileId,
        },
      });
      await prisma.task.create({
        data: {
          milestoneId: m1.id,
          title: "Setup repositori kode & database",
          weight: 2,
          status: p.status === "COMPLETED" ? "DONE" : "IN_PROGRESS",
          assigneeId: teamMembersData[1]?.profileId ?? teamMembersData[0].profileId,
        },
      });
      await prisma.task.create({
        data: {
          milestoneId: m2.id,
          title: "Pengujian fungsionalitas dan usability",
          weight: 2,
          status: p.status === "COMPLETED" ? "DONE" : "TODO",
        },
      });

      // Post diskusi pertama
      const dPost = await prisma.discussionPost.create({
        data: {
          projectId: project.id,
          authorId: ownerOfThisProject,
          body: `Selamat datang di ruang kolaborasi ${p.title}! Silakan cek task di Ruang Kerja.`,
          createdAt: daysAgo(7),
        },
      });
      if (teamMembersData.length > 1) {
        await prisma.discussionReply.create({
          data: {
            postId: dPost.id,
            authorId: teamMembersData[1].profileId,
            body: "Siap, mulai mengerjakan bagian setup dan desain.",
            createdAt: daysAgo(6),
          },
        });
      }

      // Progress update singkat
      await prisma.progressUpdate.create({
        data: {
          projectId: project.id,
          authorId: ownerOfThisProject,
          body: "Milestone awal berjalan sesuai jadwal.",
          createdAt: daysAgo(4),
        },
      });
    }

    if (count % 10 === 0 || count === 50) {
      console.log(`   ...${count}/50 proyek terkonfigurasi.`);
    }
  }

  console.log(`\nSelesai! 50 Proyek kampus aktif dengan kolaborasi tim multidisiplin siap digunakan.`);
}

// =====================================================================
// MAIN
// =====================================================================
async function main() {
  console.log("=== SEEDING TETHER (POPULASI 100 USER & 50 PROYEK KAMPUS) ===");
  const skillIdByName = await seedSkills();
  const candidateIds = await seedCandidates(skillIdByName);
  await rebalanceCandidateSkills(skillIdByName, candidateIds);
  await resetCandidateEvidence(candidateIds);
  await clearPreviousSeedProjects();
  await seedAll50Projects(skillIdByName, candidateIds);

  console.log("\nAkun uji: format <nama>.<marga>@tether.test, password: admin123");
  console.log("Akun utama Naufal otomatis bergabung di beberapa proyek aktif (buka /work untuk melihat Work Grid).");
}

main()
  .catch((e) => {
    console.error("Gagal menjalankan seed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

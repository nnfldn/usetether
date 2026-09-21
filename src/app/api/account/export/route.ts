import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// Checklist privasi Blueprint Bagian 09: "Ekspor dan hapus akun tersedia
// sejak awal". Route Handler (bukan Server Action) karena ini perlu
// mengembalikan file unduhan, bukan cuma redirect/state.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [profile, ownedProjects, teamMemberships, progressUpdates, discussionPosts] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      include: { skills: { include: { skill: true } }, availability: true },
    }),
    prisma.project.findMany({ where: { ownerId: user.id }, select: { id: true, title: true, status: true, createdAt: true } }),
    prisma.teamMember.findMany({
      where: { profileId: user.id },
      select: { role: true, status: true, joinedAt: true, team: { select: { project: { select: { title: true } } } } },
    }),
    prisma.progressUpdate.findMany({ where: { authorId: user.id }, select: { body: true, createdAt: true, projectId: true } }),
    prisma.discussionPost.findMany({ where: { authorId: user.id }, select: { body: true, createdAt: true, projectId: true } }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    profile: profile && {
      fullName: profile.fullName,
      faculty: profile.faculty,
      bio: profile.bio,
      interests: profile.interests,
      skills: profile.skills.map((s) => ({ name: s.skill.name, evidenceLevel: s.evidenceLevel })),
      availability: profile.availability.map((a) => ({ dayOfWeek: a.dayOfWeek, block: a.block })),
      createdAt: profile.createdAt,
    },
    ownedProjects,
    teamMemberships: teamMemberships.map((m) => ({
      projectTitle: m.team.project.title,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    })),
    progressUpdates,
    discussionPosts,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="tether-data-${user.id}.json"`,
    },
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isActiveMember } from "@/lib/team-membership";
import { noticeUrl } from "@/lib/action-notice";

// Note: Validations should ideally be in a shared lib, but for simplicity, we do basic checks here or reuse postCommentSchema.
// I will just use basic z.string() here.
import { z } from "zod";

const discussionBodySchema = z.string().trim().min(1, "Pesan minimal 1 karakter").max(2000, "Pesan maksimal 2000 karakter");

// ---------------------------------------------------------------------
// FR-01: CREATE DISCUSSION POST
// ---------------------------------------------------------------------
export async function createDiscussionPostAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId"));
  const overviewPath = `/projects/${projectId}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // FR-05: Membership Authorization
  if (!(await isActiveMember(projectId, user.id))) {
    redirect(noticeUrl(overviewPath, "NOT_MEMBER"));
  }

  const parsed = discussionBodySchema.safeParse(formData.get("body"));
  if (!parsed.success) redirect(noticeUrl(overviewPath, "COMMENT_INVALID"));

  await prisma.discussionPost.create({
    data: { projectId, authorId: user.id, body: parsed.data },
  });

  // PRD 5: TIDAK ADA logActivity/logThrottledActivity. Discussion tidak menaikkan Project Health.
  
  revalidatePath(overviewPath);
  revalidatePath(`${overviewPath}/workspace`);
}

// ---------------------------------------------------------------------
// FR-02: REPLY TO DISCUSSION
// ---------------------------------------------------------------------
export async function createDiscussionReplyAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const postId = String(formData.get("postId"));
  const parsed = discussionBodySchema.safeParse(formData.get("body"));
  
  const post = await prisma.discussionPost.findUnique({ where: { id: postId } });
  if (!post) redirect("/projects");
  const overviewPath = `/projects/${post.projectId}`;

  if (!parsed.success) redirect(noticeUrl(overviewPath, "COMMENT_INVALID"));

  // FR-05: Membership Authorization
  if (!(await isActiveMember(post.projectId, user.id))) {
    redirect(noticeUrl(overviewPath, "NOT_MEMBER"));
  }

  await prisma.discussionReply.create({
    data: { postId, authorId: user.id, body: parsed.data },
  });

  revalidatePath(overviewPath);
  revalidatePath(`${overviewPath}/workspace`);
}

// ---------------------------------------------------------------------
// FR-04: DELETE POST
// ---------------------------------------------------------------------
export async function deleteDiscussionPostAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const postId = String(formData.get("postId"));
  
  const post = await prisma.discussionPost.findUnique({ where: { id: postId } });
  if (!post) redirect("/projects");
  const overviewPath = `/projects/${post.projectId}`;

  // Hanya author atau owner yang boleh menghapus
  const project = await prisma.project.findUnique({ where: { id: post.projectId }});
  
  if (post.authorId !== user.id && project?.ownerId !== user.id) {
    redirect(noticeUrl(overviewPath, "NOT_MEMBER"));
  }

  await prisma.discussionPost.delete({ where: { id: postId } });

  revalidatePath(overviewPath);
  revalidatePath(`${overviewPath}/workspace`);
}

// ---------------------------------------------------------------------
// FR-04: DELETE REPLY
// ---------------------------------------------------------------------
export async function deleteDiscussionReplyAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const replyId = String(formData.get("replyId"));
  
  const reply = await prisma.discussionReply.findUnique({ 
    where: { id: replyId },
    include: { post: true }
  });
  if (!reply) redirect("/projects");
  const overviewPath = `/projects/${reply.post.projectId}`;

  const project = await prisma.project.findUnique({ where: { id: reply.post.projectId }});

  // Hanya author atau project owner yang boleh menghapus
  if (reply.authorId !== user.id && project?.ownerId !== user.id) {
    redirect(noticeUrl(overviewPath, "NOT_MEMBER"));
  }

  await prisma.discussionReply.delete({ where: { id: replyId } });

  revalidatePath(overviewPath);
  revalidatePath(`${overviewPath}/workspace`);
}

// Dummy export untuk alias sebelumnya supaya tidak error di route lain yang import
export const postCommentAction = createDiscussionPostAction;

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getViewerAccess } from "@/lib/team-membership";
import { SubmitButton } from "@/components/submit-button";
import { ActionNotice } from "@/components/action-notice";
import { 
  createDiscussionPostAction, 
  createDiscussionReplyAction, 
  deleteDiscussionPostAction, 
  deleteDiscussionReplyAction 
} from "@/app/actions/discussion";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function ProjectDiscussionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { id: projectId } = await params;
  const { e: noticeCode } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { isMember, isOwner } = await getViewerAccess(projectId, user?.id);
  
  if (!isMember) {
    return (
      <div className="md-card p-8 text-center text-sm text-on-surface-variant">
        Ruang diskusi privat untuk anggota tim proyek ini.
      </div>
    );
  }

  const discussionPosts = await prisma.discussionPost
    .findMany({
      where: { projectId },
      include: { 
        author: { select: { fullName: true } }, 
        replies: { 
          include: { author: { select: { fullName: true } } }, 
          orderBy: { createdAt: "asc" } 
        } 
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    .catch((err: unknown) => { console.error("[discussion] DB query failed:", err); return []; });

  return (
    <div className="space-y-6">
      <ActionNotice code={noticeCode} />

      <section className="md-card p-6 space-y-6">
        <div className="border-b border-outline pb-4">
          <p className="eyebrow">DISKUSI TIM</p>
          <h2 className="text-2xl font-bold font-display uppercase tracking-tight text-on-surface mt-1">
            Ruang Diskusi Proyek
          </h2>
          <p className="mt-1 font-mono text-xs text-on-surface-muted leading-relaxed">
            Tempat koordinasi kontekstual antar anggota tim. Pesan diskusi bersifat asinkron dan tidak menyumbang skor kesehatan aktivitas (anti-gaming).
          </p>
        </div>

        {/* Post Form */}
        <form action={createDiscussionPostAction} className="space-y-3">
          <input type="hidden" name="projectId" value={projectId} />
          <textarea
            name="body"
            required
            minLength={1}
            maxLength={2000}
            rows={3}
            placeholder="Tulis pembaruan tugas, kendala, atau topik koordinasi tim..."
            className="md-field"
          />
          <div className="flex justify-end">
            <SubmitButton className="md-btn md-btn-filled md-btn-sm" pendingLabel="Mengirim...">
              Kirim Post Diskusi
            </SubmitButton>
          </div>
        </form>

        {/* Posts List */}
        {discussionPosts.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-outline rounded-[var(--radius-xs)] space-y-2">
            <p className="font-mono text-sm text-on-surface-muted">
              Belum ada diskusi di proyek ini. Mulai percakapan pertama untuk koordinasi tim!
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {discussionPosts.map((post) => {
              const isPostAuthor = user?.id === post.authorId;
              const canDeletePost = isPostAuthor || isOwner;
              
              return (
                <div
                  key={post.id}
                  className="p-4 sm:p-5 rounded-[var(--radius-xs)] border border-outline bg-surface-container/60 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="user-dot">{initials(post.author.fullName)}</span>
                      <div>
                        <p className="font-bold text-sm text-on-surface">{post.author.fullName}</p>
                        <p className="font-mono text-[11px] text-on-surface-muted">
                          {new Date(post.createdAt).toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>
                    {canDeletePost && (
                      <form action={deleteDiscussionPostAction}>
                        <input type="hidden" name="postId" value={post.id} />
                        <button
                          type="submit"
                          className="font-mono text-xs text-error hover:underline"
                          title="Hapus post diskusi"
                        >
                          Hapus
                        </button>
                      </form>
                    )}
                  </div>

                  <p className="whitespace-pre-wrap text-sm text-on-surface-body leading-relaxed pl-1">
                    {post.body}
                  </p>

                  {/* Single-Level Replies */}
                  {post.replies.length > 0 && (
                    <div className="ml-2 sm:ml-4 pl-3 sm:pl-4 border-l-2 border-primary/40 space-y-3 pt-1">
                      {post.replies.map((reply) => {
                        const isReplyAuthor = user?.id === reply.authorId;
                        const canDeleteReply = isReplyAuthor || isOwner;
                        
                        return (
                          <div
                            key={reply.id}
                            className="p-3 rounded border border-outline/50 bg-surface/80 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-container text-on-primary-container font-mono text-[10px] font-bold">
                                  {initials(reply.author.fullName)}
                                </span>
                                <span className="font-bold text-xs text-on-surface">{reply.author.fullName}</span>
                                <span className="font-mono text-[10px] text-on-surface-muted">
                                  · {new Date(reply.createdAt).toLocaleString("id-ID")}
                                </span>
                              </div>
                              {canDeleteReply && (
                                <form action={deleteDiscussionReplyAction}>
                                  <input type="hidden" name="replyId" value={reply.id} />
                                  <button
                                    type="submit"
                                    className="font-mono text-[11px] text-error hover:underline"
                                    title="Hapus balasan"
                                  >
                                    Hapus
                                  </button>
                                </form>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap text-xs text-on-surface-body leading-relaxed pl-1">
                              {reply.body}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reply Form */}
                  <details className="group pt-2">
                    <summary className="cursor-pointer font-mono text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                      <span>Balas ({post.replies.length})</span>
                      <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <form action={createDiscussionReplyAction} className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input type="hidden" name="postId" value={post.id} />
                      <input
                        name="body"
                        required
                        minLength={1}
                        maxLength={2000}
                        placeholder="Tulis balasan untuk post ini..."
                        className="md-field flex-1 text-xs"
                      />
                      <SubmitButton
                        className="md-btn md-btn-outlined md-btn-sm self-end sm:self-auto"
                        pendingLabel="Membalas..."
                      >
                        Kirim Balasan
                      </SubmitButton>
                    </form>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

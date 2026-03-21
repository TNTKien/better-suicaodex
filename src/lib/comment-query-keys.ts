export type CommentTargetType = "manga" | "chapter";

export const latestCommentsQueryKey = ["/api/comments/latest"] as const;

export function getCommentsQueryKey(type: CommentTargetType, id: string) {
  return [`/api/comments/${type}/${id}`] as const;
}

export function getCommentCountQueryKey(mangaId: string) {
  return [`comment-count-${mangaId}`] as const;
}

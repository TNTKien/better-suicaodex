import {
  ChapterComment,
  MangaComment,
  User,
} from "../../../prisma/generated/client";

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    image: user.image,
    createdAt: user.createdAt,
  };
}

export type MangaCommentWithUser = MangaComment & { user: User };
export type ChapterCommentWithUser = ChapterComment & { user: User };
export type CommentWithUser = MangaCommentWithUser | ChapterCommentWithUser;

export function serializeComment(comment: CommentWithUser) {
  const baseComment = {
    id: comment.id,
    title: comment.title || "",
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isEdited: comment.updatedAt.getTime() !== comment.createdAt.getTime(),
    reactions: comment.reactions || 0,
    user: serializeUser(comment.user),
  };

  // Determine if it's a manga comment or chapter comment
  if ("mangaId" in comment) {
    return {
      ...baseComment,
      mangaId: comment.mangaId,
      type: "manga" as const,
    };
  } else if ("chapterId" in comment) {
    return {
      ...baseComment,
      chapterId: comment.chapterId,
      chapterNumber: comment.chapterNumber,
      type: "chapter" as const,
    };
  }

  // Should never reach here, but TypeScript needs this
  return baseComment;
}

import type {
  ChapterCommentRow,
  MangaCommentRow,
  UserRow,
} from "@/lib/db/schema";

type CommentUser = Pick<
  UserRow,
  "id" | "name" | "displayName" | "image" | "createdAt"
>;

function normalizeCommentUserName(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue.toLowerCase() === "null") {
    return null;
  }

  return trimmedValue;
}

export function serializeUser(user: CommentUser) {
  const name =
    normalizeCommentUserName(user.displayName) ??
    normalizeCommentUserName(user.name);

  return {
    id: user.id,
    name,
    image: user.image,
    createdAt: user.createdAt,
  };
}

export type MangaCommentWithUser = MangaCommentRow & {
  user: CommentUser;
  replies?: MangaCommentWithUser[];
};
export type ChapterCommentWithUser = ChapterCommentRow & {
  user: CommentUser;
  replies?: ChapterCommentWithUser[];
};
export type CommentWithUser = MangaCommentWithUser | ChapterCommentWithUser;

export interface SerializedReply {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
  reactions: number;
  user: ReturnType<typeof serializeUser>;
  replies: SerializedReply[];
  type?: "manga" | "chapter";
  mangaId?: string;
  chapterId?: string;
  chapterNumber?: string;
}

export function serializeComment(comment: CommentWithUser): SerializedReply {
  const baseComment = {
    id: comment.id,
    title: comment.title ?? "",
    content: comment.content,
    parentId: comment.parentId ?? null,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isEdited: comment.isEdited,
    reactions: comment.reactions ?? 0,
    user: serializeUser(comment.user),
  };

  // Serialize replies if present (1 level deep only)
  const serializedReplies: SerializedReply[] = comment.replies
    ? comment.replies.map((reply) => serializeComment(reply as CommentWithUser))
    : [];

  // Determine if it's a manga comment or chapter comment
  if ("mangaId" in comment) {
    return {
      ...baseComment,
      mangaId: comment.mangaId,
      type: "manga" as const,
      replies: serializedReplies,
    };
  } else if ("chapterId" in comment) {
    return {
      ...baseComment,
      chapterId: comment.chapterId,
      chapterNumber: comment.chapterNumber,
      type: "chapter" as const,
      replies: serializedReplies,
    };
  }

  // Should never reach here, but TypeScript needs this
  return { ...baseComment, replies: serializedReplies };
}

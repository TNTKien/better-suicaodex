import type { CommentTargetType } from "@/lib/comment-query-keys";

export interface CommentApiError extends Error {
  status?: number;
}

export interface CommentUser {
  id: string;
  name: string | null;
  image: string | null;
  createdAt: string | Date;
}

export interface SerializedComment {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  isEdited: boolean;
  reactions: number;
  user: CommentUser;
  replies?: SerializedComment[];
  type?: CommentTargetType;
  mangaId?: string;
  chapterId?: string;
  chapterNumber?: string;
}

export interface LatestComment extends SerializedComment {
  type: CommentTargetType;
}

export interface CommentsResponse {
  comments: SerializedComment[];
  meta: {
    limit: number;
    offset: number;
    count: number;
    totalCount: number;
    hasNextPage: boolean;
  };
}

export interface CommentCountResponse {
  count: number;
}

export function createCommentApiError(status: number, message: string) {
  return Object.assign(new Error(message), { status }) as CommentApiError;
}

export async function fetchCommentJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const error = (await response
      .json()
      .catch((): { error: string } => ({ error: response.statusText }))) as {
      error?: string;
    };

    throw createCommentApiError(
      response.status,
      error.error ?? "Có lỗi xảy ra",
    );
  }

  return (await response.json()) as T;
}

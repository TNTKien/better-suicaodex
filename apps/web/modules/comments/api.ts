import type { components } from "@/src/lib/generated/api"

export type Comment = components["schemas"]["ChapterComment"]
export type CommentList = components["schemas"]["ChapterCommentList"]
export {
  CommentApiError,
  commentKey,
  commentOptions,
  createComment,
  updateComment,
  deleteComment,
  type CommentScope,
} from "@workspace/account/comments-api"

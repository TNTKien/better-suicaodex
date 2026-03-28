import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { GetV1CommentsChaptersById200DataItem } from "@/lib/moetruyen/model/getV1CommentsChaptersById200DataItem";
import type { GetV1CommentsChaptersById200DataItemRepliesItem } from "@/lib/moetruyen/model/getV1CommentsChaptersById200DataItemRepliesItem";
import { formatShortTime } from "@/lib/utils";

function AuthorAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <Avatar className="size-8 shrink-0 z-10">
      <AvatarImage src={avatarUrl ?? ""} alt={name} />
      <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function CommentBubble({ content }: { content: string }) {
  return (
    <div className="mt-1 inline-block max-w-full rounded-2xl bg-muted px-3 py-2">
      <p className="wrap-break-word whitespace-pre-wrap text-sm">{content}</p>
    </div>
  );
}

function ReplyItem({
  reply,
}: {
  reply: GetV1CommentsChaptersById200DataItemRepliesItem;
}) {
  return (
    <div className="flex gap-2">
      <AuthorAvatar
        name={reply.author.name}
        avatarUrl={reply.author.avatarUrl}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="line-clamp-1 text-sm font-semibold">
            {reply.author.name}
          </span>
        </div>
        <CommentBubble content={reply.content} />
        <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">
          {reply.createdAt ? formatShortTime(new Date(reply.createdAt)) : ""}
        </span>
      </div>
    </div>
  );
}

export default function MoeChapterCommentItem({
  comment,
}: {
  comment: GetV1CommentsChaptersById200DataItem;
}) {
  return (
    <Card className="overflow-hidden rounded-none border-none bg-transparent p-0 shadow-none">
      <CardContent className="p-0!">
        <div className="relative">
          <div className="flex gap-2">
            <AuthorAvatar
              name={comment.author.name}
              avatarUrl={comment.author.avatarUrl}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="line-clamp-1 text-sm font-semibold">
                  {comment.author.name}
                </span>
              </div>
              <CommentBubble content={comment.content} />
              <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">
                {comment.createdAt
                  ? formatShortTime(new Date(comment.createdAt))
                  : ""}
              </span>
            </div>
          </div>

          {comment.replies.length > 0 ? (
            <div className="relative mt-2 space-y-3">
              <div className="absolute bottom-0 left-4 top-[-9999px] w-0.5 bg-border" />
              {comment.replies.map((reply, index, arr) => {
                const isLast = index === arr.length - 1;

                return (
                  <div key={reply.id} className="relative pl-10">
                    <div className="absolute left-4 top-4 h-0.5 w-6 bg-border" />
                    {isLast ? (
                      <div className="absolute bottom-0 left-4 top-[17px] w-0.5 bg-sidebar" />
                    ) : null}
                    <ReplyItem reply={reply} />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

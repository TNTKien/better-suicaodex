"use client";

import { Alert, AlertTitle } from "../ui/alert";
import dynamic from "next/dynamic";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Send, Smile } from "lucide-react";
import { toast } from "sonner";
import { ButtonGroup, ButtonGroupSeparator } from "../ui/button-group";
import { Spinner } from "../ui/spinner";
import { authClient } from "@/lib/auth-client";
import {
  getCommentCountQueryKey,
  getCommentsQueryKey,
  latestCommentsQueryKey,
} from "@/lib/comment-query-keys";

const StickerPicker = dynamic(
  () => import("./sticker-picker").then((mod) => mod.StickerPicker),
  {
    ssr: false,
    loading: () => (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 dark:bg-secondary dark:hover:bg-secondary"
        disabled
      >
        <Smile className="h-4 w-4" />
      </Button>
    ),
  },
);

const MIN_COMMENT_LENGTH = 3;
const MAX_COMMENT_LENGTH = 2000;

const FormSchema = z.object({
  comment: z
    .string()
    .max(MAX_COMMENT_LENGTH, {
      message: `Bình luận không được dài hơn ${MAX_COMMENT_LENGTH} ký tự!`,
    })
    .refine((value) => value.trim().length >= MIN_COMMENT_LENGTH, {
      message: `Bình luận phải dài ít nhất ${MIN_COMMENT_LENGTH} ký tự!`,
    }),
});

interface CommentFormSimpleProps {
  id: string;
  type: "manga" | "chapter";
  title: string;
  chapterNumber?: string;
}

interface CreateCommentPayload {
  content: string;
  title: string;
  chapterNumber?: string;
}

interface CommentMutationError extends Error {
  status?: number;
}

export default function CommentFormSimple({
  id,
  type,
  title,
  chapterNumber,
}: CommentFormSimpleProps) {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      comment: "",
    },
  });
  const createCommentMutation = useMutation({
    mutationKey: ["create-comment", type, id],
    mutationFn: async (body: CreateCommentPayload) => {
      const response = await fetch(`/api/comments/${type}/${id}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw Object.assign(new Error("Comment request failed"), {
          status: response.status,
        }) as CommentMutationError;
      }

      return response;
    },
    onSuccess: async () => {
      form.reset();

      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: getCommentsQueryKey(type, id),
        }),
        queryClient.invalidateQueries({
          queryKey: latestCommentsQueryKey,
        }),
      ];

      if (type === "manga") {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: getCommentCountQueryKey(id),
          }),
        );
      }

      await Promise.all(invalidations);
    },
    onError: (error: CommentMutationError) => {
      if (error.status === 429) {
        toast.error("Rap chậm thôi bruh...😓", {
          closeButton: false,
        });
        return;
      }

      toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
    },
  });
  const handleFormSubmit = form.handleSubmit(onSubmit);
  const loading = createCommentMutation.isPending;

  if (!session?.user?.id)
    return (
      <Alert className="rounded-sm justify-center text-center">
        <AlertTitle>Bạn cần đăng nhập để bình luận!</AlertTitle>
      </Alert>
    );

  function onSubmit(data: z.infer<typeof FormSchema>) {
    const body: CreateCommentPayload = {
      content: data.comment.trim(),
      title,
    };

    if (chapterNumber) {
      body.chapterNumber = chapterNumber;
    }

    createCommentMutation.mutate(body);
  }

  const insertSticker = (stickerName: string) => {
    const currentValue = form.getValues("comment");
    const newValue = currentValue
      ? `${currentValue} :${stickerName}:`
      : `:${stickerName}:`;
    form.setValue("comment", newValue);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          void handleFormSubmit(event);
        }}
        className="w-full space-y-2"
      >
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative">
                  <Textarea
                    placeholder="Viết bình luận...(hỗ trợ markdown)"
                    className="bg-sidebar rounded-sm resize-none min-h-[115px]"
                    maxLength={MAX_COMMENT_LENGTH}
                    disabled={loading}
                    {...field}
                  />
                  <div className="absolute bottom-3 right-3">
                    <ButtonGroup>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="text-sm dark:bg-secondary dark:hover:bg-secondary"
                        size="sm"
                        variant="outline"
                      >
                        {loading ? <Spinner /> : <Send />}
                        Gửi bình luận
                      </Button>
                      <ButtonGroupSeparator />
                      <StickerPicker
                        onSelectSticker={insertSticker}
                        buttonClassName="dark:bg-secondary dark:hover:bg-secondary"
                      />
                    </ButtonGroup>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* <Button
          type="submit"
          disabled={loading}
          className="float-end text-xs"
          size="sm"
        >
          {!!loading ? <Loader2 className="animate-spin" /> : <Send />}
          Gửi bình luận
        </Button> */}
      </form>
    </Form>
  );
}

"use client";

import { Alert, AlertTitle } from "../ui/alert";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { StickerPicker } from "./sticker-picker";
import { ButtonGroup, ButtonGroupSeparator } from "../ui/button-group";
import { Spinner } from "../ui/spinner";
import { authClient } from "@/lib/auth-client";

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
  onCommentPosted?: () => void;
}

export default function CommentFormSimple({
  id,
  type,
  title,
  chapterNumber,
  onCommentPosted,
}: CommentFormSimpleProps) {
  const { data: session } = authClient.useSession();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      comment: "",
    },
  });
  const handleFormSubmit = form.handleSubmit(onSubmit);
  const [loading, setLoading] = useState(false);

  if (!session?.user?.id)
    return (
      <Alert className="rounded-sm justify-center text-center">
        <AlertTitle>Bạn cần đăng nhập để bình luận!</AlertTitle>
      </Alert>
    );

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    try {
      setLoading(true);
      const endpoint = `/api/comments/${type}/${id}`;

      const body: {
        content: string;
        title: string;
        chapterNumber?: string;
      } = {
        content: data.comment.trim(),
        title: title,
      };
      if (chapterNumber) {
        body.chapterNumber = chapterNumber;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Rap chậm thôi bruh...😓", {
            closeButton: false,
          });
        } else {
          toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
        }
        return;
      }

      form.reset();

      if (onCommentPosted) {
        onCommentPosted();
      }
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
    } finally {
      setLoading(false);
    }
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

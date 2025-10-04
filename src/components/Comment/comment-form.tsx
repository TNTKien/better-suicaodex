"use client";

import { useSession } from "next-auth/react";
import { Alert, AlertDescription } from "../ui/alert";
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
import { getContentLength } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "../Tiptap/rich-text-editor";

const FormSchema = z.object({
  comment: z
    .string()
    .refine((val) => getContentLength(val) >= 1, {
      message: "Bình luận phải dài ít nhất 1 ký tự!",
    })
    .refine((val) => getContentLength(val) <= 2000, {
      message: "Bình luận không được dài hơn 2000 ký tự!",
    }),
});

interface CommentFormProps {
  id: string;
  type: "manga" | "chapter";
  title: string;
  chapterNumber?: string;
  onCommentPosted?: () => void;
}

export default function CommentForm({
  id,
  type,
  title,
  chapterNumber,
  onCommentPosted,
}: CommentFormProps) {
  const { data: session } = useSession();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });
  const [loading, setLoading] = useState(false);
  const [shouldResetEditor, setShouldResetEditor] = useState(false);

  useEffect(() => {
    if (shouldResetEditor) {
      const timer = setTimeout(() => setShouldResetEditor(false), 0);
      return () => clearTimeout(timer);
    }
  }, [shouldResetEditor]);

  if (!session?.user?.id)
    return (
      <Alert className="rounded-sm bg-secondary">
        <AlertDescription className="flex justify-center">
          Bạn cần đăng nhập để bình luận!
        </AlertDescription>
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
        content: data.comment,
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

      // Trigger the editor reset
      setShouldResetEditor(true);

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-2">
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RichTextEditor
                  placeholder="Viết bình luận..."
                  className="bg-sidebar p-2 rounded-md border w-full"
                  maxLength={2000}
                  value={field.value}
                  onChange={(val) => {
                    field.onChange(val);
                  }}
                  reset={shouldResetEditor}
                  disabled={loading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={loading}>
          {!!loading ? <Loader2 className="animate-spin" /> : <Send />}
          Gửi bình luận
        </Button>
      </form>
    </Form>
  );
}

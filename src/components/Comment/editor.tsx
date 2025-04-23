"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Undo2,
  Redo2,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils"; // thêm nếu chưa có để xử lý class

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

export function TiptapEditor({
  value,
  onChange,
  maxLength = 2000,
}: TiptapEditorProps) {
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [charCount, setCharCount] = useState(0);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      setCharCount(editor.getText().length);

      const actives: string[] = [];
      if (editor.isActive("bold")) actives.push("bold");
      if (editor.isActive("italic")) actives.push("italic");
      if (editor.isActive("underline")) actives.push("underline");
      if (editor.isActive("strike")) actives.push("strike");
      setActiveFormats(actives);
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value]);

  if (!editor) return null;

  return (
    <div className="border rounded-md p-2 space-y-2 bg-sidebar">
      <div className="flex flex-wrap items-center gap-1 border-b pb-2">
        <ToggleGroup
          type="multiple"
          className="gap-1"
          variant="outline"
          value={activeFormats}
          size="sm"
        >
          <ToggleGroupItem
            value="bold"
            aria-label="Bold"
            onClick={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
            className="data-[state=on]:bg-primary/25"
          >
            <Bold className="w-4 h-4" />
          </ToggleGroupItem>

          <ToggleGroupItem
            value="italic"
            aria-label="Italic"
            onClick={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleItalic().run();
            }}
            className="data-[state=on]:bg-primary/25"
          >
            <Italic className="w-4 h-4" />
          </ToggleGroupItem>

          <ToggleGroupItem
            value="underline"
            aria-label="Underline"
            onClick={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleUnderline().run();
            }}
            className="data-[state=on]:bg-primary/25"
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToggleGroupItem>

          <ToggleGroupItem
            value="strike"
            aria-label="Strike"
            onClick={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleStrike().run();
            }}
            className="data-[state=on]:bg-primary/25"
          >
            <Strikethrough className="w-4 h-4" />
          </ToggleGroupItem>

          <ToggleGroupItem
            value="undo"
            aria-label="Undo"
            onClick={(e) => {
              e.preventDefault();
              editor.chain().focus().undo().run();
            }}
          >
            <Undo2 className="w-4 h-4" />
          </ToggleGroupItem>

          <ToggleGroupItem
            value="redo"
            aria-label="Redo"
            onClick={(e) => {
              e.preventDefault();
              editor.chain().focus().redo().run();
            }}
          >
            <Redo2 className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <EditorContent
        editor={editor}
        className="prose break-all prose-sm !max-w-full dark:prose-invert prose-p:my-0 min-h-[7rem] outline-none focus:outline-none [&>*]:outline-none [&>*]:min-h-[7rem]"
      />

      {/* Footer bộ đếm ký tự */}
      <div className="flex justify-end text-xs text-muted-foreground px-1">
        <span className={cn(charCount > maxLength && "text-destructive")}>
          {charCount}/{maxLength}
        </span>
      </div>
    </div>
  );
}

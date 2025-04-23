"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Superscript from "@tiptap/extension-superscript";
import SubScript from "@tiptap/extension-subscript";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Bold,
  Strikethrough,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Link as LinkIcon,
  Quote,
  List,
  ListOrdered,
  RemoveFormattingIcon,
  Unlink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Code,
  Highlighter,
  Subscript,
  Superscript as SuperscriptIcon,
  Minus,
  Undo,
  Redo,
} from "lucide-react";
import Link from "@tiptap/extension-link";
import { cn } from "@/lib/utils";
import Placeholder from "@tiptap/extension-placeholder";
import "./rich-text-editor.css";

interface RichTextEditorProps {
  value?: string;
  placeholder?: string;
  onChange?: (content: string) => void;
  className?: string;
}

export function RichTextEditor({
  value = "",
  onChange,
  placeholder = "",
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Underline,
      Highlight,
      Link,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Superscript,
      SubScript,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "block border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "prose prose-sm sm:prose-base max-w-full"
        ),
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <ToggleGroup type="multiple" size="sm" variant="outline">
          <ToggleGroupItem
            value="bold"
            aria-label="Toggle bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            data-state={editor.isActive("bold") ? "on" : "off"}
          >
            <Bold className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="strike"
            aria-label="Toggle strikethrough"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run()}
            data-state={editor.isActive("strike") ? "on" : "off"}
          >
            <Strikethrough className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="italic"
            aria-label="Toggle italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            data-state={editor.isActive("italic") ? "on" : "off"}
          >
            <Italic className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="underline"
            aria-label="Toggle underline"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            disabled={!editor.can().chain().focus().toggleUnderline().run()}
            data-state={editor.isActive("underline") ? "on" : "off"}
          >
            <UnderlineIcon className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="code"
            aria-label="Toggle code"
            onClick={() => editor.chain().focus().toggleCode().run()}
            disabled={!editor.can().chain().focus().toggleCode().run()}
            data-state={editor.isActive("code") ? "on" : "off"}
          >
            <Code className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="highlight"
            aria-label="Toggle highlight"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            disabled={!editor.can().chain().focus().toggleHighlight().run()}
            data-state={editor.isActive("highlight") ? "on" : "off"}
          >
            <Highlighter className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="clear"
            aria-label="Clear formatting"
            onClick={() =>
              editor.chain().focus().clearNodes().unsetAllMarks().run()
            }
            disabled={
              !editor.can().chain().focus().clearNodes().unsetAllMarks().run()
            }
            data-state="off"
          >
            <RemoveFormattingIcon className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup type="single" size="sm" variant="outline">
          <ToggleGroupItem
            value="h1"
            aria-label="Heading 1"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            disabled={
              !editor.can().chain().focus().toggleHeading({ level: 1 }).run()
            }
            data-state={editor.isActive("heading", { level: 1 }) ? "on" : "off"}
          >
            <Heading1 className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="h2"
            aria-label="Heading 2"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            disabled={
              !editor.can().chain().focus().toggleHeading({ level: 2 }).run()
            }
            data-state={editor.isActive("heading", { level: 2 }) ? "on" : "off"}
          >
            <Heading2 className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="h3"
            aria-label="Heading 3"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            disabled={
              !editor.can().chain().focus().toggleHeading({ level: 3 }).run()
            }
            data-state={editor.isActive("heading", { level: 3 }) ? "on" : "off"}
          >
            <Heading3 className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="h4"
            aria-label="Heading 4"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 4 }).run()
            }
            disabled={
              !editor.can().chain().focus().toggleHeading({ level: 4 }).run()
            }
            data-state={editor.isActive("heading", { level: 4 }) ? "on" : "off"}
          >
            <Heading4 className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup type="multiple" size="sm" variant="outline">
          <ToggleGroupItem
            value="blockquote"
            aria-label="Toggle blockquote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            disabled={!editor.can().chain().focus().toggleBlockquote().run()}
            data-state={editor.isActive("blockquote") ? "on" : "off"}
          >
            <Quote className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="bulletList"
            aria-label="Toggle bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={!editor.can().chain().focus().toggleBulletList().run()}
            data-state={editor.isActive("bulletList") ? "on" : "off"}
          >
            <List className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="orderedList"
            aria-label="Toggle ordered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={!editor.can().chain().focus().toggleOrderedList().run()}
            data-state={editor.isActive("orderedList") ? "on" : "off"}
          >
            <ListOrdered className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="horizontalRule"
            aria-label="Add horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            disabled={!editor.can().chain().focus().setHorizontalRule().run()}
            data-state="off"
          >
            <Minus className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="superscript"
            aria-label="Toggle superscript"
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            disabled={!editor.can().chain().focus().toggleSuperscript().run()}
            data-state={editor.isActive("superscript") ? "on" : "off"}
          >
            <SuperscriptIcon className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="subscript"
            aria-label="Toggle subscript"
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            disabled={!editor.can().chain().focus().toggleSubscript().run()}
            data-state={editor.isActive("subscript") ? "on" : "off"}
          >
            <Subscript className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup type="single" size="sm" variant="outline">
          <ToggleGroupItem
            value="link"
            aria-label="Add link"
            onClick={() => {
              const url = window.prompt("Enter URL");
              if (url) {
                editor
                  .chain()
                  .focus()
                  .setLink({
                    href: url,
                    target: "_blank",
                    rel: "noopener noreferrer",
                  })
                  .run();
              }
            }}
            disabled={
              !editor
                .can()
                .chain()
                .focus()
                .setLink({ href: "https://example.com" })
                .run()
            }
            data-state={editor.isActive("link") ? "on" : "off"}
          >
            <LinkIcon className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="link"
            aria-label="Add link"
            onClick={() => {
              editor.chain().focus().unsetLink().run();
            }}
            disabled={!editor.can().chain().focus().unsetLink().run()}
          >
            <Unlink className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup type="single" size="sm" variant="outline">
          <ToggleGroupItem
            value="left"
            aria-label="Align left"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            disabled={!editor.can().chain().focus().setTextAlign("left").run()}
            data-state={editor.isActive({ textAlign: "left" }) ? "on" : "off"}
          >
            <AlignLeft className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="center"
            aria-label="Align center"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            disabled={
              !editor.can().chain().focus().setTextAlign("center").run()
            }
            data-state={editor.isActive({ textAlign: "center" }) ? "on" : "off"}
          >
            <AlignCenter className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="right"
            aria-label="Align right"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            disabled={!editor.can().chain().focus().setTextAlign("right").run()}
            data-state={editor.isActive({ textAlign: "right" }) ? "on" : "off"}
          >
            <AlignRight className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="justify"
            aria-label="Align justify"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            disabled={
              !editor.can().chain().focus().setTextAlign("justify").run()
            }
            data-state={
              editor.isActive({ textAlign: "justify" }) ? "on" : "off"
            }
          >
            <AlignJustify className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup type="single" size="sm" variant="outline">
          <ToggleGroupItem
            value="undo"
            aria-label="Undo"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
          >
            <Undo className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="redo"
            aria-label="Redo"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
          >
            <Redo className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline, Strikethrough, Code,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare,
  Quote, Minus, Code2,
  Link, Image, Paperclip, Table,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  editor: Editor | null;
  onImageUpload: () => void;
  onFileAttach: () => void;
}

function ToolbarButton({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors",
        active ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80 hover:bg-white/5"
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-white/10 mx-1" />;
}

export function EditorToolbar({ editor, onImageUpload, onFileAttach }: Props) {
  if (!editor) return null;

  function setLink() {
    const url = prompt("Enter URL:");
    if (url) {
      editor!.chain().focus().setLink({ href: url }).run();
    }
  }

  function insertTable() {
    editor!.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  return (
    <div className="flex items-center flex-wrap gap-0.5 py-2 border-b border-white/5">
      <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-md px-1 py-0.5">
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <Underline className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">
          <Code className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <Separator />

      <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-md px-1 py-0.5">
        <ToolbarButton active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <Separator />

      <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-md px-1 py-0.5">
        <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task list">
          <CheckSquare className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <Separator />

      <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-md px-1 py-0.5">
        <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block">
          <Code2 className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <Separator />

      <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-md px-1 py-0.5">
        <ToolbarButton active={editor.isActive("link")} onClick={setLink} title="Link">
          <Link className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={onImageUpload} title="Image">
          <Image className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={onFileAttach} title="File attachment">
          <Paperclip className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={insertTable} title="Table">
          <Table className="w-4 h-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

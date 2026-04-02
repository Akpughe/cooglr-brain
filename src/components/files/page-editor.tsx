"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "./editor-toolbar";
import { useWorkspace } from "@/lib/workspace/context";
import type { FileNode } from "@/lib/files/types";

interface Props {
  file: FileNode;
  onUpdate: (updates: Partial<FileNode>) => void;
}

export function PageEditor({ file, onUpdate }: Props) {
  const { workspace } = useWorkspace();
  const [title, setTitle] = useState(file.title);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
    content: file.content || undefined,
    onUpdate: ({ editor }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onUpdate({ content: editor.getJSON() as Record<string, unknown> });
      }, 1000);
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[300px] py-4",
      },
    },
  });

  useEffect(() => { setTitle(file.title); }, [file.title]);

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      onUpdate({ title: newTitle || "Untitled" });
    }, 1000);
  }

  const handleImageUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const formData = new FormData();
      formData.append("file", f);
      formData.append("workspaceId", workspace.id);
      const res = await fetch("/api/files/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        editor?.chain().focus().setImage({ src: data.url }).run();
      }
    };
    input.click();
  }, [editor, workspace.id]);

  const handleFileAttach = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const formData = new FormData();
      formData.append("file", f);
      formData.append("workspaceId", workspace.id);
      const res = await fetch("/api/files/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.file) {
        const url = `/${workspace.slug}/files/${data.file.id}`;
        editor?.chain().focus().insertContent(`📎 [${data.file.title}](${url})`).run();
      }
    };
    input.click();
  }, [editor, workspace.id, workspace.slug]);

  async function handleCoverUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const formData = new FormData();
      formData.append("file", f);
      formData.append("workspaceId", workspace.id);
      const res = await fetch("/api/files/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) onUpdate({ coverUrl: data.url });
    };
    input.click();
  }

  function handleIconClick() {
    const emojis = ["📄", "📝", "📋", "📌", "📎", "🎯", "🚀", "💡", "🔧", "📊", "🎨", "🏗️", "📦", "🔒", "✅", "⭐", "🔥", "💬", "📚", "🗂️"];
    const picked = prompt(`Pick an emoji icon:\n${emojis.join(" ")}\n\nOr type your own:`);
    if (picked) onUpdate({ icon: picked.trim().slice(0, 2) });
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      {file.coverUrl ? (
        <div className="h-[160px] relative group bg-cover bg-center" style={{ backgroundImage: `url(${file.coverUrl})` }}>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCoverUpload} className="text-[11px] bg-black/50 px-2 py-1 rounded text-white/70 hover:text-white">Change cover</button>
            <button onClick={() => onUpdate({ coverUrl: null })} className="text-[11px] bg-black/50 px-2 py-1 rounded text-white/70 hover:text-white">Remove</button>
          </div>
        </div>
      ) : null}

      <div className="max-w-[720px] mx-auto px-8">
        <div className={file.coverUrl ? "-mt-7" : "mt-8"}>
          <button onClick={handleIconClick} className="text-[48px] leading-none hover:opacity-80 transition-opacity">
            {file.icon || "📄"}
          </button>
        </div>

        <div className="flex gap-2 mt-1 opacity-40 hover:opacity-70 transition-opacity text-[12px]">
          {!file.coverUrl && (
            <button onClick={handleCoverUpload} className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10">
              🖼 Add cover
            </button>
          )}
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="w-full text-[32px] font-bold bg-transparent border-0 outline-none mt-4 placeholder:text-white/20"
        />

        <EditorToolbar editor={editor} onImageUpload={handleImageUpload} onFileAttach={handleFileAttach} />

        <EditorContent editor={editor} className="pb-20" />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import BubbleMenuExtension from "@tiptap/extension-bubble-menu";
import { EditorToolbar } from "./editor-toolbar";
import { EditorBubbleMenu } from "./bubble-menu";
import { EmojiPicker } from "./emoji-picker";
import { useWorkspace } from "@/lib/workspace/context";
import type { FileNode } from "@/lib/files/types";
import { toast } from "sonner";

interface Props {
  file: FileNode;
  onUpdate: (updates: Partial<FileNode>) => void;
}

export function PageEditor({ file, onUpdate }: Props) {
  const { workspace } = useWorkspace();
  const [title, setTitle] = useState(file.title);
  const [localCoverUrl, setLocalCoverUrl] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
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
      BubbleMenuExtension,
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

  // Clear local cover when real cover URL arrives
  useEffect(() => {
    if (file.coverUrl) setLocalCoverUrl(null);
  }, [file.coverUrl]);

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
      } else {
        toast.error("Failed to upload image");
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
      toast.loading("Uploading...", { id: "attach" });
      const formData = new FormData();
      formData.append("file", f);
      formData.append("workspaceId", workspace.id);
      const res = await fetch("/api/files/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.file) {
        const url = `/${workspace.slug}/files/${data.file.id}`;
        editor?.chain().focus().insertContent(`📎 [${data.file.title}](${url})`).run();
        toast.success("File attached", { id: "attach" });
      } else {
        toast.error("Failed to attach file", { id: "attach" });
      }
    };
    input.click();
  }, [editor, workspace.id, workspace.slug]);

  // Optimistic cover upload — show instant local preview
  async function handleCoverUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;

      // Instant local preview
      const localUrl = URL.createObjectURL(f);
      setLocalCoverUrl(localUrl);

      // Upload in background
      const formData = new FormData();
      formData.append("file", f);
      formData.append("workspaceId", workspace.id);
      const res = await fetch("/api/files/upload-image", { method: "POST", body: formData });
      const data = await res.json();

      if (data.url) {
        onUpdate({ coverUrl: data.url });
        // localCoverUrl will be cleared by the useEffect when file.coverUrl updates
      } else {
        setLocalCoverUrl(null);
        toast.error("Failed to upload cover image");
      }

      URL.revokeObjectURL(localUrl);
    };
    input.click();
  }

  function handleRemoveCover() {
    setLocalCoverUrl(null);
    onUpdate({ coverUrl: null });
  }

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    };
  }, []);

  const displayCoverUrl = localCoverUrl || file.coverUrl;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Cover image */}
      {displayCoverUrl ? (
        <div className="h-[160px] relative group bg-cover bg-center" style={{ backgroundImage: `url(${displayCoverUrl})` }}>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCoverUpload} className="text-[11px] bg-black/50 px-2 py-1 rounded text-white/70 hover:text-white">Change cover</button>
            <button onClick={handleRemoveCover} className="text-[11px] bg-black/50 px-2 py-1 rounded text-white/70 hover:text-white">Remove</button>
          </div>
        </div>
      ) : null}

      <div className="max-w-[720px] mx-auto px-8">
        {/* Icon — emoji picker popover */}
        <div className={displayCoverUrl ? "-mt-7" : "mt-8"}>
          <EmojiPicker
            currentEmoji={file.icon}
            onSelect={(emoji) => onUpdate({ icon: emoji })}
            onRemove={() => onUpdate({ icon: null })}
          />
        </div>

        {/* Add cover button */}
        <div className="flex gap-2 mt-1 opacity-40 hover:opacity-70 transition-opacity text-[12px]">
          {!displayCoverUrl && (
            <button onClick={handleCoverUpload} className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10">
              🖼 Add cover
            </button>
          )}
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="w-full text-[32px] font-bold bg-transparent border-0 outline-none mt-4 placeholder:text-white/20"
        />

        {/* Static toolbar for block-level actions */}
        <EditorToolbar editor={editor} onImageUpload={handleImageUpload} onFileAttach={handleFileAttach} />

        {/* Bubble menu for inline formatting on text selection */}
        {editor && <EditorBubbleMenu editor={editor} />}

        {/* Editor content */}
        <EditorContent editor={editor} className="pb-20" />
      </div>
    </div>
  );
}

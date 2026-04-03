"use client";

import { useEffect, useState, useRef, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline, Strikethrough, Code,
  Heading1, Heading2, Heading3,
  Link, Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  editor: Editor;
  containerRef: RefObject<HTMLDivElement | null>;
}

function BubbleButton({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors",
        active ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}

export function EditorBubbleMenu({ editor, containerRef }: Props) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleSelectionUpdate() {
      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;
      const text = editor.state.doc.textBetween(from, to, " ");

      if (!hasSelection || !text.trim()) {
        setShow(false);
        setShowLinkInput(false);
        return;
      }

      // Get position from DOM selection
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) { setShow(false); return; }

      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (!containerRect || rect.width === 0) { setShow(false); return; }

      setPos({
        top: rect.top - containerRect.top - 48,
        left: rect.left - containerRect.left + rect.width / 2,
      });
      setShow(true);
    }

    editor.on("selectionUpdate", handleSelectionUpdate);
    editor.on("blur", () => {
      // Delay to allow button clicks to register
      setTimeout(() => {
        if (!menuRef.current?.contains(document.activeElement)) {
          setShow(false);
          setShowLinkInput(false);
        }
      }, 150);
    });

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor, containerRef]);

  function handleSetLink() {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }

  function handleLinkClick() {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
    } else {
      setShowLinkInput(true);
    }
  }

  if (!show) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 flex items-center gap-0.5 bg-[#1e1e2e] border border-white/10 rounded-lg px-1.5 py-1 shadow-2xl"
      style={{
        top: pos.top,
        left: pos.left,
        transform: "translateX(-50%)",
      }}
    >
      {showLinkInput ? (
        <div className="flex items-center gap-1 px-1">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSetLink(); if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl(""); } }}
            placeholder="Paste link..."
            className="bg-transparent text-sm outline-none w-48 text-white placeholder:text-white/30"
            autoFocus
          />
          <button onMouseDown={(e) => { e.preventDefault(); handleSetLink(); }} className="text-xs text-indigo-400 hover:text-indigo-300 px-1.5 py-0.5 rounded bg-white/5">
            Add
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); setShowLinkInput(false); setLinkUrl(""); }} className="text-xs text-white/40 hover:text-white/60 px-1">
            &times;
          </button>
        </div>
      ) : (
        <>
          <BubbleButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
            <Bold className="w-3.5 h-3.5" />
          </BubbleButton>
          <BubbleButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
            <Italic className="w-3.5 h-3.5" />
          </BubbleButton>
          <BubbleButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
            <Underline className="w-3.5 h-3.5" />
          </BubbleButton>
          <BubbleButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
            <Strikethrough className="w-3.5 h-3.5" />
          </BubbleButton>
          <BubbleButton active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">
            <Code className="w-3.5 h-3.5" />
          </BubbleButton>

          <div className="w-px h-4 bg-white/10 mx-0.5" />

          <BubbleButton active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
            <Heading1 className="w-3.5 h-3.5" />
          </BubbleButton>
          <BubbleButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
            <Heading2 className="w-3.5 h-3.5" />
          </BubbleButton>
          <BubbleButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
            <Heading3 className="w-3.5 h-3.5" />
          </BubbleButton>

          <div className="w-px h-4 bg-white/10 mx-0.5" />

          <BubbleButton active={editor.isActive("link")} onClick={handleLinkClick} title={editor.isActive("link") ? "Remove link" : "Add link"}>
            <Link className="w-3.5 h-3.5" />
          </BubbleButton>
          <BubbleButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
            <Quote className="w-3.5 h-3.5" />
          </BubbleButton>
        </>
      )}
    </div>
  );
}

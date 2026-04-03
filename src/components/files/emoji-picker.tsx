"use client";

import { useState, useRef, useEffect } from "react";

const EMOJI_GROUPS = [
  { label: "Pages", emojis: ["📄", "📝", "📋", "📓", "📔", "📒", "📕", "📗", "📘", "📙"] },
  { label: "Objects", emojis: ["🎯", "🚀", "💡", "🔧", "📊", "🎨", "📦", "🗂️", "📚", "🗃️"] },
  { label: "Symbols", emojis: ["✅", "⭐", "🔥", "💬", "❤️", "⚡", "🌟", "💎", "🏆", "🎉"] },
  { label: "Nature", emojis: ["🌱", "🌿", "🍃", "🌸", "🌺", "🌻", "🍀", "🌈", "☀️", "🌙"] },
  { label: "Hands", emojis: ["👋", "👍", "👏", "🤝", "✌️", "🤞", "💪", "🙌", "🎵", "🔔"] },
];

interface Props {
  currentEmoji: string | null;
  onSelect: (emoji: string) => void;
  onRemove: () => void;
}

export function EmojiPicker({ currentEmoji, onSelect, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-[48px] leading-none hover:opacity-80 transition-opacity"
      >
        {currentEmoji || "📄"}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-[#1e1e2e] border border-white/10 rounded-xl shadow-2xl p-3 w-[280px]">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1 px-0.5">{group.label}</p>
              <div className="flex flex-wrap gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { onSelect(emoji); setOpen(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {currentEmoji && (
            <button
              onClick={() => { onRemove(); setOpen(false); }}
              className="w-full mt-1 text-xs text-red-400/60 hover:text-red-400 py-1.5 rounded-md hover:bg-white/5 transition-colors"
            >
              Remove icon
            </button>
          )}
        </div>
      )}
    </div>
  );
}

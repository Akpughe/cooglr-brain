"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace, useCurrentUserId } from "@/lib/workspace/context";

export function UserMenu() {
  const router = useRouter();
  const { members } = useWorkspace();
  const currentUserId = useCurrentUserId();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentMember = members.find((m) => m.userId === currentUserId);
  const initial = currentMember?.fullName?.[0]?.toUpperCase() || currentMember?.email?.[0]?.toUpperCase() || "?";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="relative mt-2" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="User menu"
        aria-expanded={open}
        className="flex size-8 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background shadow-sm transition-transform duration-150 hover:scale-105"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute left-[52px] bottom-0 z-50 w-56 animate-in fade-in slide-in-from-left-2 rounded-lg border border-border bg-popover py-1.5 shadow-surface-lg duration-150">
          {/* User info */}
          <div className="px-3 py-2.5 border-b border-border">
            <div className="font-medium text-sm truncate">
              {currentMember?.fullName || "User"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {currentMember?.email || ""}
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{signingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

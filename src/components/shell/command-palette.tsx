"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { cn } from "@/lib/utils";
import {
  Search,
  MessageSquare,
  FolderKanban,
  FileText,
  Calendar,
  Settings,
  Mail,
  BarChart3,
  Plus,
  UserPlus,
  Moon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  group: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const pathname = usePathname();
  const { workspace, installedApps } = useWorkspace();

  const slug = workspace.slug;

  // -----------------------------------------------------------------------
  // Build command list
  // -----------------------------------------------------------------------

  const commands = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      {
        id: "nav-messages",
        label: "Go to Messages",
        icon: <MessageSquare className="size-4 text-muted-foreground" />,
        action: () => router.push(`/${slug}/messages`),
        group: "Navigation",
      },
      {
        id: "nav-projects",
        label: "Go to Projects",
        icon: <FolderKanban className="size-4 text-muted-foreground" />,
        action: () => router.push(`/${slug}/projects`),
        group: "Navigation",
      },
      {
        id: "nav-files",
        label: "Go to Files",
        icon: <FileText className="size-4 text-muted-foreground" />,
        action: () => router.push(`/${slug}/files`),
        group: "Navigation",
      },
      {
        id: "nav-calendar",
        label: "Go to Calendar",
        icon: <Calendar className="size-4 text-muted-foreground" />,
        action: () => router.push(`/${slug}/calendar`),
        group: "Navigation",
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        icon: <Settings className="size-4 text-muted-foreground" />,
        shortcut: "⌘,",
        action: () => router.push(`/${slug}/settings`),
        group: "Navigation",
      },
    ];

    // Conditionally add app-specific navigation if installed
    const hasEmailMarketing = installedApps.some(
      (a) => a.route === "email-marketing",
    );
    if (hasEmailMarketing) {
      nav.push({
        id: "nav-email-marketing",
        label: "Go to Email Marketing",
        icon: <Mail className="size-4 text-muted-foreground" />,
        action: () => router.push(`/${slug}/email-marketing`),
        group: "Navigation",
      });
    }

    const hasReports = installedApps.some((a) => a.route === "reports");
    if (hasReports) {
      nav.push({
        id: "nav-reports",
        label: "Go to Reports",
        icon: <BarChart3 className="size-4 text-muted-foreground" />,
        action: () => router.push(`/${slug}/reports`),
        group: "Navigation",
      });
    }

    const actions: CommandItem[] = [
      {
        id: "action-new-project",
        label: "Create new project",
        icon: <Plus className="size-4 text-muted-foreground" />,
        action: () => router.push(`/${slug}/projects?new=1`),
        group: "Actions",
      },
      {
        id: "action-new-channel",
        label: "Create new channel",
        icon: <Plus className="size-4 text-muted-foreground" />,
        action: () => router.push(`/${slug}/messages?new-channel=1`),
        group: "Actions",
      },
      {
        id: "action-invite",
        label: "Invite team member",
        icon: <UserPlus className="size-4 text-muted-foreground" />,
        action: () => router.push(`/${slug}/settings/members?invite=1`),
        group: "Actions",
      },
    ];

    const theme: CommandItem[] = [
      {
        id: "theme-dark-mode",
        label: "Toggle dark mode",
        icon: <Moon className="size-4 text-muted-foreground" />,
        action: () => {
          document.documentElement.classList.toggle("dark");
        },
        group: "Theme",
      },
    ];

    return [...nav, ...actions, ...theme];
  }, [slug, router, installedApps]);

  // -----------------------------------------------------------------------
  // Filtered & grouped results
  // -----------------------------------------------------------------------

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  // Group ordering
  const groups = useMemo(() => {
    const order = ["Navigation", "Actions", "Theme"];
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return order
      .filter((g) => map.has(g))
      .map((g) => ({ label: g, items: map.get(g)! }));
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(
    () => groups.flatMap((g) => g.items),
    [groups],
  );

  // -----------------------------------------------------------------------
  // Open / close
  // -----------------------------------------------------------------------

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
  }, []);

  // Global keyboard shortcut to open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          openPalette();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, openPalette, closePalette]);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      // Small delay so the DOM is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Reset active index when filtered results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // -----------------------------------------------------------------------
  // Execute selected command
  // -----------------------------------------------------------------------

  const execute = useCallback(
    (item: CommandItem) => {
      closePalette();
      item.action();
    },
    [closePalette],
  );

  // -----------------------------------------------------------------------
  // Keyboard navigation inside palette
  // -----------------------------------------------------------------------

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < flatItems.length - 1 ? prev + 1 : 0,
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : flatItems.length - 1,
        );
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[activeIndex];
        if (item) execute(item);
        return;
      }

      // Focus trap: shift+tab from input does nothing (keeps focus in input)
      if (e.key === "Tab") {
        e.preventDefault();
      }
    },
    [closePalette, flatItems, activeIndex, execute],
  );

  // -----------------------------------------------------------------------
  // Scroll active item into view
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;
    const activeEl = listRef.current?.querySelector(
      `[data-index="${activeIndex}"]`,
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // -----------------------------------------------------------------------
  // Backdrop click
  // -----------------------------------------------------------------------

  const onBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        closePalette();
      }
    },
    [closePalette],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!open) return null;

  let itemIndex = -1;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[20vh] animate-in fade-in"
      onClick={onBackdropClick}
    >
      <div className="max-w-lg w-full rounded-lg shadow-surface-lg border border-border bg-popover animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center border-b border-border px-1">
          <Search className="ml-3 size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Type a command or search..."
            className="h-10 flex-1 px-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto p-1.5">
          {flatItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-1">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  itemIndex++;
                  const idx = itemIndex;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-sm rounded-md cursor-default text-left",
                        idx === activeIndex && "bg-muted",
                      )}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => execute(item)}
                      tabIndex={-1}
                      type="button"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

interface SidebarProps {
  email: string;
  isAdmin: boolean;
}

export function Sidebar({ email, isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [autoCollapsed, setAutoCollapsed] = useState(false);

  useEffect(() => {
    function handleResize() {
      setAutoCollapsed(window.innerWidth < 1024);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isCollapsed = collapsed || autoCollapsed;

  const nav = [
    {
      items: [
        { label: "Dashboard", href: "/", icon: "dashboard" as const },
        { label: "Chat", href: "/chat", icon: "chat" as const },
      ],
    },
    {
      label: "Work",
      items: [
        { label: "Repos", href: "/repos", icon: "repos" as const },
        { label: "Tickets", href: "/tickets", icon: "tickets" as const },
      ],
    },
    {
      label: "Insights",
      items: [
        { label: "Reports", href: "/reports", icon: "reports" as const },
        { label: "Emails", href: "/emails", icon: "emails" as const },
      ],
    },
    {
      label: "System",
      items: [
        { label: "Settings", href: "/settings", icon: "settings" as const },
        ...(isAdmin ? [{ label: "Admin", href: "/admin", icon: "admin" as const }] : []),
      ],
    },
  ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 h-full bg-sidebar transition-[width] duration-200 ease-out",
        isCollapsed ? "w-[64px]" : "w-[220px]"
      )}
    >
      {/* Brand */}
      <div className={cn(
        "flex items-center h-[52px] shrink-0",
        isCollapsed ? "justify-center" : "px-4"
      )}>
        <a href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[10px] bg-primary flex items-center justify-center shadow-surface">
            <span className="text-[11px] font-black text-primary-foreground tracking-tight">5C</span>
          </div>
          {!isCollapsed && (
            <span className="text-[15px] font-semibold text-foreground tracking-[-0.03em]">
              500Claw
            </span>
          )}
        </a>
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 overflow-y-auto pt-2 pb-3", isCollapsed ? "px-2" : "px-2.5")}>
        {nav.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-5" : ""}>
            {group.label && !isCollapsed && (
              <div className="px-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
                  {group.label}
                </span>
              </div>
            )}
            {group.label && isCollapsed && gi > 0 && (
              <div className="mx-2 mb-2 h-px bg-sidebar-border" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={cn(
                      "group/item relative flex items-center rounded-[8px] transition-all duration-150",
                      isCollapsed ? "justify-center h-10 w-10 mx-auto" : "gap-2.5 h-9 px-2.5",
                      active
                        ? "bg-sidebar-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                    )}
                  >
                    {active && !isCollapsed && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3.5 rounded-r-full bg-primary" />
                    )}
                    <span className={cn(
                      "shrink-0 transition-colors duration-150",
                      active ? "text-primary" : "group-hover/item:text-foreground"
                    )}>
                      <NavIcon name={item.icon} />
                    </span>
                    {!isCollapsed && (
                      <span className={cn("text-[13px]", active ? "font-medium" : "font-normal")}>
                        {item.label}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn(
        "shrink-0 border-t border-sidebar-border py-2",
        isCollapsed ? "px-2 flex flex-col items-center gap-1" : "px-2.5 space-y-1"
      )}>
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center" : "gap-1 px-0.5"
        )}>
          <ThemeToggle />
          {!autoCollapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center w-8 h-8 rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-all duration-150"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {isCollapsed ? (
                  <><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></>
                ) : (
                  <><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></>
                )}
              </svg>
            </button>
          )}
        </div>
        {!isCollapsed && (
          <div className="px-2 pb-1">
            <p className="text-[11px] text-muted-foreground/50 truncate">{email}</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavIcon({ name }: { name: string }) {
  const props = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "dashboard":
      return <svg {...props}><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>;
    case "chat":
      return <svg {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case "repos":
      return <svg {...props}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>;
    case "tickets":
      return <svg {...props}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13h4"/><path d="M10 17h4"/><path d="M10 9h1"/></svg>;
    case "reports":
      return <svg {...props}><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>;
    case "emails":
      return <svg {...props}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
    case "settings":
      return <svg {...props}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "admin":
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="4"/></svg>;
  }
}

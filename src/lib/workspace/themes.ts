export interface WorkspaceTheme {
  id: string;
  name: string;
  railBg: string;
  railIcon: string;
  railIconActive: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarTextMuted: string;
  sidebarHover: string;
  sidebarActive: string;
  accent: string;
}

export const THEMES: WorkspaceTheme[] = [
  {
    id: "default",
    name: "Default",
    railBg: "#f5f5f5",
    railIcon: "#888888",
    railIconActive: "#1a1a1a",
    sidebarBg: "#ffffff",
    sidebarText: "#1a1a1a",
    sidebarTextMuted: "#999999",
    sidebarHover: "#f0f0f0",
    sidebarActive: "#f5f5f5",
    accent: "#1a1a1a",
  },
  {
    id: "warm-earth",
    name: "Warm Earth",
    railBg: "#f5f2ed",
    railIcon: "#78716c",
    railIconActive: "#c2410c",
    sidebarBg: "#faf8f5",
    sidebarText: "#1c1917",
    sidebarTextMuted: "#a8a29e",
    sidebarHover: "#e7e0d5",
    sidebarActive: "#f5f2ed",
    accent: "#c2410c",
  },
  {
    id: "midnight",
    name: "Midnight",
    railBg: "#1e1b2e",
    railIcon: "#8b85a0",
    railIconActive: "#c4b5fd",
    sidebarBg: "#272340",
    sidebarText: "#e8e5f0",
    sidebarTextMuted: "#8b85a0",
    sidebarHover: "#332e50",
    sidebarActive: "#3d3760",
    accent: "#c4b5fd",
  },
  {
    id: "ocean",
    name: "Ocean",
    railBg: "#eff6ff",
    railIcon: "#64748b",
    railIconActive: "#2563eb",
    sidebarBg: "#f8fafc",
    sidebarText: "#0f172a",
    sidebarTextMuted: "#94a3b8",
    sidebarHover: "#e2e8f0",
    sidebarActive: "#eff6ff",
    accent: "#2563eb",
  },
  {
    id: "forest",
    name: "Forest",
    railBg: "#f0fdf4",
    railIcon: "#64748b",
    railIconActive: "#16a34a",
    sidebarBg: "#f8fdf9",
    sidebarText: "#14532d",
    sidebarTextMuted: "#86978d",
    sidebarHover: "#dcfce7",
    sidebarActive: "#f0fdf4",
    accent: "#16a34a",
  },
  {
    id: "berry",
    name: "Berry",
    railBg: "#fdf2f8",
    railIcon: "#9ca3af",
    railIconActive: "#db2777",
    sidebarBg: "#fefafc",
    sidebarText: "#1f2937",
    sidebarTextMuted: "#9ca3af",
    sidebarHover: "#fce7f3",
    sidebarActive: "#fdf2f8",
    accent: "#db2777",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    railBg: "#171717",
    railIcon: "#737373",
    railIconActive: "#ffffff",
    sidebarBg: "#262626",
    sidebarText: "#e5e5e5",
    sidebarTextMuted: "#737373",
    sidebarHover: "#333333",
    sidebarActive: "#404040",
    accent: "#ffffff",
  },
  {
    id: "sunset",
    name: "Sunset",
    railBg: "#fff7ed",
    railIcon: "#a3a3a3",
    railIconActive: "#ea580c",
    sidebarBg: "#fffbf5",
    sidebarText: "#1c1917",
    sidebarTextMuted: "#a8a29e",
    sidebarHover: "#fed7aa",
    sidebarActive: "#fff7ed",
    accent: "#ea580c",
  },
];

export function getThemeById(id: string): WorkspaceTheme {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function getThemeCssVars(theme: WorkspaceTheme): Record<string, string> {
  return {
    "--rail-bg": theme.railBg,
    "--rail-icon": theme.railIcon,
    "--rail-icon-active": theme.railIconActive,
    "--sidebar-bg": theme.sidebarBg,
    "--sidebar-text": theme.sidebarText,
    "--sidebar-text-muted": theme.sidebarTextMuted,
    "--sidebar-hover": theme.sidebarHover,
    "--sidebar-active": theme.sidebarActive,
    "--shell-accent": theme.accent,
  };
}

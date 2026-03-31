import type { AppManifest } from "./types";

export const APP_REGISTRY: AppManifest[] = [
  {
    id: "messages",
    name: "Messages",
    description: "Team channels and direct messages",
    icon: "MessageSquare",
    category: "built_in",
    defaultInstalled: true,
    sortOrder: 1,
    hasSidebar: true,
    route: "/messages",
    setupRequired: false,
  },
  {
    id: "projects",
    name: "Projects",
    description: "Kanban boards and task management",
    icon: "LayoutGrid",
    category: "built_in",
    defaultInstalled: true,
    sortOrder: 2,
    hasSidebar: true,
    route: "/projects",
    setupRequired: false,
  },
  {
    id: "files",
    name: "Files",
    description: "Documents, notes, and file storage",
    icon: "FileText",
    category: "built_in",
    defaultInstalled: true,
    sortOrder: 3,
    hasSidebar: true,
    route: "/files",
    setupRequired: false,
  },
  {
    id: "email-marketing",
    name: "Email Marketing",
    description: "Campaigns, templates, and audience management",
    icon: "Mail",
    category: "add_on",
    defaultInstalled: false,
    sortOrder: 10,
    hasSidebar: true,
    route: "/email-marketing",
    setupRequired: true,
  },
  {
    id: "reports",
    name: "Reports",
    description: "AI-powered data analysis and reporting",
    icon: "BarChart3",
    category: "add_on",
    defaultInstalled: false,
    sortOrder: 11,
    hasSidebar: true,
    route: "/reports",
    setupRequired: false,
  },
  {
    id: "github-repos",
    name: "GitHub Repos",
    description: "Repository management, PRs, and issues",
    icon: "Github",
    category: "add_on",
    defaultInstalled: false,
    sortOrder: 12,
    hasSidebar: true,
    route: "/github-repos",
    setupRequired: true,
  },
  {
    id: "calendar",
    name: "Calendar",
    description: "Synced calendar from Google and iCloud",
    icon: "Calendar",
    category: "add_on",
    defaultInstalled: false,
    sortOrder: 13,
    hasSidebar: true,
    route: "/calendar",
    setupRequired: true,
  },
];

export const PLATFORM_APPS = ["ai-home", "settings"] as const;

export function getDefaultApps(): AppManifest[] {
  return APP_REGISTRY.filter((app) => app.defaultInstalled);
}

export function getAppById(id: string): AppManifest | undefined {
  return APP_REGISTRY.find((app) => app.id === id);
}

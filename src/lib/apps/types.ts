export type AppCategory = "built_in" | "add_on";

export interface AppManifest {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AppCategory;
  defaultInstalled: boolean;
  sortOrder: number;
  hasSidebar: boolean;
  route: string;
  setupRequired: boolean;
}

export interface InstalledApp {
  id: string;
  name: string;
  icon: string;
  route: string;
  hasSidebar: boolean;
  category: AppCategory;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  joinedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  ownerId: string;
  theme: string;
  createdAt: string;
  agentPersonaName: string | null;
  agentInstructions: string | null;
}

export interface WorkspaceInvite {
  id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "expired";
  createdAt: string;
  expiresAt: string;
}

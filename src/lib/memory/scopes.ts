// Pure builders for UltraMem `container_tag` strings — the multi-scope memory
// model. Tags are ALWAYS constructed server-side from authenticated context
// (org/workspace/user/team/project/agent/source ids resolved from the session),
// and are NEVER accepted verbatim from the model or the client. Keeping this as
// pure functions means a request can't smuggle in a tag for a scope it isn't
// allowed to read or write.

export const scopes = {
  /** Whole organization. */
  org(orgId: string): string {
    return `org:${orgId}`;
  },

  /** A single workspace. */
  workspace(workspaceId: string): string {
    return `workspace:${workspaceId}`;
  },

  /** A user's private memory within a workspace. */
  workspaceUser(workspaceId: string, userId: string): string {
    return `workspace:${workspaceId}:user:${userId}`;
  },

  /** A team within a workspace. */
  team(workspaceId: string, teamId: string): string {
    return `workspace:${workspaceId}:team:${teamId}`;
  },

  /** A project within a workspace. */
  project(workspaceId: string, projectId: string): string {
    return `workspace:${workspaceId}:project:${projectId}`;
  },

  /** An agent's memory within a workspace. */
  agent(workspaceId: string, agentId: string): string {
    return `workspace:${workspaceId}:agent:${agentId}`;
  },

  /** An external source (github, slack, drive, …) within a workspace. */
  source(workspaceId: string, sourceType: string, sourceId: string): string {
    return `workspace:${workspaceId}:source:${sourceType}:${sourceId}`;
  },
} as const;

export type Scopes = typeof scopes;

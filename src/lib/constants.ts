export const GATEWAY = {
  host: process.env.OPENCLAW_GATEWAY_HOST || "127.0.0.1",
  port: parseInt(process.env.OPENCLAW_GATEWAY_PORT || "18789"),
  token: process.env.OPENCLAW_GATEWAY_TOKEN!,
  get wsUrl() {
    return `ws://${this.host}:${this.port}`;
  },
};

export const WORKSPACE_ROLES = {
  OWNER: "owner",
  MEMBER: "member",
} as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[keyof typeof WORKSPACE_ROLES];

export const WORKSPACE_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const WORKSPACE_NAME_MAX_LENGTH = 50;
export const WORKSPACE_SLUG_MAX_LENGTH = 50;
export const INVITE_EXPIRY_DAYS = 7;

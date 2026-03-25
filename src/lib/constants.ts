export const GATEWAY = {
  host: process.env.OPENCLAW_GATEWAY_HOST || "127.0.0.1",
  port: parseInt(process.env.OPENCLAW_GATEWAY_PORT || "18789"),
  token: process.env.OPENCLAW_GATEWAY_TOKEN!,
  get wsUrl() {
    return `ws://${this.host}:${this.port}`;
  },
};

export const ROLES = {
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export const DEPARTMENTS = [
  "engineering",
  "marketing",
  "business",
  "product",
  "operations",
] as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
export type Department = (typeof DEPARTMENTS)[number];

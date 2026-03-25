import type { ConnectParams, ConnectChallenge } from "@/types/gateway";
import { createRequest } from "./protocol";

export function buildConnectRequest(token: string, challenge: ConnectChallenge) {
  const params: ConnectParams = {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: "gateway-client",
      version: "1.0.0",
      platform: "linux",
      mode: "backend",
    },
    role: "operator",
    scopes: ["operator.read", "operator.write"],
    caps: [],
    commands: [],
    permissions: {},
    auth: { token },
    locale: "en-US",
    userAgent: "500claw-platform/1.0.0",
  };

  return createRequest("connect", params as unknown as Record<string, unknown>);
}

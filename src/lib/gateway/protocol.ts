import type { GatewayRequest, GatewayResponse, GatewayEvent, GatewayFrame } from "@/types/gateway";

let requestCounter = 0;

export function createRequest(method: string, params: Record<string, unknown>): GatewayRequest {
  return {
    type: "req",
    id: `req-${++requestCounter}-${Date.now()}`,
    method,
    params,
  };
}

export function parseFrame(data: string): GatewayFrame | null {
  try {
    const frame = JSON.parse(data);
    if (frame.type === "req" || frame.type === "res" || frame.type === "event") {
      return frame as GatewayFrame;
    }
    return null;
  } catch {
    return null;
  }
}

export function isResponse(frame: GatewayFrame): frame is GatewayResponse {
  return frame.type === "res";
}

export function isEvent(frame: GatewayFrame): frame is GatewayEvent {
  return frame.type === "event";
}

export function isChallengeEvent(frame: GatewayFrame): boolean {
  return frame.type === "event" && (frame as GatewayEvent).event === "connect.challenge";
}

export function isAgentEvent(frame: GatewayFrame): boolean {
  return frame.type === "event" && (frame as GatewayEvent).event === "agent";
}

export function isTickEvent(frame: GatewayFrame): boolean {
  return frame.type === "event" && (frame as GatewayEvent).event === "tick";
}

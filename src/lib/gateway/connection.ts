import WebSocket from "ws";
import { GATEWAY } from "@/lib/constants";
import { parseFrame, isEvent, isResponse, isChallengeEvent } from "./protocol";
import { buildConnectRequest } from "./handshake";
import type { GatewayResponse, GatewayEvent, ConnectChallenge, HelloOk } from "@/types/gateway";

type MessageHandler = (event: GatewayEvent) => void;
type ResponseHandler = (response: GatewayResponse) => void;

export class GatewayConnection {
  private ws: WebSocket | null = null;
  private connected = false;
  private pendingRequests = new Map<string, ResponseHandler>();
  private eventHandlers = new Set<MessageHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private helloPayload: HelloOk | null = null;

  async connect(): Promise<HelloOk> {
    return new Promise((resolve, reject) => {
      console.log("[gateway] connecting to", GATEWAY.wsUrl);
      let ws: WebSocket;
      try {
        ws = new WebSocket(GATEWAY.wsUrl);
      } catch (err) {
        console.error("[gateway] WebSocket constructor failed:", err);
        reject(err);
        return;
      }
      this.ws = ws;

      const timeout = setTimeout(() => {
        console.error("[gateway] connection timed out after 10s");
        ws.close();
        reject(new Error("Gateway connection timeout"));
      }, 10000);

      ws.on("open", () => {
        console.log("[gateway] WebSocket open, waiting for challenge...");
      });

      ws.on("error", (err) => {
        console.error("[gateway] WebSocket error:", err);
        clearTimeout(timeout);
        reject(err);
      });

      ws.on("close", (code, reason) => {
        console.log("[gateway] WebSocket closed:", code, reason?.toString());
        this.connected = false;
        this.scheduleReconnect();
      });

      ws.on("message", (raw) => {
        const frame = parseFrame(raw.toString());
        if (!frame) return;

        if (isChallengeEvent(frame) && !this.connected) {
          const challenge = (frame as GatewayEvent).payload as unknown as ConnectChallenge;
          const connectReq = buildConnectRequest(GATEWAY.token, challenge);

          this.pendingRequests.set(connectReq.id, (res) => {
            clearTimeout(timeout);
            if (res.ok) {
              this.connected = true;
              this.helloPayload = res.payload as unknown as HelloOk;
              resolve(this.helloPayload);
            } else {
              reject(new Error(res.error?.message || "Connect rejected"));
            }
          });

          ws.send(JSON.stringify(connectReq));
          return;
        }

        if (isResponse(frame)) {
          const handler = this.pendingRequests.get(frame.id);
          if (handler) {
            this.pendingRequests.delete(frame.id);
            handler(frame);
          }
          return;
        }

        if (isEvent(frame)) {
          for (const handler of this.eventHandlers) {
            handler(frame as GatewayEvent);
          }
        }
      });
    });
  }

  async sendRequest(method: string, params: Record<string, unknown>): Promise<GatewayResponse> {
    if (!this.ws || !this.connected) {
      throw new Error("Not connected to gateway");
    }

    const { createRequest } = await import("./protocol");
    const req = createRequest(method, params);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(req.id);
        reject(new Error(`Request ${method} timed out`));
      }, 30000);

      this.pendingRequests.set(req.id, (res) => {
        clearTimeout(timeout);
        resolve(res);
      });

      this.ws!.send(JSON.stringify(req));
    });
  }

  onEvent(handler: MessageHandler) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  get sessionKey(): string {
    return this.helloPayload?.snapshot?.sessionDefaults?.mainSessionKey || "agent:main:main";
  }

  async sendChat(message: string): Promise<GatewayResponse> {
    return this.sendRequest("chat.send", {
      sessionKey: this.sessionKey,
      message,
      idempotencyKey: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
  }

  async getChatHistory(): Promise<GatewayResponse> {
    return this.sendRequest("chat.history", { sessionKey: this.sessionKey });
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  get isConnected() {
    return this.connected;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(3000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    console.log(`[gateway] reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect()
        .then(() => { this.reconnectAttempts = 0; })
        .catch(() => this.scheduleReconnect());
    }, delay);
  }
}

// Singleton for the server-side connection, attached to globalThis
// to survive Next.js hot module reloading in dev mode.
// NOTE: Phase 1 uses a single shared connection. All users share the same
// OpenClaw agent session. Phase 2 will add per-user session multiplexing.
const globalForGateway = globalThis as unknown as {
  __gatewayInstance?: GatewayConnection;
};

export function getGateway(): GatewayConnection {
  if (!globalForGateway.__gatewayInstance) {
    globalForGateway.__gatewayInstance = new GatewayConnection();
  }
  return globalForGateway.__gatewayInstance;
}

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
  // Global event handlers (receive ALL events)
  private eventHandlers = new Set<MessageHandler>();
  // Per-session event handlers (only receive events for that sessionKey)
  private sessionHandlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private helloPayload: HelloOk | null = null;
  private connectingPromise: Promise<HelloOk> | null = null;

  async connect(): Promise<HelloOk> {
    if (this.connectingPromise) return this.connectingPromise;
    this.connectingPromise = this._doConnect().finally(() => {
      this.connectingPromise = null;
    });
    return this.connectingPromise;
  }

  private _doConnect(): Promise<HelloOk> {
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
              console.log("[gateway] connected successfully");
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
          const evt = frame as GatewayEvent;
          // Route to global handlers
          for (const handler of this.eventHandlers) {
            handler(evt);
          }
          // Route to session-specific handlers
          const sessionKey = (evt.payload?.sessionKey as string) || "";
          if (sessionKey && this.sessionHandlers.has(sessionKey)) {
            for (const handler of this.sessionHandlers.get(sessionKey)!) {
              handler(evt);
            }
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

  /** Subscribe to ALL gateway events */
  onEvent(handler: MessageHandler) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /** Subscribe to events for a specific session only */
  onSessionEvent(sessionKey: string, handler: MessageHandler) {
    if (!this.sessionHandlers.has(sessionKey)) {
      this.sessionHandlers.set(sessionKey, new Set());
    }
    this.sessionHandlers.get(sessionKey)!.add(handler);
    return () => {
      const handlers = this.sessionHandlers.get(sessionKey);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) this.sessionHandlers.delete(sessionKey);
      }
    };
  }

  /** Build a session key for a user + chat session */
  userSessionKey(userId: string, chatSessionId?: string): string {
    if (chatSessionId) return `agent:main:user-${userId}-${chatSessionId}`;
    return `agent:main:user-${userId}`;
  }

  /** Send a chat message scoped to a user's session */
  async sendChat(message: string, userId: string, chatSessionId?: string): Promise<GatewayResponse> {
    return this.sendRequest("chat.send", {
      sessionKey: this.userSessionKey(userId, chatSessionId),
      message,
      idempotencyKey: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
  }

  /** Get chat history for a user's session */
  async getChatHistory(userId: string, chatSessionId?: string): Promise<GatewayResponse> {
    return this.sendRequest("chat.history", {
      sessionKey: this.userSessionKey(userId, chatSessionId),
    });
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

// Singleton attached to globalThis to survive Next.js HMR
const globalForGateway = globalThis as unknown as {
  __gatewayInstance?: GatewayConnection;
};

export function getGateway(): GatewayConnection {
  if (!globalForGateway.__gatewayInstance) {
    globalForGateway.__gatewayInstance = new GatewayConnection();
  }
  return globalForGateway.__gatewayInstance;
}

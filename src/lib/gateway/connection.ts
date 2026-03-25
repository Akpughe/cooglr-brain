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
  private helloPayload: HelloOk | null = null;

  async connect(): Promise<HelloOk> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(GATEWAY.wsUrl);
      this.ws = ws;

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Gateway connection timeout"));
      }, 10000);

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

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.on("close", () => {
        this.connected = false;
        this.scheduleReconnect();
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

  async sendChat(message: string): Promise<GatewayResponse> {
    return this.sendRequest("chat.send", { text: message });
  }

  async getChatHistory(): Promise<GatewayResponse> {
    return this.sendRequest("chat.history", {});
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
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => this.scheduleReconnect());
    }, 3000);
  }
}

// Singleton for the server-side connection.
// NOTE: Phase 1 uses a single shared connection. All users share the same
// OpenClaw agent session. Phase 2 will add per-user session multiplexing
// so each user gets isolated conversations. For now, this is a known
// limitation — treat it as a shared team chat with the AI.
let gatewayInstance: GatewayConnection | null = null;

export function getGateway(): GatewayConnection {
  if (!gatewayInstance) {
    gatewayInstance = new GatewayConnection();
  }
  return gatewayInstance;
}

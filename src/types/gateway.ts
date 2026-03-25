export interface GatewayRequest {
  type: "req";
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface GatewayResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number | null;
  };
}

export interface GatewayEvent {
  type: "event";
  event: string;
  payload: Record<string, unknown>;
  seq?: number;
  stateVersion?: { presence: number; health: number };
}

export type GatewayFrame = GatewayRequest | GatewayResponse | GatewayEvent;

export interface ConnectChallenge {
  nonce: string;
  ts: number;
}

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
  };
  role: "operator";
  scopes: string[];
  caps: string[];
  commands: string[];
  permissions: Record<string, unknown>;
  auth: { token: string };
  locale: string;
  userAgent: string;
}

export interface HelloOk {
  type: "hello-ok";
  protocol: number;
  server: { version: string; connId: string };
  features: { methods: string[]; events: string[] };
  snapshot: {
    sessionDefaults: {
      defaultAgentId: string;
      mainKey: string;
      mainSessionKey: string;
    };
  };
  policy: {
    maxPayload: number;
    tickIntervalMs: number;
  };
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface AgentEvent {
  type: "event";
  event: "agent";
  payload: {
    kind?: string;
    delta?: string;
    status?: string;
    error?: string;
    toolName?: string;
    toolInput?: unknown;
    toolResult?: unknown;
  };
}

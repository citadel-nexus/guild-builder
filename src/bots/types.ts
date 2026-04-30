/**
 * Bot tracker — shared types.
 *
 * A "bot" is any autonomous agent acting inside the guild system:
 * Bits AI, USO_MCP, Bits Codex, BITS-CODEGEN seat, IDE coding agents,
 * etc. Bot activity is published to NATS and replayed in the tracker UI.
 */

export type BotKind =
  | 'agent' // AI / LLM-backed agent (Bits AI, Bits Codex, USO_MCP)
  | 'seat' // human-bound IDE seat (IDE1, CD1, CMAX-B, COPILOT, W1, W2)
  | 'workflow' // GitHub Action / CI bot
  | 'webhook' // inbound integration callback
  | 'unknown';

export type BotStatus = 'idle' | 'active' | 'error' | 'offline';

export type GeoPoint = {
  lat: number;
  lon: number;
};

export type BotIdentity = {
  id: string;
  name: string;
  kind: BotKind;
  geo?: GeoPoint;
};

export type BotEvent = {
  id: string;
  bot_id: string;
  bot_name: string;
  bot_kind: BotKind;
  subject: string;
  action: string;
  status: BotStatus;
  geo?: GeoPoint;
  payload?: Record<string, unknown>;
  timestamp: string; // ISO-8601
};

export type BotSnapshot = {
  bots: Array<BotIdentity & { status: BotStatus; last_seen: string; event_count: number }>;
  recent_events: BotEvent[];
  generated_at: string;
};

export type ParsedBotMessage = {
  bot_id: string;
  bot_name: string;
  bot_kind: BotKind;
  action: string;
  status: BotStatus;
  geo?: GeoPoint;
  payload?: Record<string, unknown>;
};

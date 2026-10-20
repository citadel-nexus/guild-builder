// ─── CGRF Header ───────────────────────────────────────────────
// File:        src/bots/index.ts
// Stage:       11_COMMIT
// SRS:         SRS-CN-BUILDER-INTEGRATION-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-BUILDER-INTEGRATION-001
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-10-20
// Depends:     .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md
// EnumType:    Scaffold
// EnumEdges:   DEPENDS_ON .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md
// DAG Node:    none
// Intent:      Expose the bot tracking contracts through a single public module boundary.
// ───────────────────────────────────────────────────────────────

/**
 * Bot tracker — public surface barrel.
 */

export { BotRegistry, type BotEventListener, type RegistryOptions } from './registry.js';
export { startBotListener, parseBody, type BotListenerHandle, type BotListenerOptions } from './listener.js';
export { attachSseClient, type SseHandle } from './sse.js';
export { tryHandleBotRoute, type BotRouteContext } from './routes.js';
export {
  fromGenericPayload,
  fromNemesisAudit,
  fromSuricataEve,
  fromWazuhAlert,
  severityWordToStatus,
  suricataSeverityToStatus,
  translate,
  wazuhLevelToStatus,
  type ParsedSentinelEvent,
  type SentinelSource,
} from './sentinel.js';
export {
  loadSubjectConfig,
  describeSubjects,
  parseActionFromSubject,
  parseBotIdFromSubject,
  type SubjectConfig,
} from './subjects.js';
export type {
  BotEvent,
  BotIdentity,
  BotKind,
  BotSnapshot,
  BotStatus,
  GeoPoint,
  ParsedBotMessage,
} from './types.js';

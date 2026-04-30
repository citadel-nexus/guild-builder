/**
 * Bot tracker — public surface barrel.
 */

export { BotRegistry, type BotEventListener, type RegistryOptions } from './registry.js';
export { startBotListener, parseBody, type BotListenerHandle, type BotListenerOptions } from './listener.js';
export { attachSseClient, type SseHandle } from './sse.js';
export { tryHandleBotRoute, type BotRouteContext } from './routes.js';
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

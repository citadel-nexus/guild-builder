/**
 * NATS listener for the bot tracker.
 *
 * Subscribes to every pattern in the env-driven SubjectConfig, parses
 * the message into a BotEvent, and writes it to the registry. Payload
 * shape on the wire is:
 *
 *   {
 *     "bot_id":   "<string, required>",
 *     "bot_name": "<string, optional — defaults to bot_id>",
 *     "bot_kind": "agent | seat | workflow | webhook | unknown",
 *     "action":   "<string, optional — defaults to subject suffix>",
 *     "status":   "idle | active | error | offline",
 *     "geo":      { "lat": number, "lon": number },
 *     "payload":  { ... arbitrary ... }
 *   }
 *
 * Any field except `bot_id` may be omitted. If the subject follows the
 * `<prefix>.bot.<bot_id>.<verb>` canon, even `bot_id` may be inferred
 * from the subject and the body may be empty / a string.
 */

import type { NatsConnection, Subscription } from 'nats';
import { connect, StringCodec } from 'nats';

import type { BotRegistry } from './registry.js';
import {
  loadSubjectConfig,
  parseActionFromSubject,
  parseBotIdFromSubject,
  type SubjectConfig,
} from './subjects.js';
import type { BotKind, BotStatus, GeoPoint, ParsedBotMessage } from './types.js';

export type BotListenerOptions = {
  registry: BotRegistry;
  servers?: string;
  config?: SubjectConfig;
  /** Test seam — defaults to `connect` from `nats`. */
  connectFn?: typeof connect;
};

export type BotListenerHandle = {
  stop: () => Promise<void>;
  subjects: string[];
};

const sc = StringCodec();

const VALID_KINDS: ReadonlySet<BotKind> = new Set([
  'agent',
  'seat',
  'workflow',
  'webhook',
  'sentinel',
  'unknown',
]);
const VALID_STATUSES: ReadonlySet<BotStatus> = new Set(['idle', 'active', 'error', 'offline']);

export async function startBotListener(options: BotListenerOptions): Promise<BotListenerHandle> {
  const config = options.config ?? loadSubjectConfig();
  const connectImpl = options.connectFn ?? connect;
  const nc: NatsConnection = await connectImpl({ servers: options.servers ?? process.env.NATS_URL });

  const subscriptions: Subscription[] = [];
  for (const pattern of config.patterns) {
    const sub = nc.subscribe(pattern);
    subscriptions.push(sub);
    void consume(sub, options.registry, config);
  }

  console.log(`[builder] bot tracker listening on ${config.patterns.join(', ')}`);

  return {
    subjects: config.patterns.slice(),
    stop: async () => {
      for (const sub of subscriptions) {
        sub.unsubscribe();
      }
      await nc.drain();
    },
  };
}

async function consume(
  sub: Subscription,
  registry: BotRegistry,
  config: SubjectConfig,
): Promise<void> {
  for await (const msg of sub) {
    try {
      const raw = sc.decode(msg.data);
      const parsed = parseBody(raw);
      const subjectBotId = parseBotIdFromSubject(msg.subject, config.prefix);
      const subjectAction = parseActionFromSubject(msg.subject, config.prefix);
      const botId = parsed.bot_id ?? subjectBotId;
      if (!botId) {
        console.warn(`[bots] dropping ${msg.subject}: no bot_id`);
        continue;
      }
      const action = parsed.action ?? subjectAction ?? 'event';
      registry.record({
        bot_id: botId,
        bot_name: parsed.bot_name,
        bot_kind: parsed.bot_kind,
        subject: msg.subject,
        action,
        status: parsed.status,
        geo: parsed.geo,
        payload: parsed.payload,
      });
    } catch (err) {
      console.error(`[bots] failed to handle ${msg.subject}`, err);
    }
  }
}

/**
 * Lenient body parser. Accepts JSON objects, JSON strings, or non-JSON
 * payloads (treated as opaque action descriptions).
 */
export function parseBody(raw: string): Partial<ParsedBotMessage> {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return {};
  }

  let body: unknown;
  try {
    body = JSON.parse(trimmed);
  } catch {
    return { payload: { raw: trimmed } };
  }

  if (typeof body === 'string') {
    return { action: body };
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { payload: { raw: trimmed } };
  }

  const obj = body as Record<string, unknown>;
  return {
    bot_id: optionalString(obj.bot_id),
    bot_name: optionalString(obj.bot_name),
    bot_kind: coerceKind(obj.bot_kind),
    action: optionalString(obj.action),
    status: coerceStatus(obj.status),
    geo: coerceGeo(obj.geo),
    payload: coercePayload(obj.payload),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function coerceKind(value: unknown): BotKind | undefined {
  if (typeof value !== 'string') return undefined;
  return VALID_KINDS.has(value as BotKind) ? (value as BotKind) : undefined;
}

function coerceStatus(value: unknown): BotStatus | undefined {
  if (typeof value !== 'string') return undefined;
  return VALID_STATUSES.has(value as BotStatus) ? (value as BotStatus) : undefined;
}

function coerceGeo(value: unknown): GeoPoint | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const obj = value as Record<string, unknown>;
  const lat = obj.lat;
  const lon = obj.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
  return { lat, lon };
}

function coercePayload(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/**
 * In-memory bot + event registry.
 *
 * Two pieces of state:
 *   1. `bots`         — known bot identities + last-seen status
 *   2. `recentEvents` — bounded ring buffer of events for the live feed
 *
 * The registry is the single source of truth the routes (snapshot, SSE)
 * read from. The NATS listener writes; the routes read; tests can drive
 * either side directly without touching NATS.
 */

import type {
  BotEvent,
  BotIdentity,
  BotKind,
  BotSnapshot,
  BotStatus,
  GeoPoint,
} from './types.js';

export type RegistryOptions = {
  /** Max number of recent events kept in the ring buffer. */
  maxRecentEvents?: number;
  /** ms after which a bot with no events is considered offline. */
  offlineThresholdMs?: number;
};

type BotRecord = {
  identity: BotIdentity;
  status: BotStatus;
  lastSeen: string;
  eventCount: number;
};

export type BotEventListener = (event: BotEvent) => void;

const DEFAULT_MAX_EVENTS = 500;
const DEFAULT_OFFLINE_MS = 5 * 60 * 1000;

export class BotRegistry {
  private readonly bots = new Map<string, BotRecord>();
  private readonly recentEvents: BotEvent[] = [];
  private readonly listeners = new Set<BotEventListener>();
  private readonly maxRecentEvents: number;
  private readonly offlineThresholdMs: number;
  private eventCounter = 0;

  constructor(options: RegistryOptions = {}) {
    this.maxRecentEvents = Math.max(1, options.maxRecentEvents ?? DEFAULT_MAX_EVENTS);
    this.offlineThresholdMs = Math.max(1000, options.offlineThresholdMs ?? DEFAULT_OFFLINE_MS);
  }

  /**
   * Record an event. Updates the bot record, pushes onto the ring
   * buffer, and notifies SSE listeners.
   */
  record(input: {
    bot_id: string;
    bot_name?: string;
    bot_kind?: BotKind;
    subject: string;
    action: string;
    status?: BotStatus;
    geo?: GeoPoint;
    payload?: Record<string, unknown>;
    timestamp?: string;
  }): BotEvent {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const status: BotStatus = input.status ?? 'active';
    const kind: BotKind = input.bot_kind ?? 'unknown';
    const name = input.bot_name ?? input.bot_id;

    const existing = this.bots.get(input.bot_id);
    const identity: BotIdentity = existing
      ? {
          id: existing.identity.id,
          name: input.bot_name ?? existing.identity.name,
          kind: input.bot_kind ?? existing.identity.kind,
          geo: input.geo ?? existing.identity.geo ?? hashedGeo(input.bot_id),
        }
      : {
          id: input.bot_id,
          name,
          kind,
          geo: input.geo ?? hashedGeo(input.bot_id),
        };

    const next: BotRecord = {
      identity,
      status,
      lastSeen: timestamp,
      eventCount: (existing?.eventCount ?? 0) + 1,
    };
    this.bots.set(input.bot_id, next);

    this.eventCounter += 1;
    const event: BotEvent = {
      id: `${timestamp}#${this.eventCounter}`,
      bot_id: identity.id,
      bot_name: identity.name,
      bot_kind: identity.kind,
      subject: input.subject,
      action: input.action,
      status,
      geo: identity.geo,
      payload: input.payload,
      timestamp,
    };

    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.splice(0, this.recentEvents.length - this.maxRecentEvents);
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        // SSE listeners must not break the writer path.
        console.error('[bots] listener threw', err);
      }
    }

    return event;
  }

  snapshot(now: Date = new Date()): BotSnapshot {
    const cutoff = now.getTime() - this.offlineThresholdMs;
    const bots = Array.from(this.bots.values()).map((record) => {
      const lastSeenMs = Date.parse(record.lastSeen);
      const status: BotStatus =
        Number.isFinite(lastSeenMs) && lastSeenMs < cutoff ? 'offline' : record.status;
      return {
        ...record.identity,
        status,
        last_seen: record.lastSeen,
        event_count: record.eventCount,
      };
    });

    return {
      bots,
      recent_events: this.recentEvents.slice(),
      generated_at: now.toISOString(),
    };
  }

  subscribe(listener: BotEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Test helper — wipe everything. */
  reset(): void {
    this.bots.clear();
    this.recentEvents.length = 0;
    this.eventCounter = 0;
  }
}

/**
 * Stable pseudo-random geo for bots that did not declare one. Deterministic
 * per bot_id so the UI does not jitter between snapshots.
 */
function hashedGeo(seed: string): GeoPoint {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = (h >>> 0) / 0xffffffff;
  let h2 = h;
  h2 ^= h2 << 13;
  h2 ^= h2 >>> 17;
  h2 ^= h2 << 5;
  const b = (h2 >>> 0) / 0xffffffff;

  const lat = a * 140 - 70; // bias to populated latitudes
  const lon = b * 360 - 180;
  return { lat, lon };
}

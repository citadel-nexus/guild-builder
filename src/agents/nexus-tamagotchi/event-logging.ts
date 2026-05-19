import { appendFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export enum EventType {
  AGENT_START = "agent.start",
  AGENT_STOP = "agent.stop",
  AGENT_ERROR = "agent.error",
  INTERACTION_START = "interaction.start",
  INTERACTION_END = "interaction.end",
  INTERACTION_ERROR = "interaction.error",
  MEMORY_INJECT = "memory.inject",
  MEMORY_SEARCH = "memory.search",
  MEMORY_CONSOLIDATE = "memory.consolidate",
  MEMORY_PRUNE = "memory.prune",
  LEARNING_ADD = "learning.add",
  LEARNING_RECALL = "learning.recall",
  XP_AWARD = "xp.award",
  TP_AWARD = "tp.award",
  XP_SYNC = "xp.sync",
  TP_SYNC = "tp.sync",
  RANK_CHANGE = "rank.change",
  BADGE_UNLOCK = "badge.unlock",
  SKILL_UNLOCK = "skill.unlock",
  MISSION_START = "mission.start",
  MISSION_COMPLETE = "mission.complete",
  QUEST_ACCEPT = "quest.accept",
  QUEST_COMPLETE = "quest.complete",
  COUNCIL_DECISION = "council.decision",
  AUTHORITY_CHECK = "authority.check",
  INTEGRATION_CALL = "integration.call",
  INTEGRATION_ERROR = "integration.error",
  WEBHOOK_SEND = "webhook.send",
  AUTH_LOGIN = "auth.login",
  AUTH_LOGOUT = "auth.logout",
  AUTH_REFRESH = "auth.refresh",
  AUTH_ERROR = "auth.error",
  UI_LAUNCH = "ui.launch",
  UI_CLOSE = "ui.close",
  UI_SETTINGS = "ui.settings",
  SYSTEM_CONFIG = "system.config",
  SYSTEM_HEALTH = "system.health",
}

export type EventLogEntry = {
  id: string;
  timestamp: string;
  eventType: string;
  level: "debug" | "info" | "warn" | "error" | "critical";
  agentId: string;
  agentName: string;
  sessionId?: string;
  interactionId?: string;
  userId?: string;
  message: string;
  data: Record<string, unknown>;
  durationMs?: number;
  success: boolean;
  error?: string;
  stackTrace?: string;
  metadata: Record<string, unknown>;
};

export type EventLoggerOptions = {
  agentId?: string;
  agentName?: string;
  storageDir?: string;
  now?: () => Date;
  persistEntry?: (entry: EventLogEntry) => void;
  maxMemoryEntries?: number;
  rotateFileSizeMb?: number;
};

function cloneEntry(entry: EventLogEntry): EventLogEntry {
  return {
    ...entry,
    data: { ...entry.data },
    metadata: { ...entry.metadata },
  };
}

export class EventLogger {
  static readonly MAX_MEMORY_ENTRIES = 100_000;

  static readonly ROTATE_FILE_SIZE_MB = 500;

  private readonly agentId: string;

  private readonly agentName: string;

  private readonly now: () => Date;

  private readonly sessionId: string;

  private readonly storageDir: string;

  private readonly persistEntry?: (entry: EventLogEntry) => void;

  private readonly maxMemoryEntries: number;

  private readonly rotateFileSizeMb: number;

  private readonly entries: EventLogEntry[] = [];

  private logFilePath: string;

  constructor(options: EventLoggerOptions = {}) {
    this.agentId = options.agentId ?? randomUUID();
    this.agentName = options.agentName ?? "NexusAgent";
    this.now = options.now ?? (() => new Date());
    this.sessionId = randomUUID();
    this.persistEntry = options.persistEntry;
    this.storageDir =
      options.storageDir ?? join(process.cwd(), ".nexus_cache", "logs");
    this.maxMemoryEntries =
      options.maxMemoryEntries ?? EventLogger.MAX_MEMORY_ENTRIES;
    this.rotateFileSizeMb =
      options.rotateFileSizeMb ?? EventLogger.ROTATE_FILE_SIZE_MB;
    mkdirSync(this.storageDir, { recursive: true });
    this.logFilePath = this.buildLogFilePath();
  }

  log(
    eventType: EventType | string,
    options: {
      message?: string;
      data?: Record<string, unknown>;
      level?: EventLogEntry["level"];
      interactionId?: string;
      userId?: string;
      durationMs?: number;
      success?: boolean;
      error?: string;
      stackTrace?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): EventLogEntry {
    const entry: EventLogEntry = {
      id: randomUUID(),
      timestamp: this.now().toISOString(),
      eventType: String(eventType),
      level: options.level ?? "info",
      agentId: this.agentId,
      agentName: this.agentName,
      sessionId: this.sessionId,
      interactionId: options.interactionId,
      userId: options.userId,
      message: options.message ?? "",
      data: { ...(options.data ?? {}) },
      durationMs: options.durationMs,
      success: options.success ?? true,
      error: options.error,
      stackTrace: options.stackTrace,
      metadata: { ...(options.metadata ?? {}) },
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxMemoryEntries) {
      this.entries.splice(0, Math.floor(this.maxMemoryEntries / 2));
    }
    this.writeEntry(entry);
    this.persistEntry?.(cloneEntry(entry));
    return cloneEntry(entry);
  }

  logInteractionStart(
    interactionId: string,
    userInput: string,
  ): EventLogEntry {
    return this.log(EventType.INTERACTION_START, {
      message: "Interaction started",
      interactionId,
      data: { inputLength: userInput.length },
    });
  }

  logInteractionEnd(
    interactionId: string,
    responseLength: number,
    durationMs: number,
    xpEarned = 0,
  ): EventLogEntry {
    return this.log(EventType.INTERACTION_END, {
      message: "Interaction completed",
      interactionId,
      durationMs,
      data: { responseLength, xpEarned },
    });
  }

  logXpAward(
    amount: number,
    reason: string,
    interactionId?: string,
  ): EventLogEntry {
    return this.log(EventType.XP_AWARD, {
      message: `XP awarded: ${amount}`,
      interactionId,
      data: { amount, reason },
    });
  }

  logRankChange(
    oldRank: string,
    newRank: string,
    totalXp: number,
  ): EventLogEntry {
    return this.log(EventType.RANK_CHANGE, {
      message: `Rank changed: ${oldRank} -> ${newRank}`,
      data: { oldRank, newRank, totalXp },
    });
  }

  logError(
    message: string,
    options: {
      eventType?: EventType | string;
      data?: Record<string, unknown>;
    } = {},
  ): EventLogEntry {
    return this.log(options.eventType ?? EventType.AGENT_ERROR, {
      message,
      level: "error",
      success: false,
      error: message,
      data: options.data ?? {},
    });
  }

  query(options: {
    eventTypes?: Array<EventType | string>;
    level?: EventLogEntry["level"];
    since?: Date;
    until?: Date;
    limit?: number;
  } = {}): EventLogEntry[] {
    const eventTypes =
      options.eventTypes?.map((eventType) => String(eventType)) ?? [];
    const limit = options.limit ?? 100;
    const output: EventLogEntry[] = [];
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];
      if (
        eventTypes.length > 0 &&
        !eventTypes.includes(entry.eventType)
      ) {
        continue;
      }
      if (options.level && entry.level !== options.level) {
        continue;
      }
      const timestamp = Date.parse(entry.timestamp);
      if (options.since && timestamp < options.since.getTime()) {
        continue;
      }
      if (options.until && timestamp > options.until.getTime()) {
        continue;
      }
      output.push(cloneEntry(entry));
      if (output.length >= limit) {
        break;
      }
    }
    return output;
  }

  getStats(): Record<string, unknown> {
    const byType: Record<string, number> = {};
    const byLevel: Record<string, number> = {};
    let errorCount = 0;
    for (const entry of this.entries) {
      byType[entry.eventType] = (byType[entry.eventType] ?? 0) + 1;
      byLevel[entry.level] = (byLevel[entry.level] ?? 0) + 1;
      if (!entry.success) {
        errorCount += 1;
      }
    }
    return {
      totalEntries: this.entries.length,
      sessionId: this.sessionId,
      byType,
      byLevel,
      errorCount,
      logFile: this.logFilePath,
    };
  }

  getEntries(limit = 100): EventLogEntry[] {
    return this.entries.slice(Math.max(0, this.entries.length - limit)).map(cloneEntry);
  }

  private buildLogFilePath(): string {
    const date = this.now().toISOString().slice(0, 10).replaceAll("-", "");
    return join(this.storageDir, `events_${date}.jsonl`);
  }

  private rotateIfNeeded(): void {
    if (!existsSync(this.logFilePath)) {
      return;
    }
    const stats = statSync(this.logFilePath);
    const maxBytes = this.rotateFileSizeMb * 1024 * 1024;
    if (stats.size < maxBytes) {
      return;
    }
    const date = this.now().toISOString().slice(0, 10).replaceAll("-", "");
    this.logFilePath = join(
      this.storageDir,
      `events_${date}_${this.now().getTime()}.jsonl`,
    );
  }

  private writeEntry(entry: EventLogEntry): void {
    this.rotateIfNeeded();
    mkdirSync(dirname(this.logFilePath), { recursive: true });
    appendFileSync(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}

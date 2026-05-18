import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import type { DomainLearningEngine, LearningRecall } from './domain-learning.js';
import type { LTMEntry, LongTermMemory } from './long-term-memory.js';
import type { STMEntry, ShortTermMemoryBuffer } from './short-term-memory.js';

function parseRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseConversationHistory(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => parseRecord(entry))
    .map((entry) => {
      const output: Record<string, string> = {};
      for (const [key, rawValue] of Object.entries(entry)) {
        if (typeof rawValue === 'string') {
          output[key] = rawValue;
        }
      }
      return output;
    });
}

export type RehydratedContext = {
  stmMemories: STMEntry[];
  ltmMemories: LTMEntry[];
  relevantLearnings: LearningRecall[];
  emotionalState: string;
  conversationSummary: string;
  totalContextTokens: number;
  rehydrationTimestamp: string;
};

export type SessionState = {
  sessionId: string;
  userId?: string;
  startedAt: string;
  lastInteractionAt?: string;
  conversationHistory: Array<Record<string, string>>;
  stmSnapshotIds: string[];
  relevantLtmIds: string[];
  emotionalState: string;
  activeSkills: string[];
  xpEarnedSession: number;
  tpEarnedSession: number;
  metadata: Record<string, unknown>;
};

export type ConversationContext = {
  conversationId: string;
  messages: Array<Record<string, string>>;
  participants: string[];
  startedAt: string;
  lastMessageAt?: string;
  topicSummary: string;
};

export class ContextRehydrator {
  readonly sessionsDir: string;

  constructor(
    readonly stm: ShortTermMemoryBuffer,
    readonly ltm: LongTermMemory,
    readonly learningEngine?: DomainLearningEngine,
    sessionsDir?: string,
  ) {
    this.sessionsDir =
      sessionsDir ?? join(process.cwd(), '.nexus_cache', 'sessions');
    mkdirSync(this.sessionsDir, { recursive: true });
  }

  saveSession(state: SessionState): void {
    const path = join(this.sessionsDir, `${state.sessionId}.json`);
    const payload: SessionState = {
      ...state,
      conversationHistory: state.conversationHistory.map((entry) => ({ ...entry })),
      stmSnapshotIds: [...state.stmSnapshotIds],
      relevantLtmIds: [...state.relevantLtmIds],
      activeSkills: [...state.activeSkills],
      metadata: { ...state.metadata },
    };
    writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
  }

  restoreSession(sessionId: string): SessionState | undefined {
    const path = join(this.sessionsDir, `${sessionId}.json`);
    if (!existsSync(path)) {
      return undefined;
    }
    try {
      const parsed = parseRecord(JSON.parse(readFileSync(path, 'utf8')));
      return {
        sessionId: parseString(parsed.sessionId, sessionId),
        userId: typeof parsed.userId === 'string' ? parsed.userId : undefined,
        startedAt: parseString(parsed.startedAt, ''),
        lastInteractionAt:
          typeof parsed.lastInteractionAt === 'string'
            ? parsed.lastInteractionAt
            : undefined,
        conversationHistory: parseConversationHistory(parsed.conversationHistory),
        stmSnapshotIds: parseStringArray(parsed.stmSnapshotIds),
        relevantLtmIds: parseStringArray(parsed.relevantLtmIds),
        emotionalState: parseString(parsed.emotionalState, 'neutral'),
        activeSkills: parseStringArray(parsed.activeSkills),
        xpEarnedSession:
          typeof parsed.xpEarnedSession === 'number' && Number.isFinite(parsed.xpEarnedSession)
            ? parsed.xpEarnedSession
            : 0,
        tpEarnedSession:
          typeof parsed.tpEarnedSession === 'number' && Number.isFinite(parsed.tpEarnedSession)
            ? parsed.tpEarnedSession
            : 0,
        metadata: parseRecord(parsed.metadata),
      };
    } catch {
      return undefined;
    }
  }

  getLatestSessionId(): string | undefined {
    const candidates = readdirSync(this.sessionsDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        const path = join(this.sessionsDir, name);
        return {
          id: name.replace(/\.json$/, ''),
          modifiedAt: statSync(path).mtimeMs,
        };
      });
    if (candidates.length === 0) {
      return undefined;
    }
    candidates.sort((left, right) => right.modifiedAt - left.modifiedAt);
    return candidates[0].id;
  }

  async rehydrateContext(
    query: string,
    options: {
      maxStmMemories?: number;
      maxLtmMemories?: number;
      maxLearnings?: number;
    } = {},
  ): Promise<RehydratedContext> {
    const maxStmMemories = options.maxStmMemories ?? 10;
    const maxLtmMemories = options.maxLtmMemories ?? 5;
    const maxLearnings = options.maxLearnings ?? 5;

    const recentStm = this.stm.getRecent(maxStmMemories);
    const searchedStm = await this.stm.search(query, maxStmMemories);
    const mergedById = new Map<string, STMEntry>();
    for (const entry of recentStm) {
      mergedById.set(entry.id, entry);
    }
    for (const result of searchedStm) {
      mergedById.set(result.entry.id, result.entry);
    }

    const stmMemories = Array.from(mergedById.values());
    const ltmResults = this.ltm.retrieve(query, { topK: maxLtmMemories });
    const ltmMemories = ltmResults.map((result) => ({
      ...result.entry,
      metadata: { ...result.entry.metadata },
    }));
    const relevantLearnings = this.learningEngine
      ? this.learningEngine.recall(query, undefined, maxLearnings)
      : [];

    const emotions = stmMemories
      .map((entry) => entry.emotion)
      .filter((emotion) => emotion !== 'neutral');
    const emotionalState = this.pickDominantValue(emotions, 'neutral');
    const conversationSummary = stmMemories
      .slice(Math.max(0, stmMemories.length - 5))
      .map((entry) => entry.content)
      .join(' | ');

    const textPayload = [
      ...stmMemories.map((entry) => entry.content),
      ...ltmMemories.map((entry) => entry.content),
      ...relevantLearnings.map((entry) => entry.content),
    ].join(' ');

    return {
      stmMemories,
      ltmMemories,
      relevantLearnings,
      emotionalState,
      conversationSummary,
      totalContextTokens: Math.floor(textPayload.length / 4),
      rehydrationTimestamp: new Date().toISOString(),
    };
  }

  async buildContextWindow(
    currentInput: string,
    maxTokens: number = 4000,
  ): Promise<string> {
    const context = await this.rehydrateContext(currentInput);
    const parts: string[] = [];

    if (context.stmMemories.length > 0) {
      parts.push('=== Recent Memories ===');
      for (const memory of context.stmMemories.slice(-5)) {
        parts.push(`- [${memory.emotion}] ${memory.content.slice(0, 200)}`);
      }
    }

    if (context.ltmMemories.length > 0) {
      parts.push('\n=== Long-Term Knowledge ===');
      for (const memory of context.ltmMemories.slice(0, 3)) {
        parts.push(`- [${memory.domain}] ${memory.content.slice(0, 200)}`);
      }
    }

    if (context.relevantLearnings.length > 0) {
      parts.push('\n=== Relevant Learnings ===');
      for (const learning of context.relevantLearnings.slice(0, 3)) {
        parts.push(`- [${learning.domain}] ${learning.content.slice(0, 200)}`);
      }
    }

    const output = parts.join('\n');
    const maxChars = Math.max(0, maxTokens) * 4;
    return output.length > maxChars ? `${output.slice(0, maxChars)}...` : output;
  }

  private pickDominantValue(values: string[], fallback: string): string {
    if (values.length === 0) {
      return fallback;
    }
    const counts = new Map<string, number>();
    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    let winner = fallback;
    let score = 0;
    for (const [value, count] of counts.entries()) {
      if (count > score) {
        winner = value;
        score = count;
      }
    }
    return winner;
  }
}
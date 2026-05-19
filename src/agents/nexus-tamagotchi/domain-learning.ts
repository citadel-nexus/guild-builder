import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LongTermMemory } from './long-term-memory.js';

type LearningLogEntry = {
  entryId: string;
  domain: string;
  timestamp: string;
  contentPreview: string;
  context: Record<string, unknown>;
};

function parseRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export type LearningResult = {
  success: boolean;
  domain: string;
  entryId?: string;
  duplicate: boolean;
  error?: string;
};

export type LearningRecall = {
  content: string;
  domain: string;
  similarity: number;
  learnedAt: string;
  accessCount: number;
  metadata: Record<string, unknown>;
};

export type DomainStats = {
  domain: string;
  totalLearnings: number;
  totalVectors: number;
  recentLearnings: number;
  avgAccessCount: number;
  config: Record<string, unknown>;
};

export class DomainLearningEngine {
  readonly storageDir: string;
  readonly ltm: LongTermMemory;

  private readonly learningLog: LearningLogEntry[] = [];
  private readonly logPath: string;

  constructor(
    options: {
      storageDir?: string;
      ltm?: LongTermMemory;
    } = {},
  ) {
    this.storageDir =
      options.storageDir ?? join(process.cwd(), '.nexus_cache', 'learning');
    mkdirSync(this.storageDir, { recursive: true });
    this.ltm =
      options.ltm ??
      new LongTermMemory({
        storageDir: join(this.storageDir, 'ltm'),
      });
    this.logPath = join(this.storageDir, 'patterns.jsonl');
    this.loadLearningLog();
  }

  learn(
    content: string,
    context: Record<string, unknown> = {},
    domain?: string,
  ): LearningResult {
    const targetDomain = domain ?? this.ltm.routeToDomain(content);
    const entryId = this.ltm.store(content, {
      domain: targetDomain,
      metadata: context,
    });
    if (!entryId) {
      return {
        success: false,
        domain: targetDomain,
        duplicate: true,
      };
    }

    const logEntry: LearningLogEntry = {
      entryId,
      domain: targetDomain,
      timestamp: new Date().toISOString(),
      contentPreview: content.slice(0, 100),
      context: { ...context },
    };
    this.appendLearningLog(logEntry);

    return {
      success: true,
      domain: targetDomain,
      entryId,
      duplicate: false,
    };
  }

  recall(
    query: string,
    domains?: string[],
    topK: number = 5,
  ): LearningRecall[] {
    const recalled = domains && domains.length > 0
      ? domains.flatMap((domain) =>
          this.ltm.retrieve(query, { domain, topK }),
        )
      : this.ltm.retrieve(query, { topK });

    const output = recalled.map((result) => ({
      content: result.entry.content,
      domain: result.entry.domain,
      similarity: result.similarity,
      learnedAt: result.entry.createdAt,
      accessCount: result.entry.accessCount,
      metadata: { ...result.entry.metadata },
    }));
    output.sort((left, right) => right.similarity - left.similarity);
    return output.slice(0, Math.max(0, topK));
  }

  getDomainStats(): Record<string, DomainStats> {
    const stats = this.ltm.getStats();
    const domainsRecord = parseRecord(stats.domains);
    const output: Record<string, DomainStats> = {};

    for (const [domain, value] of Object.entries(domainsRecord)) {
      const domainStats = parseRecord(value);
      const entries = this.ltm.entries[domain] ?? {};
      const entryList = Object.values(entries);
      let totalAccessCount = 0;
      let recentLearnings = 0;

      for (const entry of entryList) {
        totalAccessCount += entry.accessCount;
        const created = Date.parse(entry.createdAt);
        if (Number.isFinite(created)) {
          const daysSinceCreate = (Date.now() - created) / 86_400_000;
          if (daysSinceCreate <= 7) {
            recentLearnings += 1;
          }
        }
      }

      const totalLearnings = entryList.length;
      output[domain] = {
        domain,
        totalLearnings,
        totalVectors: parseNumber(domainStats.vectorCount, 0),
        recentLearnings,
        avgAccessCount:
          totalLearnings === 0 ? 0 : totalAccessCount / totalLearnings,
        config: parseRecord(domainStats.config),
      };
    }

    return output;
  }

  getLearningVelocity(hours: number = 24): number {
    if (hours <= 0) {
      return 0;
    }
    const cutoff = Date.now() - hours * 3_600_000;
    let recent = 0;
    for (const entry of this.learningLog) {
      const timestamp = Date.parse(entry.timestamp);
      if (Number.isFinite(timestamp) && timestamp >= cutoff) {
        recent += 1;
      }
    }
    return recent / hours;
  }

  private loadLearningLog(): void {
    if (!existsSync(this.logPath)) {
      return;
    }
    const lines = readFileSync(this.logPath, 'utf8').split('\n');
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }
      try {
        const parsed = parseRecord(JSON.parse(line));
        this.learningLog.push({
          entryId: parseString(parsed.entryId, ''),
          domain: parseString(parsed.domain, 'general'),
          timestamp: parseString(parsed.timestamp, new Date().toISOString()),
          contentPreview: parseString(parsed.contentPreview, ''),
          context: parseRecord(parsed.context),
        });
      } catch {
        continue;
      }
    }
  }

  private appendLearningLog(entry: LearningLogEntry): void {
    this.learningLog.push({
      ...entry,
      context: { ...entry.context },
    });
    appendFileSync(this.logPath, `${JSON.stringify(entry)}\n`, 'utf8');
  }
}
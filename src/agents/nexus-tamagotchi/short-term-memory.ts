import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { SimpleEmbeddingService } from './memory.js';

export type STMEntry = {
  id: string;
  timestamp: string;
  content: string;
  emotion: string;
  tags: string[];
  source: string;
  context: string;
  embedding?: number[];
  interactionId?: string;
  importance: number;
  consolidationScore: number;
  metadata: Record<string, unknown>;
};

export type STMSearchResult = {
  entry: STMEntry;
  similarity: number;
  distance: number;
  rank: number;
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

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  if (!value.every((item) => typeof item === 'number' && Number.isFinite(item))) {
    return undefined;
  }
  return value;
}

function cloneEntry(entry: STMEntry): STMEntry {
  return {
    ...entry,
    tags: [...entry.tags],
    embedding: entry.embedding ? [...entry.embedding] : undefined,
    metadata: { ...entry.metadata },
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function parseEntry(value: unknown): STMEntry | undefined {
  const record = parseRecord(value);
  const id = parseString(record.id, '');
  const timestamp = parseString(record.timestamp, '');
  const content = parseString(record.content, '');
  if (id.length === 0 || timestamp.length === 0 || content.length === 0) {
    return undefined;
  }
  return {
    id,
    timestamp,
    content,
    emotion: parseString(record.emotion, 'neutral'),
    tags: parseStringArray(record.tags),
    source: parseString(record.source, 'interaction'),
    context: parseString(record.context, 'conversation'),
    embedding: parseNumberArray(record.embedding),
    interactionId:
      typeof record.interactionId === 'string' ? record.interactionId : undefined,
    importance: parseNumber(record.importance, 0.5),
    consolidationScore: parseNumber(record.consolidationScore, 0),
    metadata: parseRecord(record.metadata),
  };
}

export class ShortTermMemoryBuffer {
  static readonly STM_MAX_ENTRIES = 10_000;
  static readonly STM_PRUNE_TO_SIZE = 5_000;

  private entries: STMEntry[] = [];
  private readonly maxEntries: number;
  private readonly pruneToSize: number;
  private readonly storagePath: string;
  private readonly embeddingService: SimpleEmbeddingService;

  constructor(
    options: {
      storagePath?: string;
      maxEntries?: number;
      pruneToSize?: number;
      embeddingService?: SimpleEmbeddingService;
    } = {},
  ) {
    this.storagePath =
      options.storagePath ??
      join(process.cwd(), '.nexus_cache', 'stm', 'stm_buffer.jsonl');
    this.maxEntries = options.maxEntries ?? ShortTermMemoryBuffer.STM_MAX_ENTRIES;
    this.pruneToSize = options.pruneToSize ?? ShortTermMemoryBuffer.STM_PRUNE_TO_SIZE;
    this.embeddingService = options.embeddingService ?? new SimpleEmbeddingService();
    mkdirSync(dirname(this.storagePath), { recursive: true });
    this.loadFromDisk();
  }

  async inject(
    content: string,
    options: {
      emotion?: string;
      tags?: string[];
      source?: string;
      context?: string;
      interactionId?: string;
      importance?: number;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<STMEntry> {
    const entry: STMEntry = {
      id: `stm-${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
      timestamp: new Date().toISOString(),
      content,
      emotion: options.emotion ?? 'neutral',
      tags: options.tags ? [...options.tags] : [],
      source: options.source ?? 'interaction',
      context: options.context ?? 'conversation',
      interactionId: options.interactionId,
      importance: options.importance ?? 0.5,
      consolidationScore: 0,
      metadata: options.metadata ? { ...options.metadata } : {},
    };

    try {
      entry.embedding = await this.embeddingService.embedText(content);
    } catch {
      entry.embedding = undefined;
    }

    this.entries.push(entry);
    appendFileSync(this.storagePath, `${JSON.stringify(entry)}\n`, 'utf8');
    this.pruneIfNeeded();
    return cloneEntry(entry);
  }

  getRecent(limit: number = 10, source?: string): STMEntry[] {
    const filtered = source
      ? this.entries.filter((entry) => entry.source === source)
      : this.entries;
    return filtered.slice(Math.max(0, filtered.length - limit)).map(cloneEntry);
  }

  async search(
    query: string,
    topK: number = 5,
    minSimilarity: number = 0,
  ): Promise<STMSearchResult[]> {
    const queryEmbedding = await this.embeddingService.embedText(query);
    const candidates: Array<{ entry: STMEntry; similarity: number }> = [];

    for (const entry of this.entries) {
      if (!entry.embedding) {
        continue;
      }
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity < minSimilarity) {
        continue;
      }
      candidates.push({ entry, similarity });
    }

    candidates.sort((left, right) => right.similarity - left.similarity);
    return candidates.slice(0, Math.max(0, topK)).map((result, index) => ({
      entry: cloneEntry(result.entry),
      similarity: result.similarity,
      distance: 1 - result.similarity,
      rank: index,
    }));
  }

  getByTag(tag: string): STMEntry[] {
    return this.entries
      .filter((entry) => entry.tags.includes(tag))
      .map(cloneEntry);
  }

  getByEmotion(emotion: string): STMEntry[] {
    return this.entries
      .filter((entry) => entry.emotion === emotion)
      .map(cloneEntry);
  }

  getCandidatesForConsolidation(
    threshold: number = 0.7,
    maxAgeHours: number = 24,
  ): STMEntry[] {
    const now = Date.now();
    const candidates: STMEntry[] = [];

    for (const entry of this.entries) {
      const ageHours = (now - new Date(entry.timestamp).getTime()) / 3_600_000;
      const recencyFactor = 1 / (1 + ageHours / 24);
      const consolidationScore = entry.importance * (1 - 0.5 * recencyFactor);
      entry.consolidationScore = consolidationScore;
      if (consolidationScore >= threshold && ageHours <= maxAgeHours) {
        candidates.push(cloneEntry(entry));
      }
    }

    candidates.sort(
      (left, right) => right.consolidationScore - left.consolidationScore,
    );
    return candidates;
  }

  getStats(): Record<string, unknown> {
    return {
      entries: this.entries.length,
      storagePath: this.storagePath,
      maxEntries: this.maxEntries,
      pruneToSize: this.pruneToSize,
    };
  }

  clear(): void {
    this.entries = [];
    writeFileSync(this.storagePath, '', 'utf8');
  }

  private loadFromDisk(): void {
    if (!existsSync(this.storagePath)) {
      return;
    }
    const raw = readFileSync(this.storagePath, 'utf8');
    const lines = raw.split('\n');
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }
      try {
        const parsed = parseEntry(JSON.parse(line));
        if (parsed) {
          this.entries.push(parsed);
        }
      } catch {
        continue;
      }
    }
  }

  private pruneIfNeeded(): void {
    if (this.entries.length <= this.maxEntries) {
      return;
    }
    const now = Date.now();
    const scored = this.entries.map((entry) => {
      const ageHours = (now - new Date(entry.timestamp).getTime()) / 3_600_000;
      const recencyFactor = 1 / (1 + ageHours / 24);
      const effectiveImportance = entry.importance * recencyFactor;
      return { entry, effectiveImportance };
    });

    scored.sort((left, right) => right.effectiveImportance - left.effectiveImportance);
    this.entries = scored
      .slice(0, this.pruneToSize)
      .map((item) => item.entry);
    this.persistAll();
  }

  private persistAll(): void {
    const body = this.entries.map((entry) => JSON.stringify(entry)).join('\n');
    writeFileSync(this.storagePath, body.length > 0 ? `${body}\n` : '', 'utf8');
  }
}
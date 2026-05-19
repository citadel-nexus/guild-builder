import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { STMEntry } from './short-term-memory.js';

type IndexMapEntry = {
  index: number;
  metadata: Record<string, unknown>;
  fingerprint: string;
  timestamp: string;
};

type PersistedIndexMap = Record<string, IndexMapEntry>;

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

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
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

function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return { ...metadata };
}

function l2Distance(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    const delta = left[index] - right[index];
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export type FAISSSearchResult = {
  vectorId: string;
  distance: number;
  similarity: number;
  metadata: Record<string, unknown>;
  rank: number;
};

export type FAISSVectorRecord = {
  vectorId: string;
  vector: number[];
  metadata: Record<string, unknown>;
  timestamp: string;
};

export class AgentFAISSWrapper {
  static readonly VECTOR_DIM = 1536;
  static readonly HNSW_THRESHOLD = 1000;
  static readonly HNSW_M = 32;
  static readonly HNSW_EF_CONSTRUCTION = 40;
  static readonly HNSW_EF_SEARCH = 16;

  readonly indexPath: string;
  readonly mapPath: string;
  readonly vectorsPath: string;

  private vectors: number[][] = [];
  private idMap = new Map<string, IndexMapEntry>();
  private fingerprints = new Set<string>();
  private usingHnsw = false;

  constructor(
    readonly name: string,
    readonly storageDir: string,
    readonly vectorDim: number = AgentFAISSWrapper.VECTOR_DIM,
  ) {
    mkdirSync(this.storageDir, { recursive: true });
    this.indexPath = join(this.storageDir, `${this.name}.index.json`);
    this.mapPath = join(this.storageDir, `${this.name}_map.json`);
    this.vectorsPath = join(this.storageDir, `${this.name}_vectors.json`);
    this.load();
  }

  fingerprintExists(fingerprint: string): boolean {
    return this.fingerprints.has(fingerprint);
  }

  insert(
    vectorId: string,
    vector: number[],
    metadata: Record<string, unknown> = {},
    checkDuplicate: boolean = true,
  ): boolean {
    const normalized = this.normalizeVector(vector);
    if (!normalized || this.idMap.has(vectorId)) {
      return false;
    }

    const fingerprint = this.computeFingerprint(normalized);
    if (checkDuplicate && this.fingerprints.has(fingerprint)) {
      return false;
    }

    this.vectors.push(normalized);
    this.idMap.set(vectorId, {
      index: this.vectors.length - 1,
      metadata: cloneMetadata(metadata),
      fingerprint,
      timestamp: new Date().toISOString(),
    });
    this.fingerprints.add(fingerprint);
    this.usingHnsw = this.vectors.length >= AgentFAISSWrapper.HNSW_THRESHOLD;
    return true;
  }

  search(queryVector: number[], topK: number = 5): FAISSSearchResult[] {
    const normalized = this.normalizeVector(queryVector);
    if (!normalized || this.idMap.size === 0) {
      return [];
    }

    const scored: Array<FAISSSearchResult> = [];
    for (const [vectorId, entry] of this.idMap.entries()) {
      const vector = this.vectors[entry.index];
      if (!vector) {
        continue;
      }
      const distance = l2Distance(normalized, vector);
      if (!Number.isFinite(distance)) {
        continue;
      }
      scored.push({
        vectorId,
        distance,
        similarity: 1 / (1 + distance),
        metadata: cloneMetadata(entry.metadata),
        rank: 0,
      });
    }

    scored.sort((left, right) => left.distance - right.distance);
    return scored.slice(0, Math.max(0, topK)).map((result, index) => ({
      ...result,
      rank: index,
    }));
  }

  remove(vectorId: string): boolean {
    const entry = this.idMap.get(vectorId);
    if (!entry) {
      return false;
    }
    this.idMap.delete(vectorId);
    this.fingerprints.delete(entry.fingerprint);
    return true;
  }

  rebuild(): void {
    const active = Array.from(this.idMap.entries()).sort(
      (left, right) => left[1].index - right[1].index,
    );
    const nextVectors: number[][] = [];
    const nextMap = new Map<string, IndexMapEntry>();
    const nextFingerprints = new Set<string>();

    for (const [vectorId, entry] of active) {
      const vector = this.vectors[entry.index];
      if (!vector) {
        continue;
      }
      const nextIndex = nextVectors.length;
      nextVectors.push([...vector]);
      nextMap.set(vectorId, {
        ...entry,
        index: nextIndex,
        metadata: cloneMetadata(entry.metadata),
      });
      nextFingerprints.add(entry.fingerprint);
    }

    this.vectors = nextVectors;
    this.idMap = nextMap;
    this.fingerprints = nextFingerprints;
    this.usingHnsw = this.vectors.length >= AgentFAISSWrapper.HNSW_THRESHOLD;
  }

  save(): void {
    mkdirSync(this.storageDir, { recursive: true });

    const indexPayload = {
      name: this.name,
      vectorDim: this.vectorDim,
      usingHnsw: this.usingHnsw,
    };
    const mapPayload: PersistedIndexMap = {};
    for (const [vectorId, entry] of this.idMap.entries()) {
      mapPayload[vectorId] = {
        ...entry,
        metadata: cloneMetadata(entry.metadata),
      };
    }

    writeFileSync(this.indexPath, JSON.stringify(indexPayload, null, 2), 'utf8');
    writeFileSync(this.mapPath, JSON.stringify(mapPayload, null, 2), 'utf8');
    writeFileSync(this.vectorsPath, JSON.stringify(this.vectors, null, 2), 'utf8');
  }

  load(): void {
    this.vectors = [];
    this.idMap.clear();
    this.fingerprints.clear();
    this.usingHnsw = false;

    if (existsSync(this.vectorsPath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.vectorsPath, 'utf8'));
        if (Array.isArray(parsed)) {
          const vectors: number[][] = [];
          for (const value of parsed) {
            const vector = parseNumberArray(value);
            if (vector && vector.length === this.vectorDim) {
              vectors.push(vector);
            }
          }
          this.vectors = vectors;
        }
      } catch {
        this.vectors = [];
      }
    }

    if (existsSync(this.mapPath)) {
      try {
        const parsed = parseRecord(JSON.parse(readFileSync(this.mapPath, 'utf8')));
        for (const [vectorId, rawEntry] of Object.entries(parsed)) {
          const entry = parseRecord(rawEntry);
          const mapEntry: IndexMapEntry = {
            index: parseNumber(entry.index, -1),
            metadata: parseRecord(entry.metadata),
            fingerprint: parseString(entry.fingerprint, ''),
            timestamp: parseString(entry.timestamp, ''),
          };
          if (
            mapEntry.index < 0 ||
            mapEntry.index >= this.vectors.length ||
            mapEntry.fingerprint.length === 0
          ) {
            continue;
          }
          this.idMap.set(vectorId, {
            ...mapEntry,
            metadata: cloneMetadata(mapEntry.metadata),
          });
          this.fingerprints.add(mapEntry.fingerprint);
        }
      } catch {
        this.idMap.clear();
        this.fingerprints.clear();
      }
    }

    if (existsSync(this.indexPath)) {
      try {
        const parsed = parseRecord(JSON.parse(readFileSync(this.indexPath, 'utf8')));
        this.usingHnsw = parseBoolean(
          parsed.usingHnsw,
          this.vectors.length >= AgentFAISSWrapper.HNSW_THRESHOLD,
        );
      } catch {
        this.usingHnsw = this.vectors.length >= AgentFAISSWrapper.HNSW_THRESHOLD;
      }
    } else {
      this.usingHnsw = this.vectors.length >= AgentFAISSWrapper.HNSW_THRESHOLD;
    }
  }

  getStats(): Record<string, unknown> {
    return {
      name: this.name,
      totalVectors: this.idMap.size,
      vectorDim: this.vectorDim,
      indexType: this.usingHnsw ? 'IndexHNSWFlat' : 'IndexFlatL2',
      usingHnsw: this.usingHnsw,
      uniqueFingerprints: this.fingerprints.size,
    };
  }

  getVectorRecords(): FAISSVectorRecord[] {
    const records: FAISSVectorRecord[] = [];
    for (const [vectorId, entry] of this.idMap.entries()) {
      const vector = this.vectors[entry.index];
      if (!vector) {
        continue;
      }
      records.push({
        vectorId,
        vector: [...vector],
        metadata: cloneMetadata(entry.metadata),
        timestamp: entry.timestamp,
      });
    }
    return records;
  }

  private normalizeVector(vector: number[]): number[] | undefined {
    if (
      !Array.isArray(vector) ||
      vector.length !== this.vectorDim ||
      !vector.every((value) => Number.isFinite(value))
    ) {
      return undefined;
    }
    return vector.map((value) => Number(value));
  }

  private computeFingerprint(vector: number[]): string {
    return createHash('md5').update(JSON.stringify(vector)).digest('hex');
  }
}

export type LTMEntry = {
  id: string;
  content: string;
  domain: string;
  createdAt: string;
  sourceStmId?: string;
  consolidationScore: number;
  accessCount: number;
  lastAccessedAt?: string;
  metadata: Record<string, unknown>;
};

export type LTMSearchResult = {
  entry: LTMEntry;
  similarity: number;
  distance: number;
  rank: number;
};

type DomainConfig = {
  description: string;
  retentionDays: number | null;
  consolidationThreshold: number;
};

export class LongTermMemory {
  static readonly DEFAULT_DOMAINS = [
    'general',
    'conversation',
    'skills',
    'facts',
    'user_preferences',
    'emotional_patterns',
  ] as const;

  static readonly DOMAIN_CONFIG: Record<string, DomainConfig> = {
    general: {
      description: 'General knowledge and information',
      retentionDays: null,
      consolidationThreshold: 0.7,
    },
    conversation: {
      description: 'Conversation patterns and user preferences',
      retentionDays: 90,
      consolidationThreshold: 0.8,
    },
    skills: {
      description: 'Technical skills and capabilities learned',
      retentionDays: 365,
      consolidationThreshold: 0.7,
    },
    facts: {
      description: 'Factual knowledge extracted from interactions',
      retentionDays: null,
      consolidationThreshold: 0.9,
    },
    user_preferences: {
      description: 'User-specific preferences and patterns',
      retentionDays: null,
      consolidationThreshold: 0.85,
    },
    emotional_patterns: {
      description: 'Emotional context and responses',
      retentionDays: 30,
      consolidationThreshold: 0.6,
    },
  };

  readonly storageDir: string;
  readonly indexes: Record<string, AgentFAISSWrapper> = {};
  readonly entries: Record<string, Record<string, LTMEntry>> = {};

  private readonly entriesPath: string;
  private readonly domainEmbeddings: Record<string, number[]> = {};
  private readonly vectorDim: number;

  constructor(
    options: {
      storageDir?: string;
      vectorDim?: number;
    } = {},
  ) {
    this.storageDir =
      options.storageDir ?? join(process.cwd(), '.nexus_cache', 'ltm');
    this.vectorDim = options.vectorDim ?? AgentFAISSWrapper.VECTOR_DIM;
    mkdirSync(this.storageDir, { recursive: true });

    const indexDir = join(this.storageDir, 'indexes');
    mkdirSync(indexDir, { recursive: true });
    this.entriesPath = join(this.storageDir, 'entries.json');

    for (const domain of LongTermMemory.DEFAULT_DOMAINS) {
      this.indexes[domain] = new AgentFAISSWrapper(
        domain,
        indexDir,
        this.vectorDim,
      );
      this.entries[domain] = {};
    }

    this.loadEntries();
    this.initializeDomainEmbeddings();
  }

  routeToDomain(content: string): string {
    const textEmbedding = this.getEmbedding(content);
    let bestDomain = 'general';
    let bestSimilarity = Number.NEGATIVE_INFINITY;

    for (const [domain, embedding] of Object.entries(this.domainEmbeddings)) {
      const similarity = cosineSimilarity(textEmbedding, embedding);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestDomain = domain;
      }
    }

    return bestDomain;
  }

  store(
    content: string,
    options: {
      domain?: string;
      metadata?: Record<string, unknown>;
      sourceStmId?: string;
      consolidationScore?: number;
    } = {},
  ): string | undefined {
    const routedDomain =
      options.domain && this.indexes[options.domain]
        ? options.domain
        : this.routeToDomain(content);
    const domain = this.indexes[routedDomain] ? routedDomain : 'general';
    const vector = this.getEmbedding(content);
    const metadata = options.metadata ? cloneMetadata(options.metadata) : {};

    const entry: LTMEntry = {
      id: randomUUID(),
      content,
      domain,
      createdAt: new Date().toISOString(),
      sourceStmId: options.sourceStmId,
      consolidationScore: options.consolidationScore ?? 0,
      accessCount: 0,
      metadata,
    };

    const inserted = this.indexes[domain].insert(entry.id, vector, {
      contentHash: createHash('md5').update(content).digest('hex'),
    });
    if (!inserted) {
      return undefined;
    }

    this.entries[domain][entry.id] = {
      ...entry,
      metadata: cloneMetadata(entry.metadata),
    };
    this.saveEntries();
    return entry.id;
  }

  retrieve(
    query: string,
    options: {
      domain?: string;
      topK?: number;
    } = {},
  ): LTMSearchResult[] {
    const queryVector = this.getEmbedding(query);
    const topK = options.topK ?? 5;
    const domains = options.domain ? [options.domain] : Object.keys(this.indexes);
    const output: LTMSearchResult[] = [];

    for (const domain of domains) {
      if (!this.indexes[domain]) {
        continue;
      }
      const matches = this.indexes[domain].search(queryVector, topK);
      for (const match of matches) {
        const entry = this.entries[domain][match.vectorId];
        if (!entry) {
          continue;
        }
        entry.accessCount += 1;
        entry.lastAccessedAt = new Date().toISOString();
        output.push({
          entry: {
            ...entry,
            metadata: cloneMetadata(entry.metadata),
          },
          similarity: match.similarity,
          distance: match.distance,
          rank: match.rank,
        });
      }
    }

    output.sort((left, right) => right.similarity - left.similarity);
    this.saveEntries();
    return output.slice(0, Math.max(0, topK));
  }

  consolidateFromStm(stmEntries: STMEntry[], threshold: number = 0.7): number {
    let consolidated = 0;
    for (const entry of stmEntries) {
      if (entry.consolidationScore < threshold) {
        continue;
      }
      const stored = this.store(entry.content, {
        metadata: {
          originalEmotion: entry.emotion,
          originalTags: [...entry.tags],
          source: entry.source,
          context: entry.context,
        },
        sourceStmId: entry.id,
        consolidationScore: entry.consolidationScore,
      });
      if (stored) {
        consolidated += 1;
      }
    }
    return consolidated;
  }

  getStats(): Record<string, unknown> {
    const domains: Record<string, Record<string, unknown>> = {};
    let totalEntries = 0;

    for (const domain of Object.keys(this.indexes)) {
      const entryCount = Object.keys(this.entries[domain]).length;
      totalEntries += entryCount;
      const indexStats = this.indexes[domain].getStats();
      domains[domain] = {
        vectorCount: parseNumber(indexStats.totalVectors, 0),
        entryCount,
        config: LongTermMemory.DOMAIN_CONFIG[domain] ?? {},
      };
    }

    return {
      totalEntries,
      domains,
    };
  }

  saveAll(): void {
    for (const index of Object.values(this.indexes)) {
      index.save();
    }
    this.saveEntries();
  }

  private loadEntries(): void {
    if (!existsSync(this.entriesPath)) {
      return;
    }
    try {
      const parsed = parseRecord(JSON.parse(readFileSync(this.entriesPath, 'utf8')));
      for (const [domain, rawEntries] of Object.entries(parsed)) {
        if (!this.entries[domain]) {
          continue;
        }
        const records = parseRecord(rawEntries);
        for (const [entryId, rawEntry] of Object.entries(records)) {
          const entryRecord = parseRecord(rawEntry);
          this.entries[domain][entryId] = {
            id: parseString(entryRecord.id, entryId),
            content: parseString(entryRecord.content, ''),
            domain: parseString(entryRecord.domain, domain),
            createdAt: parseString(entryRecord.createdAt, new Date().toISOString()),
            sourceStmId:
              typeof entryRecord.sourceStmId === 'string'
                ? entryRecord.sourceStmId
                : undefined,
            consolidationScore: parseNumber(entryRecord.consolidationScore, 0),
            accessCount: parseNumber(entryRecord.accessCount, 0),
            lastAccessedAt:
              typeof entryRecord.lastAccessedAt === 'string'
                ? entryRecord.lastAccessedAt
                : undefined,
            metadata: parseRecord(entryRecord.metadata),
          };
        }
      }
    } catch {
      for (const domain of Object.keys(this.entries)) {
        this.entries[domain] = {};
      }
    }
  }

  private saveEntries(): void {
    const payload: Record<string, Record<string, LTMEntry>> = {};
    for (const [domain, entries] of Object.entries(this.entries)) {
      payload[domain] = {};
      for (const [entryId, entry] of Object.entries(entries)) {
        payload[domain][entryId] = {
          ...entry,
          metadata: cloneMetadata(entry.metadata),
        };
      }
    }
    writeFileSync(this.entriesPath, JSON.stringify(payload, null, 2), 'utf8');
  }

  private initializeDomainEmbeddings(): void {
    for (const [domain, config] of Object.entries(LongTermMemory.DOMAIN_CONFIG)) {
      this.domainEmbeddings[domain] = this.getEmbedding(config.description);
    }
  }

  private getEmbedding(text: string): number[] {
    const vector: number[] = [];
    for (let index = 0; index < this.vectorDim; index += 1) {
      const digest = createHash('sha256')
        .update(`${text}:${index}`)
        .digest();
      vector.push((digest[0] / 255) * 2 - 1);
    }
    return vector;
  }
}
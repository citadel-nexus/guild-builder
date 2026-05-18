import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';

import {
  MemoryObject,
  MemoryType,
  type MemoryObjectRecord,
} from './models.js';

type EmbeddingProvider = {
  embedText: (text: string) => Promise<number[]>;
};

export type VectorSearchResult = {
  fingerprint: string;
  similarity: number;
};

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseMemoryObjectRecord(raw: unknown): MemoryObjectRecord | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  const value = raw;
  const memoryType = value.memoryType;
  const validMemoryType = Object.values(MemoryType).find(
    (candidate) => candidate === memoryType,
  );
  if (
    typeof value.id !== 'string' ||
    typeof value.agentId !== 'string' ||
    typeof value.inputText !== 'string' ||
    typeof value.outputText !== 'string' ||
    !validMemoryType ||
    !isNumberArray(value.embedding) ||
    typeof value.trustScore !== 'number' ||
    typeof value.createdAt !== 'string' ||
    typeof value.fingerprint !== 'string'
  ) {
    return undefined;
  }

  const output: MemoryObjectRecord = {
    id: value.id,
    agentId: value.agentId,
    inputText: value.inputText,
    outputText: value.outputText,
    memoryType: validMemoryType,
    embedding: value.embedding,
    trustScore: value.trustScore,
    createdAt: value.createdAt,
    fingerprint: value.fingerprint,
  };

  if (typeof value.governanceVerdict === 'string') {
    output.governanceVerdict = value.governanceVerdict;
  }
  if (typeof value.councilHash === 'string') {
    output.councilHash = value.councilHash;
  }
  return output;
}

function normalize(vector: number[]): number[] {
  let sumSquares = 0;
  for (const value of vector) {
    sumSquares += value * value;
  }
  if (sumSquares === 0) {
    return [...vector];
  }
  const magnitude = Math.sqrt(sumSquares);
  return vector.map((value) => value / magnitude);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
  }
  return dot;
}

export class SimpleEmbeddingService {
  private readonly cache = new Map<string, number[]>();
  private readonly cacheSize: number;
  private readonly provider?: EmbeddingProvider;
  private readonly dimension: number;

  constructor(options: {
    cacheSize?: number;
    provider?: EmbeddingProvider;
    dimension?: number;
  } = {}) {
    this.cacheSize = options.cacheSize ?? 1000;
    this.provider = options.provider;
    this.dimension = options.dimension ?? 1536;
  }

  async embedText(text: string): Promise<number[]> {
    const cached = this.cache.get(text);
    if (cached) {
      return [...cached];
    }

    let embedding: number[];
    if (this.provider) {
      try {
        embedding = await this.provider.embedText(text);
      } catch {
        embedding = this.syntheticEmbedding(text);
      }
    } else {
      embedding = this.syntheticEmbedding(text);
    }

    if (this.cache.size >= this.cacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(text, [...embedding]);
    return embedding;
  }

  private syntheticEmbedding(text: string): number[] {
    const embedding: number[] = [];
    for (let index = 0; index < this.dimension; index += 1) {
      const digest = createHash('sha256')
        .update(`${text}:${index}`)
        .digest();
      const value = (digest[0] / 255) * 2 - 1;
      embedding.push(value);
    }
    return embedding;
  }
}

export class SimpleVectorStorage {
  readonly dimension: number;
  private readonly vectors = new Map<string, number[]>();
  private readonly metadata = new Map<string, Record<string, unknown>>();

  constructor(dimension: number = 1536) {
    this.dimension = dimension;
  }

  addVector(
    fingerprint: string,
    vector: number[],
    metadata: Record<string, unknown> = {},
  ): void {
    if (vector.length !== this.dimension) {
      return;
    }
    this.vectors.set(fingerprint, normalize(vector));
    this.metadata.set(fingerprint, { ...metadata });
  }

  search(queryVector: number[], topK: number = 3): VectorSearchResult[] {
    if (this.vectors.size === 0 || queryVector.length !== this.dimension) {
      return [];
    }

    const normalizedQuery = normalize(queryVector);
    const scores: VectorSearchResult[] = [];
    for (const [fingerprint, vector] of this.vectors.entries()) {
      scores.push({
        fingerprint,
        similarity: cosineSimilarity(normalizedQuery, vector),
      });
    }

    scores.sort((left, right) => right.similarity - left.similarity);
    const limit = Math.max(0, Math.min(topK, scores.length));
    return scores.slice(0, limit);
  }

  get vectorCount(): number {
    return this.vectors.size;
  }
}

export class SimpleCognitiveDomain {
  readonly agentName: string;
  readonly cacheDir: string;
  readonly storage: SimpleVectorStorage;

  private readonly memories = new Map<string, MemoryObject>();
  private readonly memoryByFingerprint = new Map<string, string>();

  constructor(
    agentName: string,
    options: {
      cacheDir?: string;
      dimension?: number;
    } = {},
  ) {
    this.agentName = agentName;
    this.cacheDir = join(options.cacheDir ?? './.nexus_cache', agentName);
    this.storage = new SimpleVectorStorage(options.dimension ?? 1536);

    mkdirSync(this.cacheDir, { recursive: true });
    this.loadFromDisk();
  }

  ingestMemory(memory: MemoryObject): boolean {
    if (memory.fingerprint.length === 0) {
      memory.fingerprint = memory.computeFingerprint();
    }
    this.memories.set(memory.id, memory);
    this.memoryByFingerprint.set(memory.fingerprint, memory.id);

    if (memory.embedding.length > 0) {
      this.storage.addVector(memory.fingerprint, memory.embedding, {
        id: memory.id,
        memoryType: memory.memoryType,
      });
    }

    this.saveToDisk(memory);
    return true;
  }

  recall(queryVector: number[], topK: number = 3): MemoryObject[] {
    const matches = this.storage.search(queryVector, topK);
    const output: MemoryObject[] = [];
    for (const match of matches) {
      const memoryId = this.memoryByFingerprint.get(match.fingerprint);
      if (!memoryId) {
        continue;
      }
      const memory = this.memories.get(memoryId);
      if (!memory) {
        continue;
      }
      output.push(memory);
    }
    return output;
  }

  getMemoryCount(): number {
    return this.memories.size;
  }

  private saveToDisk(memory: MemoryObject): void {
    const path = join(this.cacheDir, 'memories.jsonl');
    appendFileSync(path, `${JSON.stringify(memory.toDict())}\n`, 'utf8');
  }

  private loadFromDisk(): void {
    const path = join(this.cacheDir, 'memories.jsonl');
    if (!existsSync(path)) {
      return;
    }
    const content = readFileSync(path, 'utf8');
    if (content.length === 0) {
      return;
    }

    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }
      try {
        const parsed = parseMemoryObjectRecord(JSON.parse(line));
        if (!parsed) {
          continue;
        }
        const memory = new MemoryObject(parsed);
        this.memories.set(memory.id, memory);
        this.memoryByFingerprint.set(memory.fingerprint, memory.id);
        if (memory.embedding.length === this.storage.dimension) {
          this.storage.addVector(memory.fingerprint, memory.embedding, {
            id: memory.id,
            memoryType: memory.memoryType,
          });
        }
      } catch {
        continue;
      }
    }
  }
}
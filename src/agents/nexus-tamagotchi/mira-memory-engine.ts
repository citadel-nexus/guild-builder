import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

type LoggerLike = Pick<Console, "debug" | "info" | "warn" | "error">;

function getLogger(logger?: LoggerLike): LoggerLike {
  return logger ?? console;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
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

function normalizeVector(vector: number[], dimension: number): number[] {
  if (vector.length === dimension) {
    return [...vector];
  }
  if (vector.length > dimension) {
    return vector.slice(0, dimension);
  }
  return [
    ...vector,
    ...new Array(Math.max(0, dimension - vector.length)).fill(0),
  ];
}

function deterministicEmbedding(text: string, dimension: number): number[] {
  const payload = text.trim().toLowerCase();
  const output = new Array<number>(dimension).fill(0);
  if (payload.length === 0) {
    return output;
  }
  for (let index = 0; index < payload.length; index += 1) {
    const charCode = payload.charCodeAt(index);
    output[index % dimension] += charCode / 255;
  }
  return output.map((value) =>
    clamp(value / Math.max(1, payload.length / 8), -1, 1),
  );
}

export type MiraMemoryConfig = {
  storageBasePath: string;
  stmFilename: string;
  embeddingDimension: number;
  stmMaxEntries: number;
  stmPruneToSize: number;
  consolidationThreshold: number;
  importanceWeight: number;
  recencyWeight: number;
  accessWeight: number;
  ltmDomains: string[];
  ltmIndexSuffix: string;
  ltmMapSuffix: string;
  enableTrustDecay: boolean;
  decayRate: number;
  attentionThreshold: number;
};

export const DEFAULT_MIRA_MEMORY_CONFIG: MiraMemoryConfig = {
  storageBasePath: join(".nexus_cache", "mira-memory"),
  stmFilename: "stm.jsonl",
  embeddingDimension: 64,
  stmMaxEntries: 1000,
  stmPruneToSize: 500,
  consolidationThreshold: 0.75,
  importanceWeight: 0.5,
  recencyWeight: 0.3,
  accessWeight: 0.2,
  ltmDomains: [
    "conversation",
    "facts",
    "skills",
    "user_preferences",
    "emotional_patterns",
    "semantic_knowledge",
    "procedural",
    "episodic",
  ],
  ltmIndexSuffix: ".index.json",
  ltmMapSuffix: ".map.json",
  enableTrustDecay: true,
  decayRate: 0.001,
  attentionThreshold: 0.6,
};

export function createMiraMemoryConfig(
  overrides: Partial<MiraMemoryConfig> = {},
): MiraMemoryConfig {
  return {
    ...DEFAULT_MIRA_MEMORY_CONFIG,
    ...overrides,
    ltmDomains: overrides.ltmDomains
      ? [...overrides.ltmDomains]
      : [...DEFAULT_MIRA_MEMORY_CONFIG.ltmDomains],
  };
}

export class MiraSTMEntry {
  entryId: string;
  timestamp: string;
  content: string;
  contentHash: string;
  embedding: number[];
  emotion: string;
  emotionIntensity: number;
  tags: string[];
  source: string;
  context: string;
  sessionId?: string;
  userId?: string;
  interactionId?: string;
  retentionScore: number;
  importanceScore: number;
  recencyScore: number;
  accessCount: number;
  consolidatedToLtm: boolean;
  consolidationTimestamp?: string;
  ltmEntryId?: string;
  predictedDomain: string;
  domainConfidence: number;

  constructor(input: {
    entryId?: string;
    timestamp?: string;
    content: string;
    contentHash?: string;
    embedding?: number[];
    emotion?: string;
    emotionIntensity?: number;
    tags?: string[];
    source?: string;
    context?: string;
    sessionId?: string;
    userId?: string;
    interactionId?: string;
    retentionScore?: number;
    importanceScore?: number;
    recencyScore?: number;
    accessCount?: number;
    consolidatedToLtm?: boolean;
    consolidationTimestamp?: string;
    ltmEntryId?: string;
    predictedDomain?: string;
    domainConfidence?: number;
  }) {
    this.entryId = input.entryId ?? `stm-${randomUUID()}`;
    this.timestamp = input.timestamp ?? nowIso();
    this.content = input.content;
    this.contentHash =
      input.contentHash ??
      createHash("sha256").update(input.content).digest("hex").slice(0, 16);
    this.embedding = input.embedding ? [...input.embedding] : [];
    this.emotion = input.emotion ?? "neutral";
    this.emotionIntensity = clamp(input.emotionIntensity ?? 0.5, 0, 1);
    this.tags = input.tags ? [...input.tags] : [];
    this.source = input.source ?? "interaction";
    this.context = input.context ?? "conversation";
    this.sessionId = input.sessionId;
    this.userId = input.userId;
    this.interactionId = input.interactionId;
    this.retentionScore = clamp(input.retentionScore ?? 0.5, 0, 1);
    this.importanceScore = clamp(input.importanceScore ?? 0.5, 0, 1);
    this.recencyScore = clamp(input.recencyScore ?? 1, 0, 1);
    this.accessCount = Math.max(0, Math.floor(input.accessCount ?? 0));
    this.consolidatedToLtm = input.consolidatedToLtm ?? false;
    this.consolidationTimestamp = input.consolidationTimestamp;
    this.ltmEntryId = input.ltmEntryId;
    this.predictedDomain = input.predictedDomain ?? "conversation";
    this.domainConfidence = clamp(input.domainConfidence ?? 0.5, 0, 1);
  }

  updateAccess(): void {
    this.accessCount += 1;
    this.recencyScore = 1;
  }

  toDict(): Record<string, unknown> {
    return {
      entryId: this.entryId,
      timestamp: this.timestamp,
      content: this.content,
      contentHash: this.contentHash,
      embedding: [...this.embedding],
      emotion: this.emotion,
      emotionIntensity: this.emotionIntensity,
      tags: [...this.tags],
      source: this.source,
      context: this.context,
      sessionId: this.sessionId,
      userId: this.userId,
      interactionId: this.interactionId,
      retentionScore: this.retentionScore,
      importanceScore: this.importanceScore,
      recencyScore: this.recencyScore,
      accessCount: this.accessCount,
      consolidatedToLtm: this.consolidatedToLtm,
      consolidationTimestamp: this.consolidationTimestamp,
      ltmEntryId: this.ltmEntryId,
      predictedDomain: this.predictedDomain,
      domainConfidence: this.domainConfidence,
    };
  }

  static fromDict(value: unknown): MiraSTMEntry {
    const record = parseRecord(value);
    return new MiraSTMEntry({
      entryId: parseString(record.entryId, `stm-${randomUUID()}`),
      timestamp: parseString(record.timestamp, nowIso()),
      content: parseString(record.content, ""),
      contentHash: parseString(record.contentHash, ""),
      embedding: parseNumberArray(record.embedding),
      emotion: parseString(record.emotion, "neutral"),
      emotionIntensity: parseNumber(record.emotionIntensity, 0.5),
      tags: parseStringArray(record.tags),
      source: parseString(record.source, "interaction"),
      context: parseString(record.context, "conversation"),
      sessionId:
        typeof record.sessionId === "string" ? record.sessionId : undefined,
      userId: typeof record.userId === "string" ? record.userId : undefined,
      interactionId:
        typeof record.interactionId === "string"
          ? record.interactionId
          : undefined,
      retentionScore: parseNumber(record.retentionScore, 0.5),
      importanceScore: parseNumber(record.importanceScore, 0.5),
      recencyScore: parseNumber(record.recencyScore, 1),
      accessCount: parseNumber(record.accessCount, 0),
      consolidatedToLtm: parseBoolean(record.consolidatedToLtm, false),
      consolidationTimestamp:
        typeof record.consolidationTimestamp === "string"
          ? record.consolidationTimestamp
          : undefined,
      ltmEntryId:
        typeof record.ltmEntryId === "string" ? record.ltmEntryId : undefined,
      predictedDomain: parseString(record.predictedDomain, "conversation"),
      domainConfidence: parseNumber(record.domainConfidence, 0.5),
    });
  }
}

export class MiraLTMEntry {
  entryId: string;
  domain: string;
  faissIndex: number;
  content: string;
  contentHash: string;
  summary: string;
  embedding: number[];
  creationTimestamp: string;
  lastAccessTimestamp: string;
  lastUpdateTimestamp: string;
  trustScore: number;
  accessCount: number;
  retrievalCount: number;
  consolidationSource: string;
  consolidationMethod: string;
  relatedEntries: string[];
  domainConfidence: number;
  tags: string[];
  source: string;
  userId?: string;

  constructor(input: {
    entryId?: string;
    domain?: string;
    faissIndex?: number;
    content?: string;
    contentHash?: string;
    summary?: string;
    embedding?: number[];
    creationTimestamp?: string;
    lastAccessTimestamp?: string;
    lastUpdateTimestamp?: string;
    trustScore?: number;
    accessCount?: number;
    retrievalCount?: number;
    consolidationSource?: string;
    consolidationMethod?: string;
    relatedEntries?: string[];
    domainConfidence?: number;
    tags?: string[];
    source?: string;
    userId?: string;
  }) {
    this.entryId =
      input.entryId ?? `ltm-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    this.domain = input.domain ?? "general";
    this.faissIndex = input.faissIndex ?? -1;
    this.content = input.content ?? "";
    this.contentHash =
      input.contentHash ??
      createHash("sha256").update(this.content).digest("hex").slice(0, 16);
    this.summary = input.summary ?? this.content.slice(0, 200);
    this.embedding = input.embedding ? [...input.embedding] : [];
    this.creationTimestamp = input.creationTimestamp ?? nowIso();
    this.lastAccessTimestamp = input.lastAccessTimestamp ?? nowIso();
    this.lastUpdateTimestamp = input.lastUpdateTimestamp ?? nowIso();
    this.trustScore = clamp(input.trustScore ?? 0.7, 0, 1);
    this.accessCount = Math.max(0, Math.floor(input.accessCount ?? 0));
    this.retrievalCount = Math.max(0, Math.floor(input.retrievalCount ?? 0));
    this.consolidationSource = input.consolidationSource ?? "";
    this.consolidationMethod = input.consolidationMethod ?? "direct";
    this.relatedEntries = input.relatedEntries ? [...input.relatedEntries] : [];
    this.domainConfidence = clamp(input.domainConfidence ?? 0.8, 0, 1);
    this.tags = input.tags ? [...input.tags] : [];
    this.source = input.source ?? "consolidation";
    this.userId = input.userId;
  }

  updateAccess(): void {
    this.accessCount += 1;
    this.retrievalCount += 1;
    this.lastAccessTimestamp = nowIso();
  }

  decayTrust(rate = 0.001, hoursElapsed = 1): void {
    const nextTrust = this.trustScore - rate * hoursElapsed;
    this.trustScore = clamp(nextTrust, 0.1, 1);
    this.lastUpdateTimestamp = nowIso();
  }

  toDict(): Record<string, unknown> {
    return {
      entryId: this.entryId,
      domain: this.domain,
      faissIndex: this.faissIndex,
      content: this.content,
      contentHash: this.contentHash,
      summary: this.summary,
      embedding: [...this.embedding],
      creationTimestamp: this.creationTimestamp,
      lastAccessTimestamp: this.lastAccessTimestamp,
      lastUpdateTimestamp: this.lastUpdateTimestamp,
      trustScore: this.trustScore,
      accessCount: this.accessCount,
      retrievalCount: this.retrievalCount,
      consolidationSource: this.consolidationSource,
      consolidationMethod: this.consolidationMethod,
      relatedEntries: [...this.relatedEntries],
      domainConfidence: this.domainConfidence,
      tags: [...this.tags],
      source: this.source,
      userId: this.userId,
    };
  }

  static fromDict(value: unknown): MiraLTMEntry {
    const record = parseRecord(value);
    return new MiraLTMEntry({
      entryId: parseString(record.entryId, `ltm-${randomUUID().slice(0, 12)}`),
      domain: parseString(record.domain, "general"),
      faissIndex: parseNumber(record.faissIndex, -1),
      content: parseString(record.content, ""),
      contentHash: parseString(record.contentHash, ""),
      summary: parseString(record.summary, ""),
      embedding: parseNumberArray(record.embedding),
      creationTimestamp: parseString(record.creationTimestamp, nowIso()),
      lastAccessTimestamp: parseString(record.lastAccessTimestamp, nowIso()),
      lastUpdateTimestamp: parseString(record.lastUpdateTimestamp, nowIso()),
      trustScore: parseNumber(record.trustScore, 0.7),
      accessCount: parseNumber(record.accessCount, 0),
      retrievalCount: parseNumber(record.retrievalCount, 0),
      consolidationSource: parseString(record.consolidationSource, ""),
      consolidationMethod: parseString(record.consolidationMethod, "direct"),
      relatedEntries: parseStringArray(record.relatedEntries),
      domainConfidence: parseNumber(record.domainConfidence, 0.8),
      tags: parseStringArray(record.tags),
      source: parseString(record.source, "consolidation"),
      userId: typeof record.userId === "string" ? record.userId : undefined,
    });
  }
}

export class MiraSearchResult {
  entry: MiraSTMEntry | MiraLTMEntry;
  similarityScore: number;
  attentionScore: number;
  source: "stm" | "ltm";
  domain?: string;
  combinedScore: number;

  constructor(input: {
    entry: MiraSTMEntry | MiraLTMEntry;
    similarityScore: number;
    attentionScore?: number;
    source?: "stm" | "ltm";
    domain?: string;
  }) {
    this.entry = input.entry;
    this.similarityScore = clamp(input.similarityScore, 0, 1);
    this.attentionScore = clamp(input.attentionScore ?? 0, 0, 1);
    this.source = input.source ?? "stm";
    this.domain = input.domain;
    this.combinedScore = 0;
    this.refreshCombinedScore();
  }

  refreshCombinedScore(): void {
    this.combinedScore = clamp(
      this.similarityScore * 0.7 + this.attentionScore * 0.3,
      0,
      1,
    );
  }
}

export type MiraConsolidationResult = {
  stmEntryId: string;
  ltmEntryId: string;
  domain: string;
  method: string;
  success: boolean;
  timestamp: string;
  error?: string;
};

export class MiraSTMBuffer {
  readonly config: MiraMemoryConfig;
  readonly storagePath: string;
  readonly stmFile: string;
  private readonly logger: LoggerLike;
  private readonly embeddingFn?: (text: string) => number[];
  private entries: MiraSTMEntry[] = [];
  private indexDirty = true;
  private readonly metrics = {
    injections: 0,
    searches: 0,
    prunes: 0,
    consolidations: 0,
  };

  constructor(
    options: {
      config?: MiraMemoryConfig;
      embeddingFn?: (text: string) => number[];
      logger?: LoggerLike;
    } = {},
  ) {
    this.config = options.config ?? createMiraMemoryConfig();
    this.embeddingFn = options.embeddingFn;
    this.logger = getLogger(options.logger);
    this.storagePath = this.config.storageBasePath;
    this.stmFile = join(this.storagePath, this.config.stmFilename);
    mkdirSync(dirname(this.stmFile), { recursive: true });
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!existsSync(this.stmFile)) {
      return;
    }
    try {
      const raw = readFileSync(this.stmFile, "utf8");
      this.entries = raw
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          try {
            return MiraSTMEntry.fromDict(JSON.parse(line));
          } catch {
            return undefined;
          }
        })
        .filter(
          (entry): entry is MiraSTMEntry => entry instanceof MiraSTMEntry,
        );
      this.indexDirty = true;
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to load Mira STM from disk: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
      this.entries = [];
    }
  }

  private generateEmbedding(text: string): number[] {
    const generated = this.embeddingFn
      ? this.embeddingFn(text)
      : deterministicEmbedding(text, this.config.embeddingDimension);
    return normalizeVector(generated, this.config.embeddingDimension);
  }

  private estimateEmotionIntensity(content: string): number {
    const exclamations = content.split("!").length - 1;
    const questions = content.split("?").length - 1;
    return clamp(0.5 + exclamations * 0.1 + questions * 0.05, 0, 1);
  }

  private estimateImportance(content: string): number {
    const words = content
      .trim()
      .split(/\s+/g)
      .filter((word) => word.length > 0);
    let score = 0.4;
    if (words.length > 10) {
      score += 0.1;
    }
    if (words.length > 30) {
      score += 0.1;
    }
    if (/\?/.test(content)) {
      score += 0.15;
    }
    if (/\b(i|my|me|myself)\b/i.test(content)) {
      score += 0.1;
    }
    if (/\bmy name\b/i.test(content)) {
      score += 0.15;
    }
    return clamp(score, 0, 1);
  }

  private predictDomain(content: string): {
    domain: string;
    confidence: number;
  } {
    const source = content.toLowerCase();
    const domainKeywords: Record<string, string[]> = {
      conversation: ["said", "asked", "replied", "conversation"],
      facts: ["fact", "known", "true", "definition"],
      skills: ["can", "able", "learn", "skill"],
      user_preferences: ["prefer", "favorite", "like", "hate"],
      emotional_patterns: ["feel", "happy", "sad", "angry", "excited"],
      semantic_knowledge: ["means", "concept", "theory"],
      procedural: ["how to", "steps", "process", "method"],
      episodic: ["remember", "yesterday", "last time", "when we"],
    };
    let bestDomain = "conversation";
    let bestScore = 0;
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (source.includes(keyword)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }
    return {
      domain: bestDomain,
      confidence: clamp(0.3 + bestScore * 0.2, 0.5, 0.95),
    };
  }

  inject(
    content: string,
    options: {
      emotion?: string;
      tags?: string[];
      source?: string;
      context?: string;
      sessionId?: string;
      userId?: string;
      interactionId?: string;
    } = {},
  ): MiraSTMEntry | undefined {
    const normalized = content.trim();
    if (normalized.length === 0) {
      return undefined;
    }
    const routing = this.predictDomain(normalized);
    const entry = new MiraSTMEntry({
      content: normalized,
      emotion: options.emotion ?? "neutral",
      tags: options.tags ?? [],
      source: options.source ?? "interaction",
      context: options.context ?? "conversation",
      sessionId: options.sessionId,
      userId: options.userId,
      interactionId: options.interactionId,
      embedding: this.generateEmbedding(normalized),
      emotionIntensity: this.estimateEmotionIntensity(normalized),
      importanceScore: this.estimateImportance(normalized),
      recencyScore: 1,
      retentionScore: 0.5,
      predictedDomain: routing.domain,
      domainConfidence: routing.confidence,
    });
    this.entries.push(entry);
    appendFileSync(this.stmFile, `${JSON.stringify(entry.toDict())}\n`, "utf8");
    this.metrics.injections += 1;
    this.indexDirty = true;
    this.pruneIfNeeded();
    return MiraSTMEntry.fromDict(entry.toDict());
  }

  private pruneIfNeeded(): void {
    if (this.entries.length <= this.config.stmMaxEntries) {
      return;
    }
    const scored = this.entries.map((entry) => {
      const accessScore = Math.min(1, entry.accessCount / 10);
      const retention =
        entry.importanceScore * this.config.importanceWeight +
        entry.recencyScore * this.config.recencyWeight +
        accessScore * this.config.accessWeight;
      entry.retentionScore = clamp(retention, 0, 1);
      return entry;
    });
    scored.sort((left, right) => right.retentionScore - left.retentionScore);
    this.entries = scored.slice(0, this.config.stmPruneToSize);
    this.metrics.prunes += 1;
    this.indexDirty = true;
    this.rewriteDisk();
  }

  private rewriteDisk(): void {
    const payload = this.entries
      .map((entry) => JSON.stringify(entry.toDict()))
      .join("\n");
    writeFileSync(
      this.stmFile,
      payload.length > 0 ? `${payload}\n` : "",
      "utf8",
    );
  }

  getRecent(limit = 10): MiraSTMEntry[] {
    const effective = Math.max(0, Math.floor(limit));
    return this.entries
      .slice(Math.max(0, this.entries.length - effective))
      .map((entry) => MiraSTMEntry.fromDict(entry.toDict()));
  }

  getEntry(entryId: string): MiraSTMEntry | undefined {
    const found = this.entries.find((entry) => entry.entryId === entryId);
    return found ? MiraSTMEntry.fromDict(found.toDict()) : undefined;
  }

  removeEntry(entryId: string): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.entryId !== entryId);
    const removed = this.entries.length !== before;
    if (removed) {
      this.rewriteDisk();
      this.indexDirty = true;
    }
    return removed;
  }

  private keywordSearch(
    query: string,
    topK: number,
    domainFilter?: string,
  ): MiraSearchResult[] {
    const queryWords = new Set(
      query.toLowerCase().split(/\s+/g).filter(Boolean),
    );
    const output: MiraSearchResult[] = [];
    for (const entry of this.entries) {
      if (domainFilter && entry.predictedDomain !== domainFilter) {
        continue;
      }
      const words = new Set(
        entry.content.toLowerCase().split(/\s+/g).filter(Boolean),
      );
      const overlap = [...queryWords].filter((word) => words.has(word)).length;
      if (overlap === 0) {
        continue;
      }
      output.push(
        new MiraSearchResult({
          entry: MiraSTMEntry.fromDict(entry.toDict()),
          similarityScore: clamp(overlap / Math.max(1, queryWords.size), 0, 1),
          attentionScore: 0,
          source: "stm",
          domain: entry.predictedDomain,
        }),
      );
    }
    output.sort((left, right) => right.combinedScore - left.combinedScore);
    return output.slice(0, Math.max(0, topK));
  }

  private computeAttentionScore(entry: MiraSTMEntry): number {
    const accessBoost = Math.min(0.2, entry.accessCount * 0.02);
    const score =
      entry.recencyScore * 0.3 +
      entry.importanceScore * 0.3 +
      entry.emotionIntensity * 0.1 +
      entry.domainConfidence * 0.1 +
      accessBoost;
    return clamp(score, 0, 1);
  }

  search(query: string, topK = 5, domainFilter?: string): MiraSearchResult[] {
    const normalized = query.trim();
    if (normalized.length === 0 || this.entries.length === 0) {
      return [];
    }
    this.metrics.searches += 1;
    const queryVector = this.generateEmbedding(normalized);
    const output: MiraSearchResult[] = [];
    for (const entry of this.entries) {
      if (domainFilter && entry.predictedDomain !== domainFilter) {
        continue;
      }
      const similarity = entry.embedding.length
        ? clamp(cosineSimilarity(queryVector, entry.embedding), 0, 1)
        : 0;
      if (similarity <= 0) {
        continue;
      }
      const attention = this.computeAttentionScore(entry);
      entry.updateAccess();
      output.push(
        new MiraSearchResult({
          entry: MiraSTMEntry.fromDict(entry.toDict()),
          similarityScore: similarity,
          attentionScore: attention,
          source: "stm",
          domain: entry.predictedDomain,
        }),
      );
    }
    if (output.length === 0) {
      return this.keywordSearch(normalized, topK, domainFilter);
    }
    output.sort((left, right) => right.combinedScore - left.combinedScore);
    return output.slice(0, Math.max(0, topK));
  }

  getConsolidationCandidates(threshold?: number): MiraSTMEntry[] {
    const effectiveThreshold = threshold ?? this.config.consolidationThreshold;
    const candidates: MiraSTMEntry[] = [];
    for (const entry of this.entries) {
      if (entry.consolidatedToLtm) {
        continue;
      }
      const score =
        entry.importanceScore * 0.4 +
        entry.retentionScore * 0.3 +
        entry.domainConfidence * 0.2 +
        Math.min(1, entry.accessCount / 5) * 0.1;
      if (score >= effectiveThreshold) {
        candidates.push(MiraSTMEntry.fromDict(entry.toDict()));
      }
    }
    candidates.sort(
      (left, right) => right.retentionScore - left.retentionScore,
    );
    return candidates;
  }

  markConsolidated(entryId: string, ltmEntryId: string): boolean {
    const target = this.entries.find((entry) => entry.entryId === entryId);
    if (!target) {
      return false;
    }
    target.consolidatedToLtm = true;
    target.consolidationTimestamp = nowIso();
    target.ltmEntryId = ltmEntryId;
    this.metrics.consolidations += 1;
    this.rewriteDisk();
    return true;
  }

  getEmotionTrajectory(window = 20): Array<Record<string, unknown>> {
    return this.getRecent(window).map((entry) => ({
      timestamp: entry.timestamp,
      emotion: entry.emotion,
      intensity: entry.emotionIntensity,
      contentPreview:
        entry.content.length > 50
          ? `${entry.content.slice(0, 50)}...`
          : entry.content,
    }));
  }

  getMetrics(): Record<string, unknown> {
    return {
      entryCount: this.entries.length,
      maxEntries: this.config.stmMaxEntries,
      ...this.metrics,
      indexDirty: this.indexDirty,
      diskFile: this.stmFile,
    };
  }
}

export class MiraLTMDomainIndex {
  readonly domain: string;
  readonly storagePath: string;
  readonly indexFile: string;
  readonly mapFile: string;
  private readonly config: MiraMemoryConfig;
  private readonly logger: LoggerLike;
  private entries = new Map<string, MiraLTMEntry>();
  private vectors: number[][] = [];
  private idToIndex = new Map<string, number>();
  private indexToId = new Map<number, string>();

  constructor(input: {
    domain: string;
    storagePath: string;
    config: MiraMemoryConfig;
    logger?: LoggerLike;
  }) {
    this.domain = input.domain;
    this.storagePath = input.storagePath;
    this.config = input.config;
    this.logger = getLogger(input.logger);
    mkdirSync(this.storagePath, { recursive: true });
    this.indexFile = join(
      this.storagePath,
      `${this.domain}${this.config.ltmIndexSuffix}`,
    );
    this.mapFile = join(
      this.storagePath,
      `${this.domain}${this.config.ltmMapSuffix}`,
    );
    this.load();
  }

  private load(): void {
    if (existsSync(this.indexFile)) {
      try {
        const parsed = JSON.parse(readFileSync(this.indexFile, "utf8"));
        if (Array.isArray(parsed)) {
          this.vectors = parsed.map((vector) =>
            normalizeVector(
              parseNumberArray(vector),
              this.config.embeddingDimension,
            ),
          );
        }
      } catch {
        this.vectors = [];
      }
    }
    if (existsSync(this.mapFile)) {
      try {
        const parsed = parseRecord(
          JSON.parse(readFileSync(this.mapFile, "utf8")),
        );
        const rawEntries = parseRecord(parsed.entries);
        const rawIdToIndex = parseRecord(parsed.idToIndex);
        const rawIndexToId = parseRecord(parsed.indexToId);
        for (const [entryId, value] of Object.entries(rawEntries)) {
          const entry = MiraLTMEntry.fromDict(value);
          this.entries.set(entryId, entry);
        }
        for (const [entryId, value] of Object.entries(rawIdToIndex)) {
          this.idToIndex.set(entryId, parseNumber(value, -1));
        }
        for (const [vectorIndex, value] of Object.entries(rawIndexToId)) {
          this.indexToId.set(
            parseNumber(vectorIndex, -1),
            parseString(value, ""),
          );
        }
      } catch (error: unknown) {
        this.logger.warn(
          `Failed to load LTM domain map for ${this.domain}: ${
            error instanceof Error ? error.message : "unknown"
          }`,
        );
      }
    }
  }

  save(): void {
    const vectorsPayload = JSON.stringify(this.vectors, null, 2);
    writeFileSync(this.indexFile, vectorsPayload, "utf8");
    const entriesPayload: Record<string, Record<string, unknown>> = {};
    for (const [entryId, entry] of this.entries.entries()) {
      entriesPayload[entryId] = entry.toDict();
    }
    const mapPayload = {
      entries: entriesPayload,
      idToIndex: Object.fromEntries(this.idToIndex.entries()),
      indexToId: Object.fromEntries(this.indexToId.entries()),
    };
    writeFileSync(this.mapFile, JSON.stringify(mapPayload, null, 2), "utf8");
  }

  insert(entry: MiraLTMEntry): boolean {
    const normalizedEmbedding = normalizeVector(
      entry.embedding,
      this.config.embeddingDimension,
    );
    if (normalizedEmbedding.length === 0 || this.idToIndex.has(entry.entryId)) {
      return false;
    }
    const vectorIndex = this.vectors.length;
    this.vectors.push(normalizedEmbedding);
    entry.embedding = normalizedEmbedding;
    entry.faissIndex = vectorIndex;
    this.entries.set(entry.entryId, entry);
    this.idToIndex.set(entry.entryId, vectorIndex);
    this.indexToId.set(vectorIndex, entry.entryId);
    return true;
  }

  search(
    queryEmbedding: number[],
    topK = 5,
  ): Array<{ similarity: number; entry: MiraLTMEntry }> {
    const normalizedQuery = normalizeVector(
      queryEmbedding,
      this.config.embeddingDimension,
    );
    if (normalizedQuery.length === 0 || this.vectors.length === 0) {
      return [];
    }
    const scored: Array<{ similarity: number; entry: MiraLTMEntry }> = [];
    for (let index = 0; index < this.vectors.length; index += 1) {
      const vector = this.vectors[index];
      const entryId = this.indexToId.get(index);
      if (!entryId) {
        continue;
      }
      const entry = this.entries.get(entryId);
      if (!entry) {
        continue;
      }
      const similarity = clamp(cosineSimilarity(normalizedQuery, vector), 0, 1);
      if (similarity <= 0) {
        continue;
      }
      entry.updateAccess();
      scored.push({
        similarity,
        entry: MiraLTMEntry.fromDict(entry.toDict()),
      });
    }
    scored.sort((left, right) => right.similarity - left.similarity);
    return scored.slice(0, Math.max(0, topK));
  }

  getEntry(entryId: string): MiraLTMEntry | undefined {
    const entry = this.entries.get(entryId);
    return entry ? MiraLTMEntry.fromDict(entry.toDict()) : undefined;
  }

  getMutableEntry(entryId: string): MiraLTMEntry | undefined {
    return this.entries.get(entryId);
  }

  getStats(): Record<string, unknown> {
    return {
      domain: this.domain,
      entryCount: this.entries.size,
      indexVectors: this.vectors.length,
      indexFile: this.indexFile,
      mapFile: this.mapFile,
    };
  }

  getEntryIds(): string[] {
    return [...this.entries.keys()];
  }
}

export class MiraLTMManager {
  readonly config: MiraMemoryConfig;
  readonly storagePath: string;
  private readonly logger: LoggerLike;
  private readonly embeddingFn?: (text: string) => number[];
  private readonly domains = new Map<string, MiraLTMDomainIndex>();
  private readonly metrics = {
    stores: 0,
    retrievals: 0,
    consolidations: 0,
    crossDomainLinks: 0,
  };

  constructor(
    options: {
      config?: MiraMemoryConfig;
      embeddingFn?: (text: string) => number[];
      logger?: LoggerLike;
    } = {},
  ) {
    this.config = options.config ?? createMiraMemoryConfig();
    this.embeddingFn = options.embeddingFn;
    this.logger = getLogger(options.logger);
    this.storagePath = join(this.config.storageBasePath, "ltm");
    mkdirSync(this.storagePath, { recursive: true });
    for (const domain of this.config.ltmDomains) {
      this.domains.set(
        domain,
        new MiraLTMDomainIndex({
          domain,
          storagePath: this.storagePath,
          config: this.config,
          logger: this.logger,
        }),
      );
    }
  }

  private generateEmbedding(text: string): number[] {
    const generated = this.embeddingFn
      ? this.embeddingFn(text)
      : deterministicEmbedding(text, this.config.embeddingDimension);
    return normalizeVector(generated, this.config.embeddingDimension);
  }

  private routeDomain(content: string): { domain: string; confidence: number } {
    const source = content.toLowerCase();
    const patterns: Record<string, RegExp[]> = {
      facts: [/\bfact\b/i, /\bdefinition\b/i, /\btrue\b/i],
      skills: [/\bcan\b/i, /\blearn\b/i, /\bskill\b/i],
      user_preferences: [
        /\bprefer\b/i,
        /\bfavorite\b/i,
        /\blike\b/i,
        /\bhate\b/i,
      ],
      emotional_patterns: [
        /\bfeel\b/i,
        /\bemotion\b/i,
        /\bhappy\b/i,
        /\bsad\b/i,
      ],
      procedural: [/\bhow to\b/i, /\bsteps?\b/i, /\bprocess\b/i],
      episodic: [/\bremember\b/i, /\byesterday\b/i, /\blast time\b/i],
      semantic_knowledge: [/\bconcept\b/i, /\btheory\b/i, /\bmeans\b/i],
    };
    let bestDomain = "conversation";
    let bestScore = 0;
    for (const [domain, regexes] of Object.entries(patterns)) {
      const score = regexes.reduce(
        (sum, regex) => sum + (regex.test(source) ? 1 : 0),
        0,
      );
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }
    return {
      domain: this.domains.has(bestDomain) ? bestDomain : "conversation",
      confidence: clamp(0.5 + bestScore * 0.1, 0.5, 0.95),
    };
  }

  store(
    content: string,
    options: {
      domain?: string;
      source?: string;
      userId?: string;
      tags?: string[];
      consolidationSource?: string;
      consolidationMethod?: string;
    } = {},
  ): MiraLTMEntry | undefined {
    const normalized = content.trim();
    if (normalized.length === 0) {
      return undefined;
    }
    const routed = options.domain
      ? { domain: options.domain, confidence: 0.9 }
      : this.routeDomain(normalized);
    const domain = this.domains.has(routed.domain)
      ? routed.domain
      : "conversation";
    const index = this.domains.get(domain);
    if (!index) {
      return undefined;
    }
    const entry = new MiraLTMEntry({
      domain,
      content: normalized,
      summary:
        normalized.length > 200 ? `${normalized.slice(0, 197)}...` : normalized,
      embedding: this.generateEmbedding(normalized),
      consolidationSource: options.consolidationSource ?? "",
      consolidationMethod: options.consolidationMethod ?? "direct",
      domainConfidence: routed.confidence,
      tags: options.tags ?? [],
      source: options.source ?? "direct",
      userId: options.userId,
    });
    const inserted = index.insert(entry);
    if (!inserted) {
      return undefined;
    }
    this.metrics.stores += 1;
    return MiraLTMEntry.fromDict(entry.toDict());
  }

  retrieve(query: string, domain?: string, topK = 5): MiraSearchResult[] {
    const normalized = query.trim();
    if (normalized.length === 0) {
      return [];
    }
    this.metrics.retrievals += 1;
    const queryEmbedding = this.generateEmbedding(normalized);
    const output: MiraSearchResult[] = [];
    const scopes =
      domain && this.domains.has(domain)
        ? [this.domains.get(domain)]
        : [...this.domains.values()];
    for (const scope of scopes) {
      if (!scope) {
        continue;
      }
      for (const match of scope.search(queryEmbedding, topK)) {
        output.push(
          new MiraSearchResult({
            entry: match.entry,
            similarityScore: match.similarity,
            attentionScore: this.computeAttention(match.entry),
            source: "ltm",
            domain: match.entry.domain,
          }),
        );
      }
    }
    output.sort((left, right) => right.combinedScore - left.combinedScore);
    return output.slice(0, Math.max(0, topK));
  }

  private computeAttention(entry: MiraLTMEntry): number {
    const accessBoost = Math.min(0.3, entry.accessCount * 0.03);
    return clamp(
      entry.trustScore * 0.4 + entry.domainConfidence * 0.2 + accessBoost,
      0,
      1,
    );
  }

  crossDomainSearch(
    query: string,
    domainWeights: Record<string, number> = {},
    topK = 5,
  ): MiraSearchResult[] {
    const normalized = query.trim();
    if (normalized.length === 0) {
      return [];
    }
    const queryEmbedding = this.generateEmbedding(normalized);
    const output: MiraSearchResult[] = [];
    for (const [domain, index] of this.domains.entries()) {
      const weight = domainWeights[domain] ?? 1;
      if (weight <= 0) {
        continue;
      }
      for (const match of index.search(queryEmbedding, topK * 2)) {
        output.push(
          new MiraSearchResult({
            entry: match.entry,
            similarityScore: clamp(match.similarity * weight, 0, 1),
            attentionScore: this.computeAttention(match.entry),
            source: "ltm",
            domain,
          }),
        );
      }
    }
    output.sort((left, right) => right.combinedScore - left.combinedScore);
    return output.slice(0, Math.max(0, topK));
  }

  consolidateFromStm(stmEntries: MiraSTMEntry[]): MiraConsolidationResult[] {
    const results: MiraConsolidationResult[] = [];
    for (const stmEntry of stmEntries) {
      if (stmEntry.consolidatedToLtm) {
        continue;
      }
      const stored = this.store(stmEntry.content, {
        domain: stmEntry.predictedDomain,
        source: "consolidation",
        userId: stmEntry.userId,
        tags: stmEntry.tags,
        consolidationSource: stmEntry.entryId,
        consolidationMethod: "direct",
      });
      const success = Boolean(stored);
      if (success) {
        this.metrics.consolidations += 1;
      }
      results.push({
        stmEntryId: stmEntry.entryId,
        ltmEntryId: stored?.entryId ?? "",
        domain: stmEntry.predictedDomain,
        method: "direct",
        success,
        timestamp: nowIso(),
        error: success ? undefined : "Failed to create LTM entry",
      });
    }
    return results;
  }

  applyTrustDecay(hoursElapsed = 1): number {
    if (!this.config.enableTrustDecay) {
      return 0;
    }
    let updated = 0;
    for (const index of this.domains.values()) {
      const entryIds = index.getEntryIds();
      if (entryIds.length === 0) {
        continue;
      }
      for (const id of entryIds) {
        const entry = index.getMutableEntry(id);
        if (!entry) {
          continue;
        }
        const before = entry.trustScore;
        entry.decayTrust(this.config.decayRate, hoursElapsed);
        if (entry.trustScore !== before) {
          updated += 1;
        }
      }
    }
    return updated;
  }

  getEntry(entryId: string): MiraLTMEntry | undefined {
    for (const index of this.domains.values()) {
      const entry = index.getEntry(entryId);
      if (entry) {
        return entry;
      }
    }
    return undefined;
  }

  getMutableEntry(entryId: string): MiraLTMEntry | undefined {
    for (const index of this.domains.values()) {
      const entry = index.getMutableEntry(entryId);
      if (entry) {
        return entry;
      }
    }
    return undefined;
  }

  saveAll(): void {
    for (const index of this.domains.values()) {
      index.save();
    }
  }

  getStats(): Record<string, unknown> {
    const domains: Record<string, Record<string, unknown>> = {};
    let totalEntries = 0;
    for (const [domain, index] of this.domains.entries()) {
      const stats = index.getStats() as Record<string, unknown>;
      domains[domain] = stats;
      totalEntries += parseNumber(stats.entryCount, 0);
    }
    return {
      totalEntries,
      domainCount: this.domains.size,
      domains,
      metrics: { ...this.metrics },
    };
  }
}

export enum MiraAttentionType {
  TEMPORAL = "temporal",
  SEMANTIC = "semantic",
  EMOTIONAL = "emotional",
  GOAL_DIRECTED = "goal_directed",
  NOVELTY = "novelty",
  SOCIAL = "social",
  HYBRID = "hybrid",
}

export enum MiraAttentionWeightProfile {
  BALANCED = "balanced",
  RECENCY_FOCUSED = "recency",
  RELEVANCE_FOCUSED = "relevance",
  EMOTIONAL_FOCUSED = "emotional",
  TASK_FOCUSED = "task",
}

export type MiraAttentionHead = {
  headId: string;
  attentionType: MiraAttentionType;
  weight: number;
  enabled: boolean;
  lastActivation: number;
  activationCount: number;
};

export type MiraAttentionContext = {
  query: string;
  queryEmbedding?: number[];
  currentGoal?: string;
  currentEmotion?: string;
  userId?: string;
  conversationId?: string;
  timestamp: string;
  domainFilter?: string;
  noveltyThreshold: number;
  recencyWindowHours: number;
};

export type MiraAttentionScore = {
  memoryId: string;
  totalScore: number;
  componentScores: Record<string, number>;
  winningHead: string;
  isAboveThreshold: boolean;
  attentionTimestamp: string;
};

function getMemoryTimestamp(entry: MiraSTMEntry | MiraLTMEntry): string {
  if (entry instanceof MiraSTMEntry) {
    return entry.timestamp;
  }
  return entry.lastAccessTimestamp || entry.creationTimestamp;
}

export class MiraAttentionMechanism {
  readonly threshold: number;
  private readonly heads = new Map<string, MiraAttentionHead>();
  private readonly config: MiraMemoryConfig;

  constructor(config: MiraMemoryConfig = createMiraMemoryConfig()) {
    this.config = config;
    this.threshold = config.attentionThreshold;
    this.initializeHeads();
  }

  private initializeHeads(): void {
    const defaults: MiraAttentionHead[] = [
      {
        headId: "temporal",
        attentionType: MiraAttentionType.TEMPORAL,
        weight: 0.15,
        enabled: true,
        lastActivation: 0,
        activationCount: 0,
      },
      {
        headId: "semantic",
        attentionType: MiraAttentionType.SEMANTIC,
        weight: 0.3,
        enabled: true,
        lastActivation: 0,
        activationCount: 0,
      },
      {
        headId: "emotional",
        attentionType: MiraAttentionType.EMOTIONAL,
        weight: 0.15,
        enabled: true,
        lastActivation: 0,
        activationCount: 0,
      },
      {
        headId: "goal",
        attentionType: MiraAttentionType.GOAL_DIRECTED,
        weight: 0.2,
        enabled: true,
        lastActivation: 0,
        activationCount: 0,
      },
      {
        headId: "novelty",
        attentionType: MiraAttentionType.NOVELTY,
        weight: 0.1,
        enabled: true,
        lastActivation: 0,
        activationCount: 0,
      },
      {
        headId: "social",
        attentionType: MiraAttentionType.SOCIAL,
        weight: 0.1,
        enabled: true,
        lastActivation: 0,
        activationCount: 0,
      },
    ];
    for (const head of defaults) {
      this.heads.set(head.headId, head);
    }
  }

  setProfile(profile: MiraAttentionWeightProfile): void {
    const profiles: Record<
      MiraAttentionWeightProfile,
      Record<string, number>
    > = {
      [MiraAttentionWeightProfile.BALANCED]: {
        temporal: 0.17,
        semantic: 0.17,
        emotional: 0.17,
        goal: 0.17,
        novelty: 0.16,
        social: 0.16,
      },
      [MiraAttentionWeightProfile.RECENCY_FOCUSED]: {
        temporal: 0.4,
        semantic: 0.25,
        emotional: 0.1,
        goal: 0.15,
        novelty: 0.05,
        social: 0.05,
      },
      [MiraAttentionWeightProfile.RELEVANCE_FOCUSED]: {
        temporal: 0.1,
        semantic: 0.45,
        emotional: 0.1,
        goal: 0.25,
        novelty: 0.05,
        social: 0.05,
      },
      [MiraAttentionWeightProfile.EMOTIONAL_FOCUSED]: {
        temporal: 0.1,
        semantic: 0.2,
        emotional: 0.4,
        goal: 0.1,
        novelty: 0.1,
        social: 0.1,
      },
      [MiraAttentionWeightProfile.TASK_FOCUSED]: {
        temporal: 0.1,
        semantic: 0.3,
        emotional: 0.05,
        goal: 0.45,
        novelty: 0.05,
        social: 0.05,
      },
    };
    const target = profiles[profile];
    for (const [headId, weight] of Object.entries(target)) {
      const head = this.heads.get(headId);
      if (head) {
        head.weight = weight;
      }
    }
  }

  private semanticAttention(
    context: MiraAttentionContext,
    memory: MiraSTMEntry | MiraLTMEntry,
  ): number {
    const memoryEmbedding = memory.embedding;
    if (context.queryEmbedding && memoryEmbedding.length > 0) {
      const query = normalizeVector(
        context.queryEmbedding,
        this.config.embeddingDimension,
      );
      const target = normalizeVector(
        memoryEmbedding,
        this.config.embeddingDimension,
      );
      return clamp((cosineSimilarity(query, target) + 1) / 2, 0, 1);
    }
    const queryWords = new Set(
      context.query.toLowerCase().split(/\s+/g).filter(Boolean),
    );
    const contentWords = new Set(
      memory.content.toLowerCase().split(/\s+/g).filter(Boolean),
    );
    const overlap = [...queryWords].filter((word) =>
      contentWords.has(word),
    ).length;
    return clamp(overlap / Math.max(1, queryWords.size), 0, 1);
  }

  private temporalAttention(
    context: MiraAttentionContext,
    memory: MiraSTMEntry | MiraLTMEntry,
  ): number {
    const now = new Date(context.timestamp).getTime();
    const then = new Date(getMemoryTimestamp(memory)).getTime();
    const hours = Math.max(0, (now - then) / 3_600_000);
    return clamp(
      Math.exp(-hours / Math.max(1, context.recencyWindowHours)),
      0,
      1,
    );
  }

  private emotionalAttention(
    context: MiraAttentionContext,
    memory: MiraSTMEntry | MiraLTMEntry,
  ): number {
    if (!(memory instanceof MiraSTMEntry)) {
      return 0.4;
    }
    if ((context.currentEmotion ?? "neutral") === memory.emotion) {
      return clamp(0.6 + memory.emotionIntensity * 0.4, 0, 1);
    }
    return clamp(memory.emotionIntensity * 0.6, 0, 1);
  }

  private goalAttention(
    context: MiraAttentionContext,
    memory: MiraSTMEntry | MiraLTMEntry,
  ): number {
    if (!context.currentGoal || context.currentGoal.trim().length === 0) {
      return 0.4;
    }
    const goalWords = new Set(
      context.currentGoal.toLowerCase().split(/\s+/g).filter(Boolean),
    );
    const contentWords = new Set(
      memory.content.toLowerCase().split(/\s+/g).filter(Boolean),
    );
    const overlap = [...goalWords].filter((word) =>
      contentWords.has(word),
    ).length;
    return clamp(overlap / Math.max(1, goalWords.size), 0, 1);
  }

  private noveltyAttention(memory: MiraSTMEntry | MiraLTMEntry): number {
    const accessCount = memory.accessCount;
    if (accessCount === 0) {
      return 0.9;
    }
    if (accessCount < 3) {
      return 0.7;
    }
    if (accessCount < 10) {
      return 0.5;
    }
    return 0.3;
  }

  private socialAttention(
    context: MiraAttentionContext,
    memory: MiraSTMEntry | MiraLTMEntry,
  ): number {
    if (context.userId && memory.userId === context.userId) {
      return 0.9;
    }
    if (memory.userId) {
      return 0.4;
    }
    return 0.5;
  }

  computeAttention(
    context: MiraAttentionContext,
    memory: MiraSTMEntry | MiraLTMEntry,
  ): MiraAttentionScore {
    const componentScores: Record<string, number> = {};
    let total = 0;
    let winner = "";
    let winnerScore = -1;
    for (const head of this.heads.values()) {
      if (!head.enabled) {
        continue;
      }
      let score = 0;
      switch (head.attentionType) {
        case MiraAttentionType.TEMPORAL:
          score = this.temporalAttention(context, memory);
          break;
        case MiraAttentionType.SEMANTIC:
          score = this.semanticAttention(context, memory);
          break;
        case MiraAttentionType.EMOTIONAL:
          score = this.emotionalAttention(context, memory);
          break;
        case MiraAttentionType.GOAL_DIRECTED:
          score = this.goalAttention(context, memory);
          break;
        case MiraAttentionType.NOVELTY:
          score = this.noveltyAttention(memory);
          break;
        case MiraAttentionType.SOCIAL:
          score = this.socialAttention(context, memory);
          break;
        default:
          score = 0.5;
      }
      const weighted = score * head.weight;
      componentScores[head.headId] = weighted;
      total += weighted;
      head.lastActivation = weighted;
      head.activationCount += 1;
      if (weighted > winnerScore) {
        winner = head.headId;
        winnerScore = weighted;
      }
    }
    const totalScore = clamp(total, 0, 1);
    return {
      memoryId: memory.entryId,
      totalScore,
      componentScores,
      winningHead: winner,
      isAboveThreshold: totalScore >= this.threshold,
      attentionTimestamp: nowIso(),
    };
  }

  applyAttentionToResults(
    context: MiraAttentionContext,
    results: MiraSearchResult[],
    minAttention = 0,
  ): MiraSearchResult[] {
    const output: MiraSearchResult[] = [];
    for (const result of results) {
      const attention = this.computeAttention(context, result.entry);
      if (attention.totalScore < minAttention) {
        continue;
      }
      output.push(
        new MiraSearchResult({
          entry: result.entry,
          similarityScore: result.similarityScore,
          attentionScore: attention.totalScore,
          source: result.source,
          domain: result.domain,
        }),
      );
    }
    output.sort((left, right) => right.combinedScore - left.combinedScore);
    return output;
  }
}

export enum MiraRetentionSignal {
  HIGH_IMPORTANCE = "high_importance",
  FREQUENT_ACCESS = "frequent_access",
  EMOTIONAL_SALIENCE = "emotional_salience",
  GOAL_RELEVANCE = "goal_relevance",
  USER_EXPLICIT = "user_explicit",
  CONSOLIDATION = "consolidation",
  DECAY_THRESHOLD = "decay_threshold",
  REDUNDANCY = "redundancy",
  CONTRADICTION = "contradiction",
}

export enum MiraRetentionDecision {
  PENDING = "pending",
  RETAIN = "retain",
  FORGET = "forget",
  CONSOLIDATE = "consolidate",
  COMPRESS = "compress",
}

export type MiraRetentionCandidate = {
  entry: MiraSTMEntry | MiraLTMEntry;
  retentionScore: number;
  signals: MiraRetentionSignal[];
  decision: MiraRetentionDecision;
  evaluatedAt: string;
  reason: string;
};

export type MiraRetentionConfig = {
  retainThreshold: number;
  forgetThreshold: number;
  consolidateThreshold: number;
  importanceWeight: number;
  accessWeight: number;
  emotionalWeight: number;
  recencyWeight: number;
  trustWeight: number;
  uniquenessWeight: number;
  minAgeForForgetHours: number;
  maxForgottenPerCycle: number;
  neverForgetTags: string[];
  alwaysForgetTags: string[];
};

export const DEFAULT_MIRA_RETENTION_CONFIG: MiraRetentionConfig = {
  retainThreshold: 0.6,
  forgetThreshold: 0.2,
  consolidateThreshold: 0.75,
  importanceWeight: 0.25,
  accessWeight: 0.2,
  emotionalWeight: 0.15,
  recencyWeight: 0.15,
  trustWeight: 0.15,
  uniquenessWeight: 0.1,
  minAgeForForgetHours: 24,
  maxForgottenPerCycle: 50,
  neverForgetTags: ["important", "user_marked", "core_knowledge", "identity"],
  alwaysForgetTags: ["temporary", "ephemeral", "test"],
};

export type MiraRetentionResult = {
  cycleId: string;
  timestamp: string;
  evaluatedCount: number;
  retainedCount: number;
  forgottenCount: number;
  consolidatedCount: number;
  compressedCount: number;
  pendingCount: number;
  decisions: MiraRetentionCandidate[];
};

export class MiraRetentionGate {
  readonly config: MiraRetentionConfig;
  private readonly stm?: MiraSTMBuffer;
  private readonly ltm?: MiraLTMManager;
  private readonly logger: LoggerLike;

  constructor(
    options: {
      config?: MiraRetentionConfig;
      stm?: MiraSTMBuffer;
      ltm?: MiraLTMManager;
      logger?: LoggerLike;
    } = {},
  ) {
    this.config = options.config ?? DEFAULT_MIRA_RETENTION_CONFIG;
    this.stm = options.stm;
    this.ltm = options.ltm;
    this.logger = getLogger(options.logger);
  }

  private computeRetentionScore(entry: MiraSTMEntry | MiraLTMEntry): number {
    const importance =
      entry instanceof MiraSTMEntry
        ? entry.importanceScore
        : clamp(entry.trustScore, 0, 1);
    const accessScore = Math.min(1, entry.accessCount * 0.1);
    const emotionScore =
      entry instanceof MiraSTMEntry
        ? entry.emotionIntensity
        : entry.domainConfidence;
    const recencyHours =
      (Date.now() - new Date(getMemoryTimestamp(entry)).getTime()) / 3_600_000;
    const recencyScore = clamp(1 - recencyHours / 168, 0, 1);
    const trustScore = entry instanceof MiraLTMEntry ? entry.trustScore : 1;
    const uniquenessScore = clamp(entry.content.length / 200, 0, 1);
    return clamp(
      importance * this.config.importanceWeight +
        accessScore * this.config.accessWeight +
        emotionScore * this.config.emotionalWeight +
        recencyScore * this.config.recencyWeight +
        trustScore * this.config.trustWeight +
        uniquenessScore * this.config.uniquenessWeight,
      0,
      1,
    );
  }

  evaluateEntry(entry: MiraSTMEntry | MiraLTMEntry): MiraRetentionCandidate {
    const tags = new Set(entry.tags);
    if (this.config.neverForgetTags.some((tag) => tags.has(tag))) {
      return {
        entry,
        retentionScore: 1,
        signals: [MiraRetentionSignal.USER_EXPLICIT],
        decision: MiraRetentionDecision.RETAIN,
        evaluatedAt: nowIso(),
        reason: "Protected by never-forget tag",
      };
    }
    if (this.config.alwaysForgetTags.some((tag) => tags.has(tag))) {
      return {
        entry,
        retentionScore: 0,
        signals: [MiraRetentionSignal.REDUNDANCY],
        decision: MiraRetentionDecision.FORGET,
        evaluatedAt: nowIso(),
        reason: "Marked with always-forget tag",
      };
    }
    const score = this.computeRetentionScore(entry);
    const signals: MiraRetentionSignal[] = [];
    if (entry instanceof MiraSTMEntry && entry.importanceScore > 0.7) {
      signals.push(MiraRetentionSignal.HIGH_IMPORTANCE);
    }
    if (entry.accessCount > 5) {
      signals.push(MiraRetentionSignal.FREQUENT_ACCESS);
    }
    if (entry instanceof MiraSTMEntry && entry.emotionIntensity > 0.6) {
      signals.push(MiraRetentionSignal.EMOTIONAL_SALIENCE);
    }
    if (
      entry instanceof MiraSTMEntry &&
      !entry.consolidatedToLtm &&
      score >= this.config.consolidateThreshold
    ) {
      signals.push(MiraRetentionSignal.CONSOLIDATION);
    }
    if (entry instanceof MiraLTMEntry && entry.trustScore < 0.3) {
      signals.push(MiraRetentionSignal.DECAY_THRESHOLD);
    }
    let decision = MiraRetentionDecision.RETAIN;
    if (score < this.config.forgetThreshold) {
      decision = MiraRetentionDecision.FORGET;
    } else if (signals.includes(MiraRetentionSignal.CONSOLIDATION)) {
      decision = MiraRetentionDecision.CONSOLIDATE;
    } else if (signals.includes(MiraRetentionSignal.DECAY_THRESHOLD)) {
      decision = MiraRetentionDecision.COMPRESS;
    } else if (score < this.config.retainThreshold) {
      decision = MiraRetentionDecision.PENDING;
    }
    return {
      entry,
      retentionScore: score,
      signals,
      decision,
      evaluatedAt: nowIso(),
      reason: `decision=${decision} score=${score.toFixed(2)}`,
    };
  }

  evaluateStmBatch(entries: MiraSTMEntry[]): MiraRetentionResult {
    const result: MiraRetentionResult = {
      cycleId: randomUUID().slice(0, 8),
      timestamp: nowIso(),
      evaluatedCount: entries.length,
      retainedCount: 0,
      forgottenCount: 0,
      consolidatedCount: 0,
      compressedCount: 0,
      pendingCount: 0,
      decisions: [],
    };
    let forgotten = 0;
    for (const entry of entries) {
      const candidate = this.evaluateEntry(entry);
      if (
        candidate.decision === MiraRetentionDecision.FORGET &&
        forgotten >= this.config.maxForgottenPerCycle
      ) {
        candidate.decision = MiraRetentionDecision.RETAIN;
        candidate.reason = "Forget quota reached";
      }
      result.decisions.push(candidate);
      switch (candidate.decision) {
        case MiraRetentionDecision.RETAIN:
          result.retainedCount += 1;
          break;
        case MiraRetentionDecision.FORGET:
          forgotten += 1;
          result.forgottenCount += 1;
          break;
        case MiraRetentionDecision.CONSOLIDATE:
          result.consolidatedCount += 1;
          break;
        case MiraRetentionDecision.COMPRESS:
          result.compressedCount += 1;
          break;
        default:
          result.pendingCount += 1;
      }
    }
    return result;
  }

  executeDecisions(result: MiraRetentionResult): Record<string, number> {
    const executed = {
      forgotten: 0,
      consolidated: 0,
      compressed: 0,
    };
    for (const candidate of result.decisions) {
      try {
        if (candidate.decision === MiraRetentionDecision.FORGET) {
          if (
            candidate.entry instanceof MiraSTMEntry &&
            this.stm?.removeEntry(candidate.entry.entryId)
          ) {
            executed.forgotten += 1;
          } else if (candidate.entry instanceof MiraLTMEntry) {
            const entry = this.ltm?.getMutableEntry(candidate.entry.entryId);
            if (entry) {
              entry.trustScore = 0;
              executed.forgotten += 1;
            }
          }
        } else if (candidate.decision === MiraRetentionDecision.CONSOLIDATE) {
          if (candidate.entry instanceof MiraSTMEntry && this.ltm) {
            const stored = this.ltm.store(candidate.entry.content, {
              domain: candidate.entry.predictedDomain,
              source: "consolidation",
              userId: candidate.entry.userId,
              tags: candidate.entry.tags,
              consolidationSource: candidate.entry.entryId,
              consolidationMethod: "direct",
            });
            if (stored) {
              this.stm?.markConsolidated(
                candidate.entry.entryId,
                stored.entryId,
              );
              executed.consolidated += 1;
            }
          }
        } else if (candidate.decision === MiraRetentionDecision.COMPRESS) {
          if (candidate.entry.content.length > 200) {
            candidate.entry.content = `${candidate.entry.content.slice(0, 197)}...`;
            candidate.entry.embedding = [];
            executed.compressed += 1;
          }
        }
      } catch (error: unknown) {
        this.logger.warn(
          `Failed to execute retention decision: ${
            error instanceof Error ? error.message : "unknown"
          }`,
        );
      }
    }
    return executed;
  }
}

export enum MiraLearningSignal {
  RETRIEVAL_SUCCESS = "retrieval_success",
  RETRIEVAL_FAILURE = "retrieval_failure",
  USER_FEEDBACK = "user_feedback",
  GOAL_ACHIEVED = "goal_achieved",
  GOAL_FAILED = "goal_failed",
  CONTRADICTION_DETECTED = "contradiction",
  PATTERN_DISCOVERED = "pattern_discovered",
  REINFORCEMENT = "reinforcement",
}

export enum MiraLearningMode {
  ONLINE = "online",
  BATCH = "batch",
  REINFORCEMENT = "rl",
  HEBBIAN = "hebbian",
  CONTRASTIVE = "contrastive",
}

export type MiraLearningEvent = {
  eventId: string;
  timestamp: string;
  signal: MiraLearningSignal;
  memoryIds: string[];
  context: Record<string, unknown>;
  reward: number;
  query?: string;
  feedback?: string;
};

export type MiraLearningUpdate = {
  memoryId: string;
  trustDelta: number;
  importanceDelta: number;
  accessIncrement: number;
  tagsToAdd: string[];
  tagsToRemove: string[];
  reason: string;
};

export type MiraLearningConfig = {
  baseLearningRate: number;
  trustLearningRate: number;
  importanceLearningRate: number;
  successReward: number;
  failurePenalty: number;
  userFeedbackWeight: number;
  hebbianStrength: number;
  hebbianDecay: number;
  discountFactor: number;
  eligibilityTrace: number;
  batchSize: number;
  minBatchForUpdate: number;
  maxTrust: number;
  minTrust: number;
  maxImportance: number;
  minImportance: number;
};

export const DEFAULT_MIRA_LEARNING_CONFIG: MiraLearningConfig = {
  baseLearningRate: 0.1,
  trustLearningRate: 0.05,
  importanceLearningRate: 0.03,
  successReward: 0.5,
  failurePenalty: -0.3,
  userFeedbackWeight: 1.5,
  hebbianStrength: 0.1,
  hebbianDecay: 0.01,
  discountFactor: 0.95,
  eligibilityTrace: 0.7,
  batchSize: 32,
  minBatchForUpdate: 10,
  maxTrust: 1,
  minTrust: 0,
  maxImportance: 1,
  minImportance: 0,
};

export class MiraMemoryLearningAlgorithm {
  mode: MiraLearningMode = MiraLearningMode.ONLINE;
  private readonly config: MiraLearningConfig;
  private readonly stm?: MiraSTMBuffer;
  private readonly ltm?: MiraLTMManager;
  private readonly eventBuffer: MiraLearningEvent[] = [];
  private readonly coactivation = new Map<string, number>();
  private readonly eligibility = new Map<string, number>();
  private readonly metrics = {
    eventsProcessed: 0,
    memoriesUpdated: 0,
    totalReward: 0,
    avgReward: 0,
  };

  constructor(
    options: {
      config?: MiraLearningConfig;
      stm?: MiraSTMBuffer;
      ltm?: MiraLTMManager;
    } = {},
  ) {
    this.config = options.config ?? DEFAULT_MIRA_LEARNING_CONFIG;
    this.stm = options.stm;
    this.ltm = options.ltm;
  }

  private makeEvent(
    signal: MiraLearningSignal,
    memoryIds: string[],
    reward: number,
    context: Record<string, unknown>,
    query?: string,
    feedback?: string,
  ): MiraLearningEvent {
    return {
      eventId: randomUUID().slice(0, 8),
      timestamp: nowIso(),
      signal,
      memoryIds: [...memoryIds],
      context: { ...context },
      reward,
      query,
      feedback,
    };
  }

  recordRetrievalOutcome(
    query: string,
    memoryIds: string[],
    wasHelpful: boolean,
    userFeedback?: number,
  ): MiraLearningEvent {
    let reward = wasHelpful
      ? this.config.successReward
      : this.config.failurePenalty;
    if (typeof userFeedback === "number") {
      reward = userFeedback * this.config.userFeedbackWeight;
    }
    const event = this.makeEvent(
      wasHelpful
        ? MiraLearningSignal.RETRIEVAL_SUCCESS
        : MiraLearningSignal.RETRIEVAL_FAILURE,
      memoryIds,
      reward,
      { wasHelpful },
      query,
    );
    this.eventBuffer.push(event);
    this.recordCoactivation(memoryIds);
    if (this.mode === MiraLearningMode.ONLINE) {
      this.processEvent(event);
    }
    return event;
  }

  processEvent(event: MiraLearningEvent): MiraLearningUpdate[] {
    const updates: MiraLearningUpdate[] = [];
    for (const memoryId of event.memoryIds) {
      const update = this.computeUpdate(memoryId, event);
      if (!update) {
        continue;
      }
      if (this.applyUpdate(update)) {
        updates.push(update);
      }
    }
    this.updateEligibility(event.memoryIds);
    this.metrics.eventsProcessed += 1;
    this.metrics.totalReward += event.reward;
    this.metrics.avgReward =
      this.metrics.totalReward / Math.max(1, this.metrics.eventsProcessed);
    return updates;
  }

  private computeUpdate(
    memoryId: string,
    event: MiraLearningEvent,
  ): MiraLearningUpdate | undefined {
    const update: MiraLearningUpdate = {
      memoryId,
      trustDelta: 0,
      importanceDelta: 0,
      accessIncrement: 0,
      tagsToAdd: [],
      tagsToRemove: [],
      reason: event.signal,
    };
    const reward = event.reward;
    switch (event.signal) {
      case MiraLearningSignal.RETRIEVAL_SUCCESS:
        update.trustDelta = this.config.trustLearningRate * reward;
        update.importanceDelta = this.config.importanceLearningRate * reward;
        update.accessIncrement = 1;
        break;
      case MiraLearningSignal.RETRIEVAL_FAILURE:
        update.trustDelta = this.config.trustLearningRate * reward;
        break;
      case MiraLearningSignal.USER_FEEDBACK:
        update.trustDelta = this.config.trustLearningRate * reward * 1.5;
        update.importanceDelta = this.config.importanceLearningRate * reward;
        break;
      case MiraLearningSignal.GOAL_ACHIEVED:
      case MiraLearningSignal.GOAL_FAILED: {
        const eligibility = this.eligibility.get(memoryId) ?? 1;
        update.trustDelta =
          this.config.trustLearningRate * reward * eligibility;
        update.importanceDelta =
          this.config.importanceLearningRate * reward * eligibility;
        break;
      }
      case MiraLearningSignal.REINFORCEMENT:
        update.accessIncrement = 1;
        update.trustDelta = 0.01;
        break;
      default:
        break;
    }
    if (
      update.trustDelta === 0 &&
      update.importanceDelta === 0 &&
      update.accessIncrement === 0
    ) {
      return undefined;
    }
    return update;
  }

  private applyUpdate(update: MiraLearningUpdate): boolean {
    const stmEntry = this.stm?.getEntry(update.memoryId);
    const ltmEntry = this.ltm?.getMutableEntry(update.memoryId);
    const target = stmEntry ?? ltmEntry;
    if (!target) {
      return false;
    }
    if (target instanceof MiraSTMEntry) {
      target.importanceScore = clamp(
        target.importanceScore + update.importanceDelta,
        this.config.minImportance,
        this.config.maxImportance,
      );
      target.accessCount += update.accessIncrement;
      target.tags = [...new Set([...target.tags, ...update.tagsToAdd])];
      target.tags = target.tags.filter(
        (tag) => !update.tagsToRemove.includes(tag),
      );
    } else {
      target.trustScore = clamp(
        target.trustScore + update.trustDelta,
        this.config.minTrust,
        this.config.maxTrust,
      );
      target.accessCount += update.accessIncrement;
      target.tags = [...new Set([...target.tags, ...update.tagsToAdd])];
      target.tags = target.tags.filter(
        (tag) => !update.tagsToRemove.includes(tag),
      );
    }
    this.metrics.memoriesUpdated += 1;
    return true;
  }

  private recordCoactivation(memoryIds: string[]): void {
    for (let left = 0; left < memoryIds.length; left += 1) {
      for (let right = left + 1; right < memoryIds.length; right += 1) {
        const key = [memoryIds[left], memoryIds[right]].sort().join(":");
        this.coactivation.set(key, (this.coactivation.get(key) ?? 0) + 1);
      }
    }
  }

  private updateEligibility(memoryIds: string[]): void {
    for (const key of [...this.eligibility.keys()]) {
      const next =
        (this.eligibility.get(key) ?? 0) * this.config.discountFactor;
      if (next < 0.01) {
        this.eligibility.delete(key);
      } else {
        this.eligibility.set(key, next);
      }
    }
    for (const id of memoryIds) {
      this.eligibility.set(id, this.config.eligibilityTrace);
    }
  }

  applyHebbianUpdate(): number {
    let applied = 0;
    for (const [key, count] of this.coactivation.entries()) {
      if (count < 3) {
        continue;
      }
      const [left, right] = key.split(":");
      const adjustment = clamp(
        count * this.config.hebbianStrength * 0.01,
        0,
        0.1,
      );
      const leftEntry = this.ltm?.getMutableEntry(left);
      const rightEntry = this.ltm?.getMutableEntry(right);
      if (leftEntry) {
        leftEntry.trustScore = clamp(leftEntry.trustScore + adjustment, 0, 1);
        applied += 1;
      }
      if (rightEntry) {
        rightEntry.trustScore = clamp(rightEntry.trustScore + adjustment, 0, 1);
        applied += 1;
      }
      this.coactivation.set(
        key,
        Math.floor(count * (1 - this.config.hebbianDecay)),
      );
    }
    return applied;
  }

  runBatchLearning(): Record<string, unknown> {
    if (this.eventBuffer.length < this.config.minBatchForUpdate) {
      return {
        eventsProcessed: 0,
        updatesApplied: 0,
        hebbianUpdates: 0,
      };
    }
    const batch = this.eventBuffer.splice(0, this.config.batchSize);
    let updatesApplied = 0;
    for (const event of batch) {
      updatesApplied += this.processEvent(event).length;
    }
    const hebbianUpdates = this.applyHebbianUpdate();
    return {
      eventsProcessed: batch.length,
      updatesApplied,
      hebbianUpdates,
    };
  }

  getLearningStats(): Record<string, unknown> {
    return {
      mode: this.mode,
      eventBufferSize: this.eventBuffer.length,
      coactivationPairs: this.coactivation.size,
      eligibilityCount: this.eligibility.size,
      metrics: { ...this.metrics },
    };
  }
}

export type MiraLoopIngestResult = {
  stmEntryId: string;
  retentionCandidate?: MiraRetentionCandidate;
  consolidatedLtmId?: string;
  notes: string;
};

export class MiraMemorySystem {
  readonly stm: MiraSTMBuffer;
  readonly ltm: MiraLTMManager;
  readonly retentionGate: MiraRetentionGate;
  readonly learner: MiraMemoryLearningAlgorithm;
  private readonly persistPath?: string;
  private lastPersistAt = 0;
  private readonly persistIntervalMs = 30_000;

  constructor(
    options: {
      stm?: MiraSTMBuffer;
      ltm?: MiraLTMManager;
      retentionGate?: MiraRetentionGate;
      learner?: MiraMemoryLearningAlgorithm;
      persistPath?: string;
    } = {},
  ) {
    this.stm = options.stm ?? new MiraSTMBuffer();
    this.ltm = options.ltm ?? new MiraLTMManager();
    this.retentionGate =
      options.retentionGate ??
      new MiraRetentionGate({
        stm: this.stm,
        ltm: this.ltm,
      });
    this.learner =
      options.learner ??
      new MiraMemoryLearningAlgorithm({
        stm: this.stm,
        ltm: this.ltm,
      });
    this.persistPath = options.persistPath;
  }

  ingest(input: {
    content: string;
    userId?: string;
    predictedDomain?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): MiraLoopIngestResult {
    const entry = this.stm.inject(input.content, {
      userId: input.userId,
      tags: input.tags,
      context: input.predictedDomain ?? "conversation",
      interactionId:
        typeof input.metadata?.interactionId === "string"
          ? input.metadata.interactionId
          : undefined,
    });
    if (!entry) {
      return { stmEntryId: "", notes: "empty_content" };
    }
    const mutable = this.stm.getEntry(entry.entryId);
    const candidate = mutable
      ? this.retentionGate.evaluateEntry(mutable)
      : undefined;
    let consolidatedLtmId: string | undefined;
    if (candidate?.decision === MiraRetentionDecision.CONSOLIDATE && mutable) {
      const stored = this.ltm.store(mutable.content, {
        domain: mutable.predictedDomain,
        source: "consolidation",
        userId: mutable.userId,
        tags: mutable.tags,
        consolidationSource: mutable.entryId,
      });
      if (stored) {
        consolidatedLtmId = stored.entryId;
        this.stm.markConsolidated(mutable.entryId, stored.entryId);
      }
    }
    this.maybePersist();
    return {
      stmEntryId: entry.entryId,
      retentionCandidate: candidate,
      consolidatedLtmId,
      notes: "ingested",
    };
  }

  retrieve(query: string, k = 6): MiraSearchResult[] {
    const stm = this.stm.search(query, k);
    const ltm = this.ltm.retrieve(query, undefined, k);
    const merged = [...stm, ...ltm];
    merged.sort((left, right) => right.combinedScore - left.combinedScore);
    return merged.slice(0, Math.max(0, k));
  }

  learn(event: MiraLearningEvent): Record<string, unknown> {
    const updates = this.learner.processEvent(event);
    this.maybePersist();
    return {
      ok: true,
      appliedCount: updates.length,
      updates: updates.map((update) => ({ ...update })),
    };
  }

  private maybePersist(): void {
    if (!this.persistPath) {
      return;
    }
    const now = Date.now();
    if (now - this.lastPersistAt < this.persistIntervalMs) {
      return;
    }
    this.lastPersistAt = now;
    this.persist();
  }

  persist(): void {
    if (!this.persistPath) {
      return;
    }
    mkdirSync(dirname(this.persistPath), { recursive: true });
    writeFileSync(
      this.persistPath,
      JSON.stringify(
        {
          timestamp: nowIso(),
          stm: this.stm.getMetrics(),
          ltm: this.ltm.getStats(),
          retention: this.retentionGate.config,
          learning: this.learner.getLearningStats(),
        },
        null,
        2,
      ),
      "utf8",
    );
  }
}

export type RecursiveLearningConfig = {
  maxDepth: number;
  minRewardToRetain: number;
  contradictionPenalty: number;
  successReward: number;
  failurePenalty: number;
};

export const DEFAULT_RECURSIVE_LEARNING_CONFIG: RecursiveLearningConfig = {
  maxDepth: 5,
  minRewardToRetain: 0.05,
  contradictionPenalty: 0.35,
  successReward: 0.4,
  failurePenalty: -0.3,
};

export class NestedRecursiveLearningController {
  readonly memory: MiraMemorySystem;
  readonly cfg: RecursiveLearningConfig;
  readonly mind?: {
    refineThought?: (
      thought: Record<string, unknown>,
    ) => Record<string, unknown>;
    evolveThoughts?: () => void;
  };

  constructor(options: {
    memory: MiraMemorySystem;
    cfg?: RecursiveLearningConfig;
    mind?: {
      refineThought?: (
        thought: Record<string, unknown>,
      ) => Record<string, unknown>;
      evolveThoughts?: () => void;
    };
  }) {
    this.memory = options.memory;
    this.cfg = options.cfg ?? DEFAULT_RECURSIVE_LEARNING_CONFIG;
    this.mind = options.mind;
  }

  processInteraction(input: {
    userText: string;
    agentText: string;
    userId?: string;
    monitoring?: Record<string, unknown>;
  }): Record<string, unknown> {
    const ingest = this.memory.ingest({
      content: `USER: ${input.userText}\nAGENT: ${input.agentText}`,
      userId: input.userId,
      predictedDomain: "conversation",
      tags: ["conversation", "turn"],
    });
    const thought: Record<string, unknown> = {
      id: createHash("sha256")
        .update(`${input.userText}|${input.agentText}`)
        .digest("hex")
        .slice(0, 12),
      refinementDepth: 0,
    };
    let evaluation: Record<string, unknown> | undefined;
    if (this.mind?.refineThought) {
      for (let depth = 0; depth < this.cfg.maxDepth; depth += 1) {
        evaluation = this.mind.refineThought(thought);
        if (evaluation.action !== "refine") {
          break;
        }
        thought.refinementDepth = depth + 1;
      }
      this.mind.evolveThoughts?.();
    }
    const monitoring = input.monitoring ?? {};
    const success = Boolean(monitoring.success ?? true);
    const contradiction = parseNumber(monitoring.contradictionProbability, 0);
    const reward = clamp(
      (success ? this.cfg.successReward : this.cfg.failurePenalty) -
        contradiction * this.cfg.contradictionPenalty,
      -1,
      1,
    );
    const memoryIds = [ingest.consolidatedLtmId ?? ingest.stmEntryId].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    const learningEvent: MiraLearningEvent = {
      eventId: randomUUID().slice(0, 8),
      timestamp: nowIso(),
      signal: MiraLearningSignal.REINFORCEMENT,
      memoryIds,
      context: {
        success,
        contradiction,
        action: evaluation?.action,
      },
      reward,
    };
    const learning =
      memoryIds.length > 0 ? this.memory.learn(learningEvent) : { ok: false };
    return {
      ingest,
      evaluation,
      reward,
      learning,
    };
  }
}

export type HarmfulMotif = {
  key: string;
  count: number;
  lastSeen: string;
  severity: number;
  example: Record<string, unknown>;
};

export class StructuralMotifLearner {
  private readonly motifs = new Map<string, HarmfulMotif>();

  private key(chain: string[], errorClass?: string): string {
    return createHash("sha256")
      .update(`${chain.slice(0, 8).join(">")}|${errorClass ?? ""}`)
      .digest("hex")
      .slice(0, 12);
  }

  observeFailure(input: {
    chain: string[];
    errorClass?: string;
    severity: number;
    context: Record<string, unknown>;
  }): HarmfulMotif {
    const key = this.key(input.chain, input.errorClass);
    const found = this.motifs.get(key);
    if (found) {
      found.count += 1;
      found.lastSeen = nowIso();
      found.severity = Math.max(found.severity, clamp(input.severity, 0, 1));
      return found;
    }
    const created: HarmfulMotif = {
      key,
      count: 1,
      lastSeen: nowIso(),
      severity: clamp(input.severity, 0, 1),
      example: {
        chain: [...input.chain],
        errorClass: input.errorClass,
        context: { ...input.context },
      },
    };
    this.motifs.set(key, created);
    return created;
  }

  topHarmful(limit = 10): HarmfulMotif[] {
    return [...this.motifs.values()]
      .sort(
        (left, right) =>
          right.severity * 10 + right.count - (left.severity * 10 + left.count),
      )
      .slice(0, Math.max(0, limit));
  }
}

export type AutonomyBudget = {
  budget: number;
  reason: string;
  components: Record<string, number>;
};

export class AutonomyPolicyGate {
  private readonly recent: Array<Record<string, unknown>> = [];

  computeBudget(monitoring: Record<string, unknown>): AutonomyBudget {
    const errorRate = clamp(parseNumber(monitoring.errorRate, 0), 0, 1);
    const p95LatencyMs = Math.max(0, parseNumber(monitoring.p95LatencyMs, 0));
    const satisfaction = clamp(parseNumber(monitoring.satisfaction, 0.5), 0, 1);
    const success = Boolean(monitoring.success ?? true);
    const errorPenalty = clamp(errorRate * 3, 0, 1);
    const latencyPenalty = clamp(p95LatencyMs / 1500, 0, 1);
    const satisfactionBoost = clamp((satisfaction - 0.5) * 1.2, -0.5, 0.5);
    let budget = 0.65 * (success ? 1 : 0) + 0.35 * (1 - errorPenalty);
    budget *= 1 - 0.35 * latencyPenalty;
    budget += satisfactionBoost;
    budget = clamp(budget, 0.05, 1);
    const reason =
      budget >= 0.7 ? "healthy" : budget >= 0.35 ? "degraded" : "unsafe";
    const output = {
      budget,
      reason,
      components: {
        errorPenalty,
        latencyPenalty,
        satisfaction,
      },
    };
    this.recent.push({ timestamp: nowIso(), ...output });
    if (this.recent.length > 200) {
      this.recent.splice(0, this.recent.length - 200);
    }
    return output;
  }

  shouldExecute(input: {
    actionType: string;
    monitoring: Record<string, unknown>;
  }): { allowed: boolean; policy: string; budget: AutonomyBudget } {
    const budget = this.computeBudget(input.monitoring);
    if (
      (input.actionType === "integration_write" ||
        input.actionType === "reflex_high_risk") &&
      budget.budget < 0.35
    ) {
      return {
        allowed: false,
        policy: "autonomy_budget_too_low",
        budget,
      };
    }
    if (
      (input.actionType === "integration_write" ||
        input.actionType === "reflex_high_risk") &&
      budget.budget < 0.7
    ) {
      return {
        allowed: true,
        policy: "require_review",
        budget,
      };
    }
    return {
      allowed: true,
      policy: "allowed",
      budget,
    };
  }
}

export enum MiraRehydrationSource {
  STM = "stm",
  LTM = "ltm",
  SESSION_STATE = "session_state",
  CONVERSATION = "conversation",
  COMBINED = "combined",
}

export enum MiraRehydrationStrategy {
  FULL = "full",
  MINIMAL = "minimal",
  SEMANTIC = "semantic",
  TEMPORAL = "temporal",
  HYBRID = "hybrid",
}

export type MiraRehydratedMemory = {
  memoryId: string;
  content: string;
  source: MiraRehydrationSource;
  relevanceScore: number;
  recencyScore: number;
  combinedScore: number;
  timestamp: string;
  domain?: string;
  tags: string[];
};

export type MiraSessionState = {
  sessionId: string;
  agentId: string;
  userId?: string;
  createdAt: string;
  lastInteractionAt: string;
  emotionalState: string;
  currentGoal?: string;
  activeConversationId?: string;
  conversationHistory: Array<Record<string, string>>;
  conversationSummary: string;
  stmEntryIds: string[];
  ltmEntryIds: string[];
  xpEarnedSession: number;
  tpEarnedSession: number;
  badgesEarnedSession: string[];
  rankAtStart: string;
  rankCurrent: string;
  activeSkills: string[];
  metadata: Record<string, unknown>;
};

export function createMiraSessionState(
  input: Partial<MiraSessionState> = {},
): MiraSessionState {
  const now = nowIso();
  return {
    sessionId: input.sessionId ?? randomUUID(),
    agentId: input.agentId ?? "",
    userId: input.userId,
    createdAt: input.createdAt ?? now,
    lastInteractionAt: input.lastInteractionAt ?? now,
    emotionalState: input.emotionalState ?? "neutral",
    currentGoal: input.currentGoal,
    activeConversationId: input.activeConversationId,
    conversationHistory: input.conversationHistory
      ? [...input.conversationHistory]
      : [],
    conversationSummary: input.conversationSummary ?? "",
    stmEntryIds: input.stmEntryIds ? [...input.stmEntryIds] : [],
    ltmEntryIds: input.ltmEntryIds ? [...input.ltmEntryIds] : [],
    xpEarnedSession: input.xpEarnedSession ?? 0,
    tpEarnedSession: input.tpEarnedSession ?? 0,
    badgesEarnedSession: input.badgesEarnedSession
      ? [...input.badgesEarnedSession]
      : [],
    rankAtStart: input.rankAtStart ?? "INITIATE",
    rankCurrent: input.rankCurrent ?? input.rankAtStart ?? "INITIATE",
    activeSkills: input.activeSkills ? [...input.activeSkills] : [],
    metadata: input.metadata ? { ...input.metadata } : {},
  };
}

export class MiraContextRehydrator {
  private readonly stm: MiraSTMBuffer;
  private readonly ltm: MiraLTMManager;
  private readonly attention?: MiraAttentionMechanism;
  private readonly sessionDir: string;
  private readonly logger: LoggerLike;
  private readonly sessions = new Map<string, MiraSessionState>();

  constructor(options: {
    stm: MiraSTMBuffer;
    ltm: MiraLTMManager;
    attention?: MiraAttentionMechanism;
    sessionDir?: string;
    logger?: LoggerLike;
  }) {
    this.stm = options.stm;
    this.ltm = options.ltm;
    this.attention = options.attention;
    this.sessionDir =
      options.sessionDir ??
      join(DEFAULT_MIRA_MEMORY_CONFIG.storageBasePath, "sessions");
    this.logger = getLogger(options.logger);
    mkdirSync(this.sessionDir, { recursive: true });
  }

  private sessionFile(sessionId: string): string {
    return join(this.sessionDir, `${sessionId}.json`);
  }

  startSession(input: {
    agentId: string;
    userId?: string;
    sessionId?: string;
    conversationId?: string;
    emotionalState?: string;
  }): MiraSessionState {
    const state = createMiraSessionState({
      sessionId: input.sessionId,
      agentId: input.agentId,
      userId: input.userId,
      activeConversationId: input.conversationId,
      emotionalState: input.emotionalState ?? "neutral",
    });
    this.sessions.set(state.sessionId, state);
    this.saveSession(state);
    return createMiraSessionState(state);
  }

  getSession(sessionId: string): MiraSessionState | undefined {
    const active = this.sessions.get(sessionId);
    if (active) {
      return createMiraSessionState(active);
    }
    const file = this.sessionFile(sessionId);
    if (!existsSync(file)) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      const session = createMiraSessionState(
        parseRecord(parsed) as Partial<MiraSessionState>,
      );
      this.sessions.set(sessionId, session);
      return createMiraSessionState(session);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to load session ${sessionId}: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
      return undefined;
    }
  }

  saveSession(session: MiraSessionState): void {
    const snapshot = createMiraSessionState(session);
    this.sessions.set(snapshot.sessionId, snapshot);
    writeFileSync(
      this.sessionFile(snapshot.sessionId),
      JSON.stringify(snapshot, null, 2),
      "utf8",
    );
  }

  updateSession(
    sessionId: string,
    patch: Partial<MiraSessionState>,
  ): MiraSessionState | undefined {
    const current = this.getSession(sessionId);
    if (!current) {
      return undefined;
    }
    const next = createMiraSessionState({
      ...current,
      ...patch,
      lastInteractionAt: nowIso(),
    });
    this.saveSession(next);
    return next;
  }

  rehydrateContext(input: {
    query: string;
    sessionId?: string;
    strategy?: MiraRehydrationStrategy;
    maxMemories?: number;
    domainFilter?: string;
  }): {
    rehydrated: MiraRehydratedMemory[];
    session?: MiraSessionState;
    contextSummary: string;
  } {
    const strategy = input.strategy ?? MiraRehydrationStrategy.HYBRID;
    const maxMemories = Math.max(1, input.maxMemories ?? 10);
    const session = input.sessionId
      ? this.getSession(input.sessionId)
      : undefined;
    const stmResults = this.stm.search(
      input.query,
      maxMemories,
      input.domainFilter,
    );
    const ltmResults = this.ltm.retrieve(
      input.query,
      input.domainFilter,
      maxMemories,
    );
    let merged = [...stmResults, ...ltmResults];

    if (this.attention) {
      const context: MiraAttentionContext = {
        query: input.query,
        queryEmbedding: deterministicEmbedding(
          input.query,
          DEFAULT_MIRA_MEMORY_CONFIG.embeddingDimension,
        ),
        currentGoal: session?.currentGoal,
        currentEmotion: session?.emotionalState,
        userId: session?.userId,
        conversationId: session?.activeConversationId,
        timestamp: nowIso(),
        domainFilter: input.domainFilter,
        noveltyThreshold: 0.6,
        recencyWindowHours: 72,
      };
      merged = this.attention.applyAttentionToResults(context, merged, 0);
    }

    switch (strategy) {
      case MiraRehydrationStrategy.MINIMAL:
        merged = merged.slice(0, Math.min(4, maxMemories));
        break;
      case MiraRehydrationStrategy.TEMPORAL:
        merged = merged
          .sort(
            (left, right) =>
              new Date(getMemoryTimestamp(right.entry)).getTime() -
              new Date(getMemoryTimestamp(left.entry)).getTime(),
          )
          .slice(0, maxMemories);
        break;
      case MiraRehydrationStrategy.SEMANTIC:
        merged = merged
          .sort((left, right) => right.similarityScore - left.similarityScore)
          .slice(0, maxMemories);
        break;
      default:
        merged = merged.slice(0, maxMemories);
    }

    const rehydrated = merged.map((result) => {
      const timestamp = getMemoryTimestamp(result.entry);
      const recency = clamp(
        1 - (Date.now() - new Date(timestamp).getTime()) / (7 * 24 * 3_600_000),
        0,
        1,
      );
      return {
        memoryId: result.entry.entryId,
        content: result.entry.content,
        source:
          result.source === "stm"
            ? MiraRehydrationSource.STM
            : MiraRehydrationSource.LTM,
        relevanceScore: result.similarityScore,
        recencyScore: recency,
        combinedScore: result.combinedScore,
        timestamp,
        domain: result.domain,
        tags: [...result.entry.tags],
      } satisfies MiraRehydratedMemory;
    });

    return {
      rehydrated,
      session,
      contextSummary: rehydrated
        .slice(0, 5)
        .map((item) => item.content.slice(0, 80))
        .join(" | "),
    };
  }
}

export enum MiraAssociationType {
  SEMANTIC = "semantic",
  TEMPORAL = "temporal",
  CAUSAL = "causal",
  CONTRADICTION = "contradiction",
  SUPPORTS = "supports",
  PART_OF = "part_of",
  SIMILAR = "similar",
}

export type MiraAssociationEdge = {
  sourceId: string;
  targetId: string;
  type: MiraAssociationType;
  weight: number;
  createdAt: string;
  lastActivatedAt: string;
  activationCount: number;
  metadata: Record<string, unknown>;
};

export class MiraMemoryAssociationNetwork {
  private readonly storagePath?: string;
  private readonly logger: LoggerLike;
  private readonly edges = new Map<string, MiraAssociationEdge>();
  private readonly adjacency = new Map<string, Set<string>>();

  constructor(options: { storagePath?: string; logger?: LoggerLike } = {}) {
    this.storagePath = options.storagePath;
    this.logger = getLogger(options.logger);
    if (this.storagePath && existsSync(this.storagePath)) {
      this.load();
    }
  }

  private edgeKey(
    sourceId: string,
    targetId: string,
    type: MiraAssociationType,
  ): string {
    return `${sourceId}:${targetId}:${type}`;
  }

  addAssociation(input: {
    sourceId: string;
    targetId: string;
    type: MiraAssociationType;
    weight?: number;
    metadata?: Record<string, unknown>;
  }): MiraAssociationEdge {
    const key = this.edgeKey(input.sourceId, input.targetId, input.type);
    const existing = this.edges.get(key);
    if (existing) {
      existing.weight = clamp(
        (existing.weight + (input.weight ?? existing.weight)) / 2,
        0,
        1,
      );
      existing.lastActivatedAt = nowIso();
      existing.activationCount += 1;
      existing.metadata = {
        ...existing.metadata,
        ...(input.metadata ?? {}),
      };
      this.persist();
      return { ...existing, metadata: { ...existing.metadata } };
    }
    const edge: MiraAssociationEdge = {
      sourceId: input.sourceId,
      targetId: input.targetId,
      type: input.type,
      weight: clamp(input.weight ?? 0.5, 0, 1),
      createdAt: nowIso(),
      lastActivatedAt: nowIso(),
      activationCount: 1,
      metadata: { ...(input.metadata ?? {}) },
    };
    this.edges.set(key, edge);
    if (!this.adjacency.has(input.sourceId)) {
      this.adjacency.set(input.sourceId, new Set());
    }
    this.adjacency.get(input.sourceId)?.add(key);
    this.persist();
    return { ...edge, metadata: { ...edge.metadata } };
  }

  getAssociations(memoryId: string): MiraAssociationEdge[] {
    const keys = this.adjacency.get(memoryId);
    if (!keys) {
      return [];
    }
    return [...keys]
      .map((key) => this.edges.get(key))
      .filter((edge): edge is MiraAssociationEdge => Boolean(edge))
      .sort((left, right) => right.weight - left.weight)
      .map((edge) => ({ ...edge, metadata: { ...edge.metadata } }));
  }

  activatePath(memoryIds: string[]): number {
    let activated = 0;
    for (let index = 0; index < memoryIds.length - 1; index += 1) {
      const source = memoryIds[index];
      const target = memoryIds[index + 1];
      for (const edgeType of Object.values(MiraAssociationType)) {
        const key = this.edgeKey(source, target, edgeType);
        const edge = this.edges.get(key);
        if (!edge) {
          continue;
        }
        edge.activationCount += 1;
        edge.lastActivatedAt = nowIso();
        edge.weight = clamp(edge.weight + 0.01, 0, 1);
        activated += 1;
      }
    }
    if (activated > 0) {
      this.persist();
    }
    return activated;
  }

  inferAssociations(
    memoryIds: string[],
    minCooccurrence = 2,
  ): MiraAssociationEdge[] {
    const inferred: MiraAssociationEdge[] = [];
    const count = new Map<string, number>();
    for (let left = 0; left < memoryIds.length; left += 1) {
      for (let right = left + 1; right < memoryIds.length; right += 1) {
        const key = [memoryIds[left], memoryIds[right]].sort().join(":");
        count.set(key, (count.get(key) ?? 0) + 1);
      }
    }
    for (const [pair, cooccurrence] of count.entries()) {
      if (cooccurrence < minCooccurrence) {
        continue;
      }
      const [sourceId, targetId] = pair.split(":");
      inferred.push(
        this.addAssociation({
          sourceId,
          targetId,
          type: MiraAssociationType.SEMANTIC,
          weight: clamp(cooccurrence / 10, 0.1, 0.9),
          metadata: { inferred: true, cooccurrence },
        }),
      );
    }
    return inferred;
  }

  save(path?: string): void {
    const target = path ?? this.storagePath;
    if (!target) {
      return;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      JSON.stringify(
        {
          edges: [...this.edges.values()],
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  private persist(): void {
    if (!this.storagePath) {
      return;
    }
    this.save(this.storagePath);
  }

  private load(): void {
    if (!this.storagePath || !existsSync(this.storagePath)) {
      return;
    }
    try {
      const parsed = parseRecord(
        JSON.parse(readFileSync(this.storagePath, "utf8")),
      );
      const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : [];
      for (const value of rawEdges) {
        const record = parseRecord(value);
        const edge: MiraAssociationEdge = {
          sourceId: parseString(record.sourceId, ""),
          targetId: parseString(record.targetId, ""),
          type: parseString(
            record.type,
            MiraAssociationType.SEMANTIC,
          ) as MiraAssociationType,
          weight: clamp(parseNumber(record.weight, 0.5), 0, 1),
          createdAt: parseString(record.createdAt, nowIso()),
          lastActivatedAt: parseString(record.lastActivatedAt, nowIso()),
          activationCount: Math.max(
            0,
            Math.floor(parseNumber(record.activationCount, 0)),
          ),
          metadata: parseRecord(record.metadata),
        };
        if (!edge.sourceId || !edge.targetId) {
          continue;
        }
        const key = this.edgeKey(edge.sourceId, edge.targetId, edge.type);
        this.edges.set(key, edge);
        if (!this.adjacency.has(edge.sourceId)) {
          this.adjacency.set(edge.sourceId, new Set());
        }
        this.adjacency.get(edge.sourceId)?.add(key);
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to load association network: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
    }
  }

  getStats(): Record<string, unknown> {
    return {
      edgeCount: this.edges.size,
      nodeCount: this.adjacency.size,
      averageOutDegree:
        this.adjacency.size === 0
          ? 0
          : [...this.adjacency.values()].reduce(
              (sum, edges) => sum + edges.size,
              0,
            ) / this.adjacency.size,
    };
  }
}

export enum MiraConsolidationTaskType {
  STM_TO_LTM = "stm_to_ltm",
  LTM_MERGE = "ltm_merge",
  TRUST_DECAY = "trust_decay",
  ASSOCIATION_INFERENCE = "association_inference",
  RETENTION_CYCLE = "retention_cycle",
}

export type MiraConsolidationTask = {
  taskId: string;
  type: MiraConsolidationTaskType;
  scheduledAt: string;
  metadata: Record<string, unknown>;
};

export class MiraMemoryConsolidationScheduler {
  private readonly stm: MiraSTMBuffer;
  private readonly ltm: MiraLTMManager;
  private readonly retention: MiraRetentionGate;
  private readonly associationNetwork?: MiraMemoryAssociationNetwork;
  private readonly logger: LoggerLike;
  private readonly queue: MiraConsolidationTask[] = [];
  private readonly history: Array<Record<string, unknown>> = [];

  constructor(options: {
    stm: MiraSTMBuffer;
    ltm: MiraLTMManager;
    retention: MiraRetentionGate;
    associationNetwork?: MiraMemoryAssociationNetwork;
    logger?: LoggerLike;
  }) {
    this.stm = options.stm;
    this.ltm = options.ltm;
    this.retention = options.retention;
    this.associationNetwork = options.associationNetwork;
    this.logger = getLogger(options.logger);
  }

  schedule(
    type: MiraConsolidationTaskType,
    metadata: Record<string, unknown> = {},
  ): MiraConsolidationTask {
    const task: MiraConsolidationTask = {
      taskId: randomUUID().slice(0, 8),
      type,
      scheduledAt: nowIso(),
      metadata: { ...metadata },
    };
    this.queue.push(task);
    return task;
  }

  runNext(): Record<string, unknown> | undefined {
    const task = this.queue.shift();
    if (!task) {
      return undefined;
    }
    const started = Date.now();
    try {
      let output: Record<string, unknown> = {};
      switch (task.type) {
        case MiraConsolidationTaskType.STM_TO_LTM: {
          const candidates = this.stm.getConsolidationCandidates();
          const result = this.ltm.consolidateFromStm(candidates);
          for (const item of result) {
            if (item.success && item.ltmEntryId) {
              this.stm.markConsolidated(item.stmEntryId, item.ltmEntryId);
            }
          }
          output = {
            candidates: candidates.length,
            consolidated: result.filter((item) => item.success).length,
          };
          break;
        }
        case MiraConsolidationTaskType.RETENTION_CYCLE: {
          const recent = this.stm.getRecent(200);
          const evaluated = this.retention.evaluateStmBatch(recent);
          const executed = this.retention.executeDecisions(evaluated);
          output = { evaluated, executed };
          break;
        }
        case MiraConsolidationTaskType.TRUST_DECAY: {
          const hours = parseNumber(task.metadata.hoursElapsed, 1);
          const updated = this.ltm.applyTrustDecay(hours);
          output = { updated, hours };
          break;
        }
        case MiraConsolidationTaskType.ASSOCIATION_INFERENCE: {
          if (!this.associationNetwork) {
            output = {
              skipped: true,
              reason: "association_network_unavailable",
            };
            break;
          }
          const ids = this.stm
            .getRecent(50)
            .map((entry) => entry.ltmEntryId ?? entry.entryId)
            .filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            );
          const inferred = this.associationNetwork.inferAssociations(ids);
          output = { inferred: inferred.length };
          break;
        }
        case MiraConsolidationTaskType.LTM_MERGE:
          output = { merged: 0, notes: "placeholder_for_merge_strategy" };
          break;
        default:
          output = { skipped: true };
      }
      const record = {
        taskId: task.taskId,
        type: task.type,
        success: true,
        durationMs: Date.now() - started,
        output,
        timestamp: nowIso(),
      };
      this.history.push(record);
      return record;
    } catch (error: unknown) {
      const record = {
        taskId: task.taskId,
        type: task.type,
        success: false,
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.message : "unknown",
        timestamp: nowIso(),
      };
      this.history.push(record);
      this.logger.warn(`Consolidation task failed: ${record.error}`);
      return record;
    }
  }

  runAll(limit = 10): Array<Record<string, unknown>> {
    const output: Array<Record<string, unknown>> = [];
    for (let i = 0; i < limit; i += 1) {
      const item = this.runNext();
      if (!item) {
        break;
      }
      output.push(item);
    }
    return output;
  }

  getStats(): Record<string, unknown> {
    return {
      queueSize: this.queue.length,
      historySize: this.history.length,
      recent: this.history.slice(-20),
    };
  }
}

export type MiraAnalyticsSnapshot = {
  timestamp: string;
  stmEntryCount: number;
  ltmEntryCount: number;
  avgStmImportance: number;
  avgLtmTrust: number;
  consolidationRate: number;
  retrievalRate: number;
  topDomains: Record<string, number>;
  emotionDistribution: Record<string, number>;
};

export class MiraMemoryAnalyticsEngine {
  private readonly stm: MiraSTMBuffer;
  private readonly ltm: MiraLTMManager;
  private readonly learner?: MiraMemoryLearningAlgorithm;
  private readonly associationNetwork?: MiraMemoryAssociationNetwork;
  private readonly snapshots: MiraAnalyticsSnapshot[] = [];

  constructor(options: {
    stm: MiraSTMBuffer;
    ltm: MiraLTMManager;
    learner?: MiraMemoryLearningAlgorithm;
    associationNetwork?: MiraMemoryAssociationNetwork;
  }) {
    this.stm = options.stm;
    this.ltm = options.ltm;
    this.learner = options.learner;
    this.associationNetwork = options.associationNetwork;
  }

  computeAnalytics(): MiraAnalyticsSnapshot {
    const stmEntries = this.stm.getRecent(1000);
    const ltmStats = this.ltm.getStats();
    const domainStats = parseRecord(parseRecord(ltmStats).domains);
    const topDomains: Record<string, number> = {};
    let ltmEntryCount = 0;
    for (const [domain, stats] of Object.entries(domainStats)) {
      const count = parseNumber(parseRecord(stats).entryCount, 0);
      topDomains[domain] = count;
      ltmEntryCount += count;
    }
    const avgStmImportance =
      stmEntries.length === 0
        ? 0
        : stmEntries.reduce((sum, entry) => sum + entry.importanceScore, 0) /
          stmEntries.length;
    const emotionDistribution: Record<string, number> = {};
    for (const entry of stmEntries) {
      emotionDistribution[entry.emotion] =
        (emotionDistribution[entry.emotion] ?? 0) + 1;
    }
    const learningMetrics = parseRecord(
      parseRecord(this.learner?.getLearningStats()).metrics,
    );
    const totalReward = parseNumber(learningMetrics.totalReward, 0);
    const events = Math.max(1, parseNumber(learningMetrics.eventsProcessed, 0));
    const snapshot: MiraAnalyticsSnapshot = {
      timestamp: nowIso(),
      stmEntryCount: stmEntries.length,
      ltmEntryCount,
      avgStmImportance,
      avgLtmTrust: clamp(totalReward / events, 0, 1),
      consolidationRate: parseNumber(
        parseRecord(parseRecord(ltmStats).metrics).consolidations,
        0,
      ),
      retrievalRate: parseNumber(
        parseRecord(parseRecord(ltmStats).metrics).retrievals,
        0,
      ),
      topDomains,
      emotionDistribution,
    };
    this.snapshots.push(snapshot);
    if (this.snapshots.length > 1000) {
      this.snapshots.splice(0, this.snapshots.length - 1000);
    }
    return snapshot;
  }

  getRecentSnapshots(limit = 50): MiraAnalyticsSnapshot[] {
    return this.snapshots.slice(-Math.max(0, limit));
  }

  getNetworkStats(): Record<string, unknown> {
    return this.associationNetwork?.getStats() ?? { unavailable: true };
  }
}

export enum MiraIntegrationStatus {
  OK = "ok",
  WARN = "warn",
  FAIL = "fail",
  UNKNOWN = "unknown",
}

export type MiraIntegrationHealth = {
  name: string;
  status: MiraIntegrationStatus;
  lastCheck: string;
  latencyMs?: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
};

export type MiraIntrospectionReport = {
  timestamp: string;
  agentId: string;
  agentName: string;
  stmEntryCount: number;
  ltmTotalVectors: number;
  ltmDomains: Record<string, number>;
  currentEmotion: string;
  emotionHistory: string[];
  emotionalStability: number;
  integrations: Record<string, MiraIntegrationHealth>;
  selfDescription: string;
  capabilities: string[];
  limitations: string[];
};

export class MiraSelfAwarenessModule {
  private readonly agentId: string;
  private readonly agentName: string;
  private readonly stm?: MiraSTMBuffer;
  private readonly ltm?: MiraLTMManager;
  private readonly analytics?: MiraMemoryAnalyticsEngine;
  private readonly logger: LoggerLike;
  private emotion = "neutral";
  private readonly emotionHistory: string[] = [];
  private readonly maxEmotionHistory = 100;
  private readonly integrationCheckers = new Map<
    string,
    () => MiraIntegrationHealth
  >();
  private readonly capabilities = [
    "Natural language conversation",
    "Memory storage and retrieval",
    "Semantic search across memories",
    "Learning from interactions",
    "Emotion tracking",
    "Multi-domain routing",
  ];
  private readonly limitations = [
    "No real-time internet access in sandbox",
    "No out-of-band execution privileges",
    "Dependent on available embeddings",
  ];

  constructor(
    options: {
      agentId?: string;
      agentName?: string;
      stm?: MiraSTMBuffer;
      ltm?: MiraLTMManager;
      analytics?: MiraMemoryAnalyticsEngine;
      logger?: LoggerLike;
    } = {},
  ) {
    this.agentId = options.agentId ?? "";
    this.agentName = options.agentName ?? "Nexus Agent";
    this.stm = options.stm;
    this.ltm = options.ltm;
    this.analytics = options.analytics;
    this.logger = getLogger(options.logger);
  }

  updateEmotion(emotion: string): void {
    this.emotion = emotion;
    this.emotionHistory.push(emotion);
    if (this.emotionHistory.length > this.maxEmotionHistory) {
      this.emotionHistory.splice(
        0,
        this.emotionHistory.length - this.maxEmotionHistory,
      );
    }
  }

  registerIntegrationChecker(
    name: string,
    checker: () => MiraIntegrationHealth,
  ): void {
    this.integrationCheckers.set(name, checker);
  }

  private emotionalStability(): number {
    if (this.emotionHistory.length < 2) {
      return 1;
    }
    let transitions = 0;
    for (let index = 1; index < this.emotionHistory.length; index += 1) {
      if (this.emotionHistory[index] !== this.emotionHistory[index - 1]) {
        transitions += 1;
      }
    }
    return clamp(1 - transitions / this.emotionHistory.length, 0, 1);
  }

  private checkIntegrations(): Record<string, MiraIntegrationHealth> {
    const output: Record<string, MiraIntegrationHealth> = {};
    output.stm = this.stm
      ? {
          name: "stm",
          status: MiraIntegrationStatus.OK,
          lastCheck: nowIso(),
          metadata: this.stm.getMetrics(),
        }
      : {
          name: "stm",
          status: MiraIntegrationStatus.UNKNOWN,
          lastCheck: nowIso(),
          errorMessage: "STM unavailable",
          metadata: {},
        };
    output.ltm = this.ltm
      ? {
          name: "ltm",
          status: MiraIntegrationStatus.OK,
          lastCheck: nowIso(),
          metadata: this.ltm.getStats(),
        }
      : {
          name: "ltm",
          status: MiraIntegrationStatus.UNKNOWN,
          lastCheck: nowIso(),
          errorMessage: "LTM unavailable",
          metadata: {},
        };
    for (const [name, checker] of this.integrationCheckers.entries()) {
      try {
        output[name] = checker();
      } catch (error: unknown) {
        output[name] = {
          name,
          status: MiraIntegrationStatus.FAIL,
          lastCheck: nowIso(),
          errorMessage: error instanceof Error ? error.message : "unknown",
          metadata: {},
        };
      }
    }
    return output;
  }

  getSelfDescription(): string {
    const stmCount = parseNumber(
      parseRecord(this.stm?.getMetrics()).entryCount,
      0,
    );
    const ltmCount = parseNumber(
      parseRecord(this.ltm?.getStats()).totalEntries,
      0,
    );
    let line = `I am ${this.agentName} with ${stmCount} short-term memories and ${ltmCount} long-term memories.`;
    line += ` Current emotional state is ${this.emotion}.`;
    if (this.analytics) {
      const snapshot = this.analytics.computeAnalytics();
      line += ` Recent average STM importance is ${snapshot.avgStmImportance.toFixed(
        2,
      )}.`;
    }
    return line;
  }

  introspect(): MiraIntrospectionReport {
    const ltmStats = parseRecord(this.ltm?.getStats());
    const domains = parseRecord(ltmStats.domains);
    const domainCounts: Record<string, number> = {};
    for (const [domain, value] of Object.entries(domains)) {
      domainCounts[domain] = parseNumber(parseRecord(value).entryCount, 0);
    }
    return {
      timestamp: nowIso(),
      agentId: this.agentId,
      agentName: this.agentName,
      stmEntryCount: parseNumber(
        parseRecord(this.stm?.getMetrics()).entryCount,
        0,
      ),
      ltmTotalVectors: parseNumber(ltmStats.totalEntries, 0),
      ltmDomains: domainCounts,
      currentEmotion: this.emotion,
      emotionHistory: this.emotionHistory.slice(-10),
      emotionalStability: this.emotionalStability(),
      integrations: this.checkIntegrations(),
      selfDescription: this.getSelfDescription(),
      capabilities: [...this.capabilities],
      limitations: [...this.limitations],
    };
  }

  getStats(): Record<string, unknown> {
    return {
      agentId: this.agentId,
      currentEmotion: this.emotion,
      emotionalStability: this.emotionalStability(),
      capabilitiesCount: this.capabilities.length,
      limitationsCount: this.limitations.length,
      integrations: [...this.integrationCheckers.keys()],
    };
  }
}

export class MiraMemoryFingerprinter {
  static computeFingerprint(content: string, includeCase = false): string {
    const normalized = includeCase
      ? content.trim().replace(/\s+/g, " ")
      : content.toLowerCase().trim().replace(/\s+/g, " ");
    return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  }

  static computeSemanticFingerprint(
    embedding: number[],
    precision = 4,
  ): string {
    const values = embedding
      .slice(0, 32)
      .map((value) => value.toFixed(precision));
    return createHash("md5")
      .update(values.join(","))
      .digest("hex")
      .slice(0, 12);
  }
}

export class MiraMemoryTextProcessor {
  private static readonly STOP_WORDS = new Set([
    "the",
    "and",
    "for",
    "are",
    "but",
    "not",
    "you",
    "all",
    "can",
    "had",
    "her",
    "was",
    "one",
    "our",
    "out",
    "has",
    "have",
    "been",
    "were",
    "they",
    "will",
    "with",
    "this",
    "that",
    "from",
    "what",
    "there",
    "their",
    "which",
  ]);

  static extractKeywords(text: string, maxKeywords = 10): string[] {
    const words = text
      .toLowerCase()
      .match(/[a-z]{3,}/g)
      ?.filter((word) => !this.STOP_WORDS.has(word));
    if (!words || words.length === 0) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, Math.max(0, maxKeywords))
      .map(([word]) => word);
  }

  static summarizeText(text: string, maxLength = 200): string {
    if (text.length <= maxLength) {
      return text;
    }
    const sliced = text.slice(0, maxLength);
    const boundary = Math.max(
      sliced.lastIndexOf("."),
      sliced.lastIndexOf("!"),
      sliced.lastIndexOf("?"),
      sliced.lastIndexOf("\n"),
    );
    if (boundary > maxLength / 2) {
      return sliced.slice(0, boundary + 1).trim();
    }
    return `${sliced.trim()}...`;
  }

  static detectEmotion(text: string): string {
    const input = text.toLowerCase();
    const map: Record<string, string[]> = {
      happy: ["happy", "glad", "joy", "excited", "great", "love"],
      sad: ["sad", "unhappy", "depressed", "down", "sorry"],
      angry: ["angry", "mad", "furious", "annoyed", "frustrated"],
      fearful: ["afraid", "scared", "worried", "anxious"],
      surprised: ["surprised", "amazed", "shocked"],
      curious: ["curious", "wonder", "interested", "why", "how"],
      grateful: ["thank", "grateful", "appreciate", "thanks"],
    };
    for (const [emotion, words] of Object.entries(map)) {
      if (words.some((word) => input.includes(word))) {
        return emotion;
      }
    }
    return "neutral";
  }
}

export class MiraMemoryExporter {
  static toJsonl(
    entries: Array<MiraSTMEntry | MiraLTMEntry>,
    path: string,
  ): number {
    mkdirSync(dirname(path), { recursive: true });
    const payload = entries
      .map((entry) => JSON.stringify(entry.toDict()))
      .join("\n");
    writeFileSync(path, payload.length > 0 ? `${payload}\n` : "", "utf8");
    return entries.length;
  }

  static toMarkdown(entries: Array<MiraSTMEntry | MiraLTMEntry>): string {
    const lines = ["# Memory Export", ""];
    for (const entry of entries) {
      lines.push(`## ${entry.entryId.slice(0, 8)}`);
      lines.push(`- Timestamp: ${getMemoryTimestamp(entry)}`);
      lines.push(`- Content: ${entry.content.slice(0, 200)}`);
      if (entry instanceof MiraSTMEntry) {
        lines.push(`- Emotion: ${entry.emotion}`);
      }
      if (entry instanceof MiraLTMEntry) {
        lines.push(`- Domain: ${entry.domain}`);
        lines.push(`- Trust: ${entry.trustScore.toFixed(2)}`);
      }
      if (entry.tags.length > 0) {
        lines.push(`- Tags: ${entry.tags.join(", ")}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  static toCsv(
    entries: Array<MiraSTMEntry | MiraLTMEntry>,
    path: string,
  ): number {
    mkdirSync(dirname(path), { recursive: true });
    const header = [
      "entry_id",
      "timestamp",
      "content",
      "emotion",
      "domain",
      "tags",
      "trust_score",
    ];
    const rows = [header.join(",")];
    for (const entry of entries) {
      rows.push(
        [
          entry.entryId,
          getMemoryTimestamp(entry),
          `"${entry.content.replaceAll('"', '""').slice(0, 500)}"`,
          entry instanceof MiraSTMEntry ? entry.emotion : "",
          entry instanceof MiraLTMEntry ? entry.domain : "",
          `"${entry.tags.join(";")}"`,
          entry instanceof MiraLTMEntry ? entry.trustScore.toFixed(3) : "",
        ].join(","),
      );
    }
    writeFileSync(path, `${rows.join("\n")}\n`, "utf8");
    return entries.length;
  }
}

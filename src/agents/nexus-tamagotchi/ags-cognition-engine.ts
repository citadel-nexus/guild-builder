import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type LoggerLike = Pick<Console, "debug" | "info" | "warn" | "error">;

function getLogger(logger?: LoggerLike): LoggerLike {
  return logger ?? console;
}

function toIso(value = Date.now()): string {
  return new Date(value).toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export enum SapientPacketType {
  QUERY = "query",
  COMMAND = "command",
  REFLECTION = "reflection",
  PLANNING = "planning",
  EXECUTION = "execution",
  SYNTHESIS = "synthesis",
  VALIDATION = "validation",
  LEARNING = "learning",
  GOVERNANCE = "governance",
  EMERGENCY = "emergency",
  MAINTENANCE = "maintenance",
  SOCIAL = "social",
}

export enum SapientPacketPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  DEFERRED = 4,
}

export enum SapientPacketStatus {
  CREATED = "created",
  QUEUED = "queued",
  INGRESS = "ingress",
  GOVERNOR = "governor",
  COUNCIL = "council",
  DEBATING = "debating",
  VERDICT = "verdict",
  EXECUTOR = "executor",
  EXECUTING = "executing",
  EGRESS = "egress",
  COMPLETED = "completed",
  FAILED = "failed",
  REJECTED = "rejected",
  DEFERRED = "deferred",
}

export type SapientPacketMetadata = {
  sourceAgent: string;
  sourceGuild: string;
  sourceChannel: string;
  correlationId: string;
  parentPacketId?: string;
  childPacketIds: string[];
  retryCount: number;
  maxRetries: number;
  timeoutSeconds: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  customData: Record<string, unknown>;
};

export type SapientPacketPayload = {
  content: string;
  contentType: string;
  intent: string;
  entities: Record<string, unknown>;
  context: Record<string, unknown>;
  attachments: Array<Record<string, unknown>>;
  embedding?: number[];
  language: string;
  sentiment: number;
  confidence: number;
};

export type SapientPacketRouting = {
  currentStage: string;
  nextStage?: string;
  skipStages: string[];
  forceStages: string[];
  stageHistory: Array<{ stage: string; timestamp: string }>;
  processingPath: string[];
  branchConditions: Record<string, string>;
};

export type SapientPacketResult = {
  stage: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  tokensUsed: number;
  costEstimate: number;
  metadata: Record<string, unknown>;
};

export type AGSVerdict = {
  deliberationId: string;
  decision: "approve" | "reject" | "defer";
  confidence: number;
  voteBreakdown: Record<string, number>;
  weightedBreakdown: Record<string, number>;
  keyArguments: string[];
  conditions: string[];
  reasoning: string;
  timestamp: string;
};

export class SapientPacket {
  packetId: string;
  packetType: SapientPacketType;
  priority: SapientPacketPriority;
  status: SapientPacketStatus;
  metadata: SapientPacketMetadata;
  payload: SapientPacketPayload;
  routing: SapientPacketRouting;
  results: SapientPacketResult[];
  verdict?: AGSVerdict;
  finalOutput?: string;

  constructor(
    input: {
      packetId?: string;
      packetType?: SapientPacketType;
      priority?: SapientPacketPriority;
      status?: SapientPacketStatus;
      metadata?: Partial<SapientPacketMetadata>;
      payload?: Partial<SapientPacketPayload>;
      routing?: Partial<SapientPacketRouting>;
    } = {},
  ) {
    this.packetId = input.packetId ?? randomUUID();
    this.packetType = input.packetType ?? SapientPacketType.QUERY;
    this.priority = input.priority ?? SapientPacketPriority.NORMAL;
    this.status = input.status ?? SapientPacketStatus.CREATED;
    this.metadata = {
      sourceAgent: input.metadata?.sourceAgent ?? "unknown",
      sourceGuild: input.metadata?.sourceGuild ?? "CNWB",
      sourceChannel: input.metadata?.sourceChannel ?? "internal",
      correlationId:
        input.metadata?.correlationId ??
        `${this.packetType}-${this.packetId.slice(0, 8)}`,
      parentPacketId: input.metadata?.parentPacketId,
      childPacketIds: input.metadata?.childPacketIds
        ? [...input.metadata.childPacketIds]
        : [],
      retryCount: input.metadata?.retryCount ?? 0,
      maxRetries: input.metadata?.maxRetries ?? 3,
      timeoutSeconds: input.metadata?.timeoutSeconds ?? 30,
      createdAt: input.metadata?.createdAt ?? toIso(),
      updatedAt: input.metadata?.updatedAt ?? toIso(),
      tags: input.metadata?.tags ? [...input.metadata.tags] : [],
      customData: input.metadata?.customData
        ? { ...input.metadata.customData }
        : {},
    };
    this.payload = {
      content: input.payload?.content ?? "",
      contentType: input.payload?.contentType ?? "text",
      intent: input.payload?.intent ?? "",
      entities: input.payload?.entities ? { ...input.payload.entities } : {},
      context: input.payload?.context ? { ...input.payload.context } : {},
      attachments: input.payload?.attachments
        ? [...input.payload.attachments]
        : [],
      embedding: input.payload?.embedding
        ? [...input.payload.embedding]
        : undefined,
      language: input.payload?.language ?? "en",
      sentiment: clamp(input.payload?.sentiment ?? 0, -1, 1),
      confidence: clamp(input.payload?.confidence ?? 1, 0, 1),
    };
    this.routing = {
      currentStage: input.routing?.currentStage ?? SapientPacketStatus.CREATED,
      nextStage: input.routing?.nextStage,
      skipStages: input.routing?.skipStages
        ? [...input.routing.skipStages]
        : [],
      forceStages: input.routing?.forceStages
        ? [...input.routing.forceStages]
        : [],
      stageHistory: input.routing?.stageHistory
        ? [...input.routing.stageHistory]
        : [],
      processingPath: input.routing?.processingPath
        ? [...input.routing.processingPath]
        : [],
      branchConditions: input.routing?.branchConditions
        ? { ...input.routing.branchConditions }
        : {},
    };
    this.results = [];
  }

  addResult(result: SapientPacketResult): void {
    this.results.push(result);
    this.routing.stageHistory.push({
      stage: result.stage,
      timestamp: toIso(),
    });
    this.routing.processingPath.push(result.stage);
    this.metadata.updatedAt = toIso();
  }

  getLatestResult(): SapientPacketResult | undefined {
    return this.results.at(-1);
  }

  getTotalDurationMs(): number {
    return this.results.reduce((sum, result) => sum + result.durationMs, 0);
  }

  getTotalTokens(): number {
    return this.results.reduce((sum, result) => sum + result.tokensUsed, 0);
  }

  toJSON(): Record<string, unknown> {
    return {
      packetId: this.packetId,
      packetType: this.packetType,
      priority: this.priority,
      status: this.status,
      metadata: this.metadata,
      payload: this.payload,
      routing: this.routing,
      results: this.results,
      verdict: this.verdict,
      finalOutput: this.finalOutput,
    };
  }
}

export class SapientPacketFactory {
  private readonly defaultAgent: string;
  private readonly defaultGuild: string;
  private readonly logger: LoggerLike;
  private packetCounter = 0;

  constructor(
    options: {
      defaultAgent?: string;
      defaultGuild?: string;
      logger?: LoggerLike;
    } = {},
  ) {
    this.defaultAgent = options.defaultAgent ?? "nexus";
    this.defaultGuild = options.defaultGuild ?? "CNWB";
    this.logger = getLogger(options.logger);
  }

  createQueryPacket(input: {
    content: string;
    intent?: string;
    context?: Record<string, unknown>;
    priority?: SapientPacketPriority;
  }): SapientPacket {
    this.packetCounter += 1;
    return new SapientPacket({
      packetType: SapientPacketType.QUERY,
      priority: input.priority ?? SapientPacketPriority.NORMAL,
      metadata: {
        sourceAgent: this.defaultAgent,
        sourceGuild: this.defaultGuild,
        correlationId: `query-${this.packetCounter}`,
      },
      payload: {
        content: input.content,
        intent: input.intent ?? "",
        context: input.context ?? {},
      },
    });
  }

  createCommandPacket(input: {
    command: string;
    parameters?: Record<string, unknown>;
    priority?: SapientPacketPriority;
  }): SapientPacket {
    this.packetCounter += 1;
    return new SapientPacket({
      packetType: SapientPacketType.COMMAND,
      priority: input.priority ?? SapientPacketPriority.HIGH,
      metadata: {
        sourceAgent: this.defaultAgent,
        sourceGuild: this.defaultGuild,
        correlationId: `cmd-${this.packetCounter}`,
      },
      payload: {
        content: input.command,
        intent: "execute_command",
        entities: input.parameters ?? {},
      },
    });
  }

  createReflectionPacket(input: {
    topic: string;
    context?: Record<string, unknown>;
  }): SapientPacket {
    this.packetCounter += 1;
    return new SapientPacket({
      packetType: SapientPacketType.REFLECTION,
      priority: SapientPacketPriority.LOW,
      metadata: {
        sourceAgent: this.defaultAgent,
        sourceGuild: this.defaultGuild,
        correlationId: `reflect-${this.packetCounter}`,
      },
      payload: {
        content: input.topic,
        intent: "self_reflection",
        context: input.context ?? {},
      },
    });
  }

  createPlanningPacket(input: {
    goal: string;
    constraints?: string[];
    resources?: Record<string, unknown>;
  }): SapientPacket {
    this.packetCounter += 1;
    return new SapientPacket({
      packetType: SapientPacketType.PLANNING,
      priority: SapientPacketPriority.NORMAL,
      metadata: {
        sourceAgent: this.defaultAgent,
        sourceGuild: this.defaultGuild,
        correlationId: `plan-${this.packetCounter}`,
      },
      payload: {
        content: input.goal,
        intent: "goal_planning",
        context: {
          constraints: input.constraints ?? [],
          resources: input.resources ?? {},
        },
      },
    });
  }

  createEmergencyPacket(input: {
    issue: string;
    severity?: string;
    affectedSystems?: string[];
  }): SapientPacket {
    this.packetCounter += 1;
    return new SapientPacket({
      packetType: SapientPacketType.EMERGENCY,
      priority: SapientPacketPriority.CRITICAL,
      metadata: {
        sourceAgent: this.defaultAgent,
        sourceGuild: this.defaultGuild,
        correlationId: `emergency-${this.packetCounter}`,
        timeoutSeconds: 10,
      },
      payload: {
        content: input.issue,
        intent: "emergency_response",
        context: {
          severity: input.severity ?? "high",
          affectedSystems: input.affectedSystems ?? [],
        },
      },
    });
  }

  createChildPacket(input: {
    parent: SapientPacket;
    packetType: SapientPacketType;
    content: string;
  }): SapientPacket {
    this.packetCounter += 1;
    const child = new SapientPacket({
      packetType: input.packetType,
      priority: input.parent.priority,
      metadata: {
        sourceAgent: this.defaultAgent,
        sourceGuild: this.defaultGuild,
        correlationId: input.parent.metadata.correlationId,
        parentPacketId: input.parent.packetId,
      },
      payload: {
        content: input.content,
        context: { ...input.parent.payload.context },
      },
    });
    input.parent.metadata.childPacketIds.push(child.packetId);
    this.logger.debug(`Created child packet ${child.packetId.slice(0, 8)}`);
    return child;
  }
}

type PacketQueueEntry = {
  priority: number;
  createdAt: string;
  packet: SapientPacket;
};

export class SapientPacketQueue {
  private readonly maxSize: number;
  private readonly logger: LoggerLike;
  private readonly queue: PacketQueueEntry[] = [];
  private readonly packetIndex = new Map<string, SapientPacket>();
  private readonly stats = {
    enqueued: 0,
    dequeued: 0,
    rejected: 0,
    expired: 0,
  };

  constructor(options: { maxSize?: number; logger?: LoggerLike } = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.logger = getLogger(options.logger);
  }

  enqueue(packet: SapientPacket): boolean {
    if (this.packetIndex.size >= this.maxSize) {
      this.stats.rejected += 1;
      this.logger.warn(
        `Queue full, rejecting packet ${packet.packetId.slice(0, 8)}`,
      );
      return false;
    }
    packet.status = SapientPacketStatus.QUEUED;
    const entry: PacketQueueEntry = {
      priority: packet.priority,
      createdAt: packet.metadata.createdAt,
      packet,
    };
    this.queue.push(entry);
    this.queue.sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }
      return (
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      );
    });
    this.packetIndex.set(packet.packetId, packet);
    this.stats.enqueued += 1;
    return true;
  }

  dequeue(): SapientPacket | undefined {
    while (this.queue.length > 0) {
      const entry = this.queue.shift();
      if (!entry) {
        break;
      }
      if (!this.packetIndex.has(entry.packet.packetId)) {
        continue;
      }
      this.packetIndex.delete(entry.packet.packetId);
      this.stats.dequeued += 1;
      return entry.packet;
    }
    return undefined;
  }

  peek(): SapientPacket | undefined {
    return this.queue[0]?.packet;
  }

  cancel(packetId: string): boolean {
    if (!this.packetIndex.has(packetId)) {
      return false;
    }
    this.packetIndex.delete(packetId);
    return true;
  }

  getPacket(packetId: string): SapientPacket | undefined {
    return this.packetIndex.get(packetId);
  }

  size(): number {
    return this.packetIndex.size;
  }

  clearExpired(): number {
    const now = Date.now();
    const expiredIds: string[] = [];
    for (const packet of this.packetIndex.values()) {
      const age = (now - new Date(packet.metadata.createdAt).getTime()) / 1000;
      if (age > packet.metadata.timeoutSeconds) {
        expiredIds.push(packet.packetId);
      }
    }
    for (const id of expiredIds) {
      this.packetIndex.delete(id);
    }
    this.stats.expired += expiredIds.length;
    return expiredIds.length;
  }

  getStats(): Record<string, unknown> {
    return {
      ...this.stats,
      currentSize: this.packetIndex.size,
      maxSize: this.maxSize,
    };
  }
}

export enum AGSStageType {
  INGRESS = "ingress",
  GOVERNOR = "governor",
  COUNCIL = "council",
  EXECUTOR = "executor",
  EGRESS = "egress",
}

export type AGSStageConfig = {
  stageType: AGSStageType;
  enabled: boolean;
  timeoutSeconds: number;
  maxRetries: number;
  parallelProcessing: boolean;
  cacheResults: boolean;
  cacheTtlSeconds: number;
  metricsEnabled: boolean;
  customConfig: Record<string, unknown>;
};

export function createStageConfig(
  stageType: AGSStageType,
  overrides: Partial<AGSStageConfig> = {},
): AGSStageConfig {
  return {
    stageType,
    enabled: overrides.enabled ?? true,
    timeoutSeconds: overrides.timeoutSeconds ?? 30,
    maxRetries: overrides.maxRetries ?? 2,
    parallelProcessing: overrides.parallelProcessing ?? false,
    cacheResults: overrides.cacheResults ?? true,
    cacheTtlSeconds: overrides.cacheTtlSeconds ?? 300,
    metricsEnabled: overrides.metricsEnabled ?? true,
    customConfig: overrides.customConfig ? { ...overrides.customConfig } : {},
  };
}

export type AGSStageMetrics = {
  stageType: AGSStageType;
  totalProcessed: number;
  successful: number;
  failed: number;
  retried: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  lastProcessed?: string;
  errorTypes: Record<string, number>;
};

export abstract class AGSStage {
  readonly config: AGSStageConfig;
  readonly metrics: AGSStageMetrics;
  protected readonly logger: LoggerLike;
  private readonly cache = new Map<
    string,
    { createdAt: number; result: unknown }
  >();

  constructor(config: AGSStageConfig, logger?: LoggerLike) {
    this.config = config;
    this.logger = getLogger(logger);
    this.metrics = {
      stageType: config.stageType,
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      retried: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      minDurationMs: Number.POSITIVE_INFINITY,
      maxDurationMs: 0,
      errorTypes: {},
    };
  }

  abstract process(packet: SapientPacket): Promise<SapientPacketResult>;

  protected getCacheKey(packet: SapientPacket): string {
    return `${packet.packetType}:${packet.payload.content}`;
  }

  private checkCache(packet: SapientPacket): unknown | undefined {
    if (!this.config.cacheResults) {
      return undefined;
    }
    const key = this.getCacheKey(packet);
    const cached = this.cache.get(key);
    if (!cached) {
      return undefined;
    }
    const ageSeconds = (Date.now() - cached.createdAt) / 1000;
    if (ageSeconds > this.config.cacheTtlSeconds) {
      this.cache.delete(key);
      return undefined;
    }
    return cached.result;
  }

  private storeCache(packet: SapientPacket, result: unknown): void {
    if (!this.config.cacheResults) {
      return;
    }
    this.cache.set(this.getCacheKey(packet), {
      createdAt: Date.now(),
      result,
    });
  }

  private updateMetrics(result: SapientPacketResult): void {
    if (!this.config.metricsEnabled) {
      return;
    }
    this.metrics.totalProcessed += 1;
    this.metrics.totalDurationMs += result.durationMs;
    this.metrics.avgDurationMs =
      this.metrics.totalDurationMs / Math.max(1, this.metrics.totalProcessed);
    this.metrics.minDurationMs = Math.min(
      this.metrics.minDurationMs,
      result.durationMs,
    );
    this.metrics.maxDurationMs = Math.max(
      this.metrics.maxDurationMs,
      result.durationMs,
    );
    this.metrics.lastProcessed = toIso();
    if (result.success) {
      this.metrics.successful += 1;
    } else {
      this.metrics.failed += 1;
      const key = result.error ? "error" : "unknown";
      this.metrics.errorTypes[key] = (this.metrics.errorTypes[key] ?? 0) + 1;
    }
  }

  async execute(packet: SapientPacket): Promise<SapientPacketResult> {
    const started = Date.now();
    const cached = this.checkCache(packet);
    if (cached !== undefined) {
      const result: SapientPacketResult = {
        stage: this.config.stageType,
        success: true,
        output: cached,
        durationMs: 0,
        tokensUsed: 0,
        costEstimate: 0,
        metadata: { cached: true },
      };
      this.updateMetrics(result);
      return result;
    }
    let lastError = "unknown";
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        const result = await Promise.race([
          this.process(packet),
          sleep(this.config.timeoutSeconds * 1000).then(() => {
            throw new Error(
              `stage timeout after ${this.config.timeoutSeconds}s`,
            );
          }),
        ]);
        result.durationMs = Date.now() - started;
        if (result.success) {
          this.storeCache(packet, result.output);
        }
        this.updateMetrics(result);
        return result;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : "unknown";
        this.metrics.retried += 1;
      }
    }
    const failed: SapientPacketResult = {
      stage: this.config.stageType,
      success: false,
      error: lastError,
      durationMs: Date.now() - started,
      tokensUsed: 0,
      costEstimate: 0,
      metadata: {},
    };
    this.updateMetrics(failed);
    return failed;
  }

  getMetrics(): Record<string, unknown> {
    return {
      ...this.metrics,
      minDurationMs:
        this.metrics.minDurationMs === Number.POSITIVE_INFINITY
          ? 0
          : this.metrics.minDurationMs,
      successRate:
        this.metrics.successful / Math.max(1, this.metrics.totalProcessed),
    };
  }
}

export class AGSPipeline {
  static readonly STAGE_ORDER: AGSStageType[] = [
    AGSStageType.INGRESS,
    AGSStageType.GOVERNOR,
    AGSStageType.COUNCIL,
    AGSStageType.EXECUTOR,
    AGSStageType.EGRESS,
  ];

  private readonly stages = new Map<AGSStageType, AGSStage>();
  readonly packetQueue: SapientPacketQueue;
  private readonly logger: LoggerLike;
  private running = false;
  private readonly metrics = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    avgTotalDurationMs: 0,
  };

  constructor(
    options: {
      stages?: AGSStage[];
      packetQueue?: SapientPacketQueue;
      logger?: LoggerLike;
    } = {},
  ) {
    this.packetQueue = options.packetQueue ?? new SapientPacketQueue();
    this.logger = getLogger(options.logger);
    for (const stage of options.stages ?? []) {
      this.registerStage(stage);
    }
  }

  registerStage(stage: AGSStage): void {
    this.stages.set(stage.config.stageType, stage);
  }

  getStage(type: AGSStageType): AGSStage | undefined {
    return this.stages.get(type);
  }

  async processPacket(packet: SapientPacket): Promise<SapientPacket> {
    for (const stageType of AGSPipeline.STAGE_ORDER) {
      if (packet.routing.skipStages.includes(stageType)) {
        continue;
      }
      const stage = this.stages.get(stageType);
      if (!stage || !stage.config.enabled) {
        continue;
      }
      packet.status = stageType as unknown as SapientPacketStatus;
      packet.routing.currentStage = stageType;
      const result = await stage.execute(packet);
      packet.addResult(result);
      if (!result.success) {
        packet.status = SapientPacketStatus.FAILED;
        break;
      }
      if (stageType === AGSStageType.GOVERNOR && result.metadata.rejected) {
        packet.status = SapientPacketStatus.REJECTED;
        break;
      }
    }
    if (
      packet.status !== SapientPacketStatus.FAILED &&
      packet.status !== SapientPacketStatus.REJECTED
    ) {
      packet.status = SapientPacketStatus.COMPLETED;
    }
    this.updateMetrics(packet);
    return packet;
  }

  private updateMetrics(packet: SapientPacket): void {
    this.metrics.totalProcessed += 1;
    if (packet.status === SapientPacketStatus.COMPLETED) {
      this.metrics.successful += 1;
    } else {
      this.metrics.failed += 1;
    }
    const duration = packet.getTotalDurationMs();
    this.metrics.avgTotalDurationMs =
      (this.metrics.avgTotalDurationMs * (this.metrics.totalProcessed - 1) +
        duration) /
      this.metrics.totalProcessed;
  }

  async run(maxPackets = 0): Promise<void> {
    this.running = true;
    let processed = 0;
    while (this.running) {
      if (maxPackets > 0 && processed >= maxPackets) {
        break;
      }
      const packet = this.packetQueue.dequeue();
      if (!packet) {
        await sleep(100);
        continue;
      }
      await this.processPacket(packet);
      processed += 1;
    }
  }

  stop(): void {
    this.running = false;
  }

  getMetrics(): Record<string, unknown> {
    const stages: Record<string, unknown> = {};
    for (const [key, stage] of this.stages.entries()) {
      stages[key] = stage.getMetrics();
    }
    return {
      pipeline: { ...this.metrics },
      stages,
      queue: this.packetQueue.getStats(),
    };
  }
}

export type IngressAnalysis = {
  isValid: boolean;
  validationErrors: string[];
  detectedIntent: string;
  intentConfidence: number;
  detectedEntities: Record<string, string[]>;
  detectedLanguage: string;
  sentimentScore: number;
  toxicityScore: number;
  complexityScore: number;
  embedding?: number[];
  suggestedType?: SapientPacketType;
  suggestedPriority?: SapientPacketPriority;
  enrichments: Record<string, unknown>;
};

export class AGSIntentClassifier {
  static readonly PATTERNS: Record<string, string[]> = {
    query: [
      "what",
      "who",
      "where",
      "when",
      "why",
      "how",
      "explain",
      "describe",
    ],
    command: [
      "do",
      "execute",
      "run",
      "create",
      "delete",
      "update",
      "set",
      "change",
    ],
    planning: ["plan", "schedule", "organize", "prepare", "strategy"],
    reflection: ["reflect", "think", "analyze", "consider", "evaluate"],
    emergency: ["urgent", "emergency", "critical", "asap", "immediately"],
    social: ["hello", "hi", "thanks", "bye", "please"],
  };

  private readonly custom = new Map<string, string[]>();

  addPattern(intent: string, keywords: string[]): void {
    this.custom.set(intent, [...keywords]);
  }

  classify(text: string): { intent: string; confidence: number } {
    const input = text.toLowerCase();
    const words = new Set(input.split(/\s+/g).filter(Boolean));
    let bestIntent = "query";
    let bestScore = 0;
    const merged: Record<string, string[]> = {
      ...AGSIntentClassifier.PATTERNS,
      ...Object.fromEntries(this.custom.entries()),
    };
    for (const [intent, keywords] of Object.entries(merged)) {
      let score = 0;
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          score += 1;
        }
        if (words.has(keyword)) {
          score += 0.5;
        }
      }
      const normalized = score / Math.max(1, keywords.length);
      if (normalized > bestScore) {
        bestScore = normalized;
        bestIntent = intent;
      }
    }
    return {
      intent: bestIntent,
      confidence: clamp(bestScore || 0.5, 0.1, 1),
    };
  }
}

export class AGSEntityExtractor {
  private readonly patterns = new Map<string, RegExp>([
    ["email", /[\w.-]+@[\w.-]+\.\w+/gi],
    ["url", /https?:\/\/[^\s]+/gi],
    ["date", /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/gi],
    ["time", /\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?/gi],
    ["number", /\b\d+(?:\.\d+)?\b/g],
    ["mention", /@\w+/g],
    ["hashtag", /#\w+/g],
    ["filePath", /[A-Za-z]:\\[^\s]+|\/[^\s]+\.\w+/g],
    ["ipAddress", /\b\d{1,3}(?:\.\d{1,3}){3}\b/g],
    ["uuid", /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi],
  ]);

  addPattern(name: string, pattern: RegExp): void {
    this.patterns.set(name, pattern);
  }

  extract(text: string): Record<string, string[]> {
    const output: Record<string, string[]> = {};
    for (const [name, regex] of this.patterns.entries()) {
      const found = text.match(regex);
      if (found && found.length > 0) {
        output[name] = [...new Set(found)];
      }
    }
    return output;
  }
}

export class AGSInputValidator {
  private readonly maxLength: number;
  private readonly minLength: number;
  private readonly blockedPatterns: RegExp[];

  constructor(
    options: {
      maxLength?: number;
      minLength?: number;
      blockedPatterns?: RegExp[];
    } = {},
  ) {
    this.maxLength = options.maxLength ?? 10_000;
    this.minLength = options.minLength ?? 1;
    this.blockedPatterns = options.blockedPatterns ?? [];
  }

  validate(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (content.length < this.minLength) {
      errors.push(`content too short (min ${this.minLength})`);
    }
    if (content.length > this.maxLength) {
      errors.push(`content too long (max ${this.maxLength})`);
    }
    if (content.trim().length === 0) {
      errors.push("content is empty");
    }
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(content)) {
        errors.push(`content matches blocked pattern ${pattern}`);
      }
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export class AGSSentimentAnalyzer {
  private readonly positive = new Set([
    "good",
    "great",
    "excellent",
    "amazing",
    "wonderful",
    "love",
    "happy",
    "thanks",
  ]);
  private readonly negative = new Set([
    "bad",
    "terrible",
    "awful",
    "hate",
    "angry",
    "frustrated",
    "error",
    "problem",
  ]);

  analyze(text: string): number {
    const words = new Set(text.toLowerCase().split(/\s+/g).filter(Boolean));
    const positives = [...words].filter((word) =>
      this.positive.has(word),
    ).length;
    const negatives = [...words].filter((word) =>
      this.negative.has(word),
    ).length;
    const total = positives + negatives;
    if (total === 0) {
      return 0;
    }
    return clamp((positives - negatives) / total, -1, 1);
  }
}

export class AGSIngressStage extends AGSStage {
  private readonly classifier: AGSIntentClassifier;
  private readonly extractor: AGSEntityExtractor;
  private readonly validator: AGSInputValidator;
  private readonly sentiment: AGSSentimentAnalyzer;
  private readonly embedding?: (text: string) => number[];

  constructor(
    options: {
      config?: AGSStageConfig;
      classifier?: AGSIntentClassifier;
      extractor?: AGSEntityExtractor;
      validator?: AGSInputValidator;
      sentiment?: AGSSentimentAnalyzer;
      embedding?: (text: string) => number[];
      logger?: LoggerLike;
    } = {},
  ) {
    super(
      options.config ?? createStageConfig(AGSStageType.INGRESS),
      options.logger,
    );
    this.classifier = options.classifier ?? new AGSIntentClassifier();
    this.extractor = options.extractor ?? new AGSEntityExtractor();
    this.validator = options.validator ?? new AGSInputValidator();
    this.sentiment = options.sentiment ?? new AGSSentimentAnalyzer();
    this.embedding = options.embedding;
  }

  async process(packet: SapientPacket): Promise<SapientPacketResult> {
    const content = packet.payload.content;
    const validation = this.validator.validate(content);
    const analysis: IngressAnalysis = {
      isValid: validation.isValid,
      validationErrors: [...validation.errors],
      detectedIntent: "",
      intentConfidence: 0,
      detectedEntities: {},
      detectedLanguage: "en",
      sentimentScore: 0,
      toxicityScore: 0,
      complexityScore: 0,
      enrichments: {},
    };
    if (!validation.isValid) {
      return {
        stage: AGSStageType.INGRESS,
        success: false,
        error: validation.errors.join("; "),
        output: analysis,
        durationMs: 0,
        tokensUsed: 0,
        costEstimate: 0,
        metadata: {},
      };
    }

    const intent = this.classifier.classify(content);
    analysis.detectedIntent = intent.intent;
    analysis.intentConfidence = intent.confidence;
    analysis.detectedEntities = this.extractor.extract(content);
    analysis.sentimentScore = this.sentiment.analyze(content);
    analysis.complexityScore = this.computeComplexity(content);
    if (this.embedding) {
      analysis.embedding = this.embedding(content);
    }

    const intentMap: Record<string, SapientPacketType> = {
      query: SapientPacketType.QUERY,
      command: SapientPacketType.COMMAND,
      planning: SapientPacketType.PLANNING,
      reflection: SapientPacketType.REFLECTION,
      emergency: SapientPacketType.EMERGENCY,
      social: SapientPacketType.SOCIAL,
    };
    analysis.suggestedType =
      intentMap[intent.intent] ?? SapientPacketType.QUERY;
    analysis.suggestedPriority =
      intent.intent === "emergency"
        ? SapientPacketPriority.CRITICAL
        : analysis.complexityScore > 0.7
          ? SapientPacketPriority.HIGH
          : SapientPacketPriority.NORMAL;
    analysis.enrichments = {
      wordCount: content.split(/\s+/g).filter(Boolean).length,
      charCount: content.length,
      hasUrls: Boolean(analysis.detectedEntities.url),
      hasMentions: Boolean(analysis.detectedEntities.mention),
      processedAt: toIso(),
    };

    packet.payload.intent = analysis.detectedIntent;
    packet.payload.entities = analysis.detectedEntities;
    packet.payload.sentiment = analysis.sentimentScore;
    packet.payload.confidence = analysis.intentConfidence;
    if (analysis.embedding) {
      packet.payload.embedding = [...analysis.embedding];
    }

    return {
      stage: AGSStageType.INGRESS,
      success: true,
      output: analysis,
      durationMs: 0,
      tokensUsed: 0,
      costEstimate: 0,
      metadata: {
        intent: analysis.detectedIntent,
        confidence: analysis.intentConfidence,
        entityCount: Object.values(analysis.detectedEntities).reduce(
          (sum, items) => sum + items.length,
          0,
        ),
        sentiment: analysis.sentimentScore,
      },
    };
  }

  private computeComplexity(content: string): number {
    const words = content.split(/\s+/g).filter(Boolean);
    if (words.length === 0) {
      return 0;
    }
    const lengthScore = clamp(words.length / 100, 0, 1);
    const uniqueScore = clamp(new Set(words).size / words.length, 0, 1);
    const avgLength =
      words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const lexicalScore = clamp(avgLength / 10, 0, 1);
    const punctuation = (content.match(/[.,;:!?()[\]{}]/g) ?? []).length;
    const punctuationScore = clamp(
      punctuation / Math.max(1, words.length),
      0,
      1,
    );
    return (lengthScore + uniqueScore + lexicalScore + punctuationScore) / 4;
  }
}

export enum GovernorPolicyType {
  ALLOW = "allow",
  DENY = "deny",
  RATE_LIMIT = "rate_limit",
  REQUIRE_COUNCIL = "require_council",
  DEFER = "defer",
  TRANSFORM = "transform",
  AUDIT = "audit",
}

export type GovernorPolicy = {
  policyId: string;
  policyType: GovernorPolicyType;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  createdAt: string;
  expiresAt?: string;
};

export type GovernorDecision = {
  decision: "allow" | "deny" | "defer" | "require_council";
  reason: string;
  appliedPolicies: string[];
  routeTo?: string;
  skipStages: string[];
  forceStages: string[];
  transformations: Array<Record<string, unknown>>;
  auditRequired: boolean;
  councilRequired: boolean;
  estimatedCost: number;
  resourceAllocation: Record<string, unknown>;
};

export class AGSPolicyEngine {
  private readonly policies = new Map<string, GovernorPolicy>();

  addPolicy(policy: GovernorPolicy): void {
    this.policies.set(policy.policyId, policy);
  }

  removePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  evaluate(
    packet: SapientPacket,
  ): Array<{ policy: GovernorPolicy; matched: boolean }> {
    const ordered = [...this.policies.values()].sort(
      (left, right) => left.priority - right.priority,
    );
    return ordered
      .filter((policy) => policy.enabled)
      .filter(
        (policy) =>
          !policy.expiresAt ||
          new Date(policy.expiresAt).getTime() > Date.now(),
      )
      .map((policy) => ({
        policy,
        matched: this.matches(policy, packet),
      }));
  }

  private matches(policy: GovernorPolicy, packet: SapientPacket): boolean {
    const condition = policy.conditions;
    const packetTypes = Array.isArray(condition.packetTypes)
      ? (condition.packetTypes as string[])
      : undefined;
    if (packetTypes && !packetTypes.includes(packet.packetType)) {
      return false;
    }
    const intents = Array.isArray(condition.intents)
      ? (condition.intents as string[])
      : undefined;
    if (intents && !intents.includes(packet.payload.intent)) {
      return false;
    }
    const sourceAgents = Array.isArray(condition.sourceAgents)
      ? (condition.sourceAgents as string[])
      : undefined;
    if (sourceAgents && !sourceAgents.includes(packet.metadata.sourceAgent)) {
      return false;
    }
    const sourceGuilds = Array.isArray(condition.sourceGuilds)
      ? (condition.sourceGuilds as string[])
      : undefined;
    if (sourceGuilds && !sourceGuilds.includes(packet.metadata.sourceGuild)) {
      return false;
    }
    const patterns = Array.isArray(condition.contentPatterns)
      ? (condition.contentPatterns as string[])
      : undefined;
    if (
      patterns &&
      !patterns.some((pattern) =>
        new RegExp(pattern, "i").test(packet.payload.content),
      )
    ) {
      return false;
    }
    const sentimentRange = Array.isArray(condition.sentimentRange)
      ? (condition.sentimentRange as number[])
      : undefined;
    if (
      sentimentRange &&
      (packet.payload.sentiment < sentimentRange[0] ||
        packet.payload.sentiment > sentimentRange[1])
    ) {
      return false;
    }
    return true;
  }
}

export class AGSRateLimiter {
  private readonly requestsPerMinute: number;
  private readonly requestsPerHour: number;
  private readonly burstLimit: number;
  private readonly minuteWindow: number[] = [];
  private readonly hourWindow: number[] = [];
  private readonly burstWindow: number[] = [];

  constructor(
    options: {
      requestsPerMinute?: number;
      requestsPerHour?: number;
      burstLimit?: number;
    } = {},
  ) {
    this.requestsPerMinute = options.requestsPerMinute ?? 60;
    this.requestsPerHour = options.requestsPerHour ?? 1000;
    this.burstLimit = options.burstLimit ?? 10;
  }

  check(): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const minuteAgo = now - 60_000;
    const hourAgo = now - 3_600_000;
    const secondAgo = now - 1_000;
    while (this.minuteWindow.length && this.minuteWindow[0] < minuteAgo) {
      this.minuteWindow.shift();
    }
    while (this.hourWindow.length && this.hourWindow[0] < hourAgo) {
      this.hourWindow.shift();
    }
    while (this.burstWindow.length && this.burstWindow[0] < secondAgo) {
      this.burstWindow.shift();
    }
    if (this.burstWindow.length >= this.burstLimit) {
      return {
        allowed: false,
        reason: `burst limit ${this.burstLimit}/sec exceeded`,
      };
    }
    if (this.minuteWindow.length >= this.requestsPerMinute) {
      return {
        allowed: false,
        reason: `minute limit ${this.requestsPerMinute}/min exceeded`,
      };
    }
    if (this.hourWindow.length >= this.requestsPerHour) {
      return {
        allowed: false,
        reason: `hour limit ${this.requestsPerHour}/hr exceeded`,
      };
    }
    this.minuteWindow.push(now);
    this.hourWindow.push(now);
    this.burstWindow.push(now);
    return { allowed: true };
  }

  getStats(): Record<string, unknown> {
    return {
      minuteCount: this.minuteWindow.length,
      minuteLimit: this.requestsPerMinute,
      hourCount: this.hourWindow.length,
      hourLimit: this.requestsPerHour,
      burstCount: this.burstWindow.length,
      burstLimit: this.burstLimit,
    };
  }
}

export class AGSResourceAllocator {
  private readonly maxTokensPerRequest: number;
  private readonly maxConcurrentRequests: number;
  private readonly tokenBudgetPerHour: number;
  private concurrent = 0;
  private tokensThisHour = 0;
  private hourStartedAt = Date.now();

  constructor(
    options: {
      maxTokensPerRequest?: number;
      maxConcurrentRequests?: number;
      tokenBudgetPerHour?: number;
    } = {},
  ) {
    this.maxTokensPerRequest = options.maxTokensPerRequest ?? 4000;
    this.maxConcurrentRequests = options.maxConcurrentRequests ?? 10;
    this.tokenBudgetPerHour = options.tokenBudgetPerHour ?? 100_000;
  }

  allocate(packet: SapientPacket): Record<string, unknown> {
    if (Date.now() - this.hourStartedAt > 3_600_000) {
      this.tokensThisHour = 0;
      this.hourStartedAt = Date.now();
    }
    let estimatedTokens = Math.min(
      this.maxTokensPerRequest,
      Math.ceil(packet.payload.content.length / 4 + 500),
    );
    const multiplier: Partial<Record<SapientPacketType, number>> = {
      [SapientPacketType.QUERY]: 1,
      [SapientPacketType.COMMAND]: 0.8,
      [SapientPacketType.REFLECTION]: 1.5,
      [SapientPacketType.PLANNING]: 2,
      [SapientPacketType.EMERGENCY]: 0.5,
    };
    estimatedTokens = Math.ceil(
      estimatedTokens * (multiplier[packet.packetType] ?? 1),
    );

    const allowed =
      this.concurrent < this.maxConcurrentRequests &&
      this.tokensThisHour + estimatedTokens <= this.tokenBudgetPerHour;
    if (allowed) {
      this.concurrent += 1;
      this.tokensThisHour += estimatedTokens;
    }
    return {
      allocated: allowed,
      tokens: allowed ? estimatedTokens : 0,
      priorityBoost: packet.priority === SapientPacketPriority.CRITICAL,
      timeoutSeconds: this.computeTimeout(packet, estimatedTokens),
      reason: allowed ? "" : "resource limits exceeded",
    };
  }

  release(): void {
    this.concurrent = Math.max(0, this.concurrent - 1);
  }

  private computeTimeout(packet: SapientPacket, tokens: number): number {
    let base = 30;
    if (packet.priority === SapientPacketPriority.CRITICAL) {
      base = 10;
    } else if (packet.priority === SapientPacketPriority.HIGH) {
      base = 20;
    }
    return Math.min(120, base * (1 + tokens / this.maxTokensPerRequest));
  }

  getStats(): Record<string, unknown> {
    return {
      concurrentRequests: this.concurrent,
      maxConcurrent: this.maxConcurrentRequests,
      tokensThisHour: this.tokensThisHour,
      tokenBudget: this.tokenBudgetPerHour,
      utilization: this.tokensThisHour / this.tokenBudgetPerHour,
    };
  }
}

export class AGSGovernorStage extends AGSStage {
  readonly policyEngine: AGSPolicyEngine;
  readonly rateLimiter: AGSRateLimiter;
  readonly allocator: AGSResourceAllocator;
  private readonly auditLog: Array<Record<string, unknown>> = [];

  constructor(
    options: {
      config?: AGSStageConfig;
      policyEngine?: AGSPolicyEngine;
      rateLimiter?: AGSRateLimiter;
      allocator?: AGSResourceAllocator;
      logger?: LoggerLike;
    } = {},
  ) {
    super(
      options.config ?? createStageConfig(AGSStageType.GOVERNOR),
      options.logger,
    );
    this.policyEngine = options.policyEngine ?? new AGSPolicyEngine();
    this.rateLimiter = options.rateLimiter ?? new AGSRateLimiter();
    this.allocator = options.allocator ?? new AGSResourceAllocator();
    this.installDefaultPolicies();
  }

  private installDefaultPolicies(): void {
    this.policyEngine.addPolicy({
      policyId: "emergency-priority",
      policyType: GovernorPolicyType.ALLOW,
      name: "Emergency Priority",
      description: "Fast-track emergency packets",
      priority: 1,
      enabled: true,
      conditions: { packetTypes: [SapientPacketType.EMERGENCY] },
      actions: { priorityBoost: true },
      createdAt: toIso(),
    });
    this.policyEngine.addPolicy({
      policyId: "planning-council",
      policyType: GovernorPolicyType.REQUIRE_COUNCIL,
      name: "Planning Council Review",
      description: "Planning packets require council deliberation",
      priority: 50,
      enabled: true,
      conditions: { packetTypes: [SapientPacketType.PLANNING] },
      actions: { councilRequired: true },
      createdAt: toIso(),
    });
    this.policyEngine.addPolicy({
      policyId: "command-audit",
      policyType: GovernorPolicyType.AUDIT,
      name: "Command Audit",
      description: "Audit command packets",
      priority: 100,
      enabled: true,
      conditions: { packetTypes: [SapientPacketType.COMMAND] },
      actions: { auditRequired: true },
      createdAt: toIso(),
    });
  }

  async process(packet: SapientPacket): Promise<SapientPacketResult> {
    const decision: GovernorDecision = {
      decision: "allow",
      reason: "",
      appliedPolicies: [],
      skipStages: [],
      forceStages: [],
      transformations: [],
      auditRequired: false,
      councilRequired: false,
      estimatedCost: 0,
      resourceAllocation: {},
    };

    const rate = this.rateLimiter.check();
    if (!rate.allowed) {
      return {
        stage: AGSStageType.GOVERNOR,
        success: false,
        error: rate.reason,
        output: decision,
        durationMs: 0,
        tokensUsed: 0,
        costEstimate: 0,
        metadata: { rejected: true, reason: "rate_limit" },
      };
    }

    for (const { policy, matched } of this.policyEngine.evaluate(packet)) {
      if (!matched) {
        continue;
      }
      decision.appliedPolicies.push(policy.policyId);
      if (policy.policyType === GovernorPolicyType.DENY) {
        decision.decision = "deny";
        decision.reason = `denied by policy ${policy.name}`;
        return {
          stage: AGSStageType.GOVERNOR,
          success: true,
          output: decision,
          durationMs: 0,
          tokensUsed: 0,
          costEstimate: 0,
          metadata: { rejected: true, reason: "policy_denied" },
        };
      }
      if (policy.policyType === GovernorPolicyType.REQUIRE_COUNCIL) {
        decision.councilRequired = true;
        decision.forceStages.push(AGSStageType.COUNCIL);
      }
      if (policy.policyType === GovernorPolicyType.DEFER) {
        decision.decision = "defer";
        decision.reason = `deferred by policy ${policy.name}`;
      }
      if (policy.policyType === GovernorPolicyType.AUDIT) {
        decision.auditRequired = true;
      }
      if (Array.isArray(policy.actions.skipStages)) {
        decision.skipStages.push(...(policy.actions.skipStages as string[]));
      }
      if (Array.isArray(policy.actions.transformations)) {
        decision.transformations.push(
          ...(policy.actions.transformations as Array<Record<string, unknown>>),
        );
      }
    }

    const allocation = this.allocator.allocate(packet);
    decision.resourceAllocation = allocation;
    if (!allocation.allocated) {
      decision.decision = "defer";
      decision.reason = String(allocation.reason ?? "resource_limit");
      return {
        stage: AGSStageType.GOVERNOR,
        success: true,
        output: decision,
        durationMs: 0,
        tokensUsed: 0,
        costEstimate: 0,
        metadata: { deferred: true, reason: "resource_limit" },
      };
    }

    decision.estimatedCost = this.estimateCost(
      packet,
      Number(allocation.tokens ?? 0),
    );
    for (const transformation of decision.transformations) {
      this.applyTransformation(packet, transformation);
    }
    packet.routing.skipStages = [
      ...packet.routing.skipStages,
      ...decision.skipStages,
    ];
    packet.routing.forceStages = [
      ...packet.routing.forceStages,
      ...decision.forceStages,
    ];

    if (decision.auditRequired) {
      this.audit(packet, decision);
    }

    return {
      stage: AGSStageType.GOVERNOR,
      success: true,
      output: decision,
      durationMs: 0,
      tokensUsed: Number(allocation.tokens ?? 0),
      costEstimate: decision.estimatedCost,
      metadata: {
        policiesApplied: decision.appliedPolicies.length,
        councilRequired: decision.councilRequired,
        auditRequired: decision.auditRequired,
        estimatedCost: decision.estimatedCost,
      },
    };
  }

  private estimateCost(packet: SapientPacket, tokens: number): number {
    const baseCost = 0.001;
    const tokenCost = tokens * 0.00001;
    const multiplier: Partial<Record<SapientPacketType, number>> = {
      [SapientPacketType.QUERY]: 1,
      [SapientPacketType.COMMAND]: 0.5,
      [SapientPacketType.PLANNING]: 2,
      [SapientPacketType.REFLECTION]: 1.5,
    };
    return (baseCost + tokenCost) * (multiplier[packet.packetType] ?? 1);
  }

  private applyTransformation(
    packet: SapientPacket,
    transformation: Record<string, unknown>,
  ): void {
    const type = String(transformation.type ?? "");
    if (type === "sanitize") {
      const patterns = Array.isArray(transformation.patterns)
        ? (transformation.patterns as string[])
        : [];
      let content = packet.payload.content;
      for (const pattern of patterns) {
        content = content.replace(new RegExp(pattern, "gi"), "[REDACTED]");
      }
      packet.payload.content = content;
      return;
    }
    if (type === "truncate") {
      const maxLength = numberOr(transformation.maxLength, 1000);
      if (packet.payload.content.length > maxLength) {
        packet.payload.content = `${packet.payload.content.slice(0, maxLength)}...`;
      }
      return;
    }
    if (type === "add_context") {
      const extra = asRecord(transformation.context);
      packet.payload.context = {
        ...packet.payload.context,
        ...extra,
      };
    }
  }

  private audit(packet: SapientPacket, decision: GovernorDecision): void {
    this.auditLog.push({
      timestamp: toIso(),
      packetId: packet.packetId,
      packetType: packet.packetType,
      sourceAgent: packet.metadata.sourceAgent,
      decision: decision.decision,
      policiesApplied: [...decision.appliedPolicies],
      contentPreview: packet.payload.content.slice(0, 100),
    });
    if (this.auditLog.length > 1000) {
      this.auditLog.splice(0, this.auditLog.length - 500);
    }
  }

  getAuditLog(limit = 100): Array<Record<string, unknown>> {
    return this.auditLog.slice(-Math.max(0, limit));
  }
}

export enum CouncilAgentRole {
  ANALYST = "analyst",
  CRITIC = "critic",
  STRATEGIST = "strategist",
  ETHICIST = "ethicist",
  PRAGMATIST = "pragmatist",
  INNOVATOR = "innovator",
  GUARDIAN = "guardian",
  HISTORIAN = "historian",
  FUTURIST = "futurist",
  MEDIATOR = "mediator",
  SPECIALIST = "specialist",
  ADVOCATE = "advocate",
  SKEPTIC = "skeptic",
  SYNTHESIZER = "synthesizer",
  ARBITER = "arbiter",
}

export type CouncilAgent = {
  agentId: string;
  role: CouncilAgentRole;
  name: string;
  description: string;
  expertiseDomains: string[];
  votingWeight: number;
  active: boolean;
};

export type CouncilArgument = {
  argumentId: string;
  agentId: string;
  agentRole: CouncilAgentRole;
  position: "support" | "oppose" | "neutral" | "abstain";
  argumentText: string;
  confidence: number;
  evidence: string[];
  rebuttalTo?: string;
  timestamp: string;
};

export type CouncilVote = {
  voteId: string;
  agentId: string;
  agentRole: CouncilAgentRole;
  vote: "approve" | "reject" | "defer" | "abstain";
  weight: number;
  rationale: string;
  timestamp: string;
};

export type CouncilDeliberation = {
  deliberationId: string;
  packetId: string;
  topic: string;
  context: Record<string, unknown>;
  arguments: CouncilArgument[];
  votes: CouncilVote[];
  roundsCompleted: number;
  maxRounds: number;
  consensusReached: boolean;
  consensusThreshold: number;
  startedAt: string;
  completedAt?: string;
  verdict?: AGSVerdict;
};

const DEFAULT_COUNCIL_AGENTS: CouncilAgent[] = [
  ["analyst-1", CouncilAgentRole.ANALYST, "Analyzer", 1],
  ["critic-1", CouncilAgentRole.CRITIC, "Challenger", 1],
  ["strategist-1", CouncilAgentRole.STRATEGIST, "Planner", 1.2],
  ["ethicist-1", CouncilAgentRole.ETHICIST, "Ethics Guide", 1.1],
  ["pragmatist-1", CouncilAgentRole.PRAGMATIST, "Realist", 1],
  ["innovator-1", CouncilAgentRole.INNOVATOR, "Creator", 0.9],
  ["guardian-1", CouncilAgentRole.GUARDIAN, "Protector", 1.3],
  ["historian-1", CouncilAgentRole.HISTORIAN, "Chronicler", 0.8],
  ["futurist-1", CouncilAgentRole.FUTURIST, "Visionary", 0.9],
  ["mediator-1", CouncilAgentRole.MEDIATOR, "Harmonizer", 1],
  ["specialist-1", CouncilAgentRole.SPECIALIST, "Expert", 1.2],
  ["advocate-1", CouncilAgentRole.ADVOCATE, "Voice", 1.1],
  ["skeptic-1", CouncilAgentRole.SKEPTIC, "Doubter", 0.9],
  ["synthesizer-1", CouncilAgentRole.SYNTHESIZER, "Integrator", 1],
  ["arbiter-1", CouncilAgentRole.ARBITER, "Judge", 1.5],
].map(([agentId, role, name, votingWeight]) => ({
  agentId,
  role: role as CouncilAgentRole,
  name: String(name),
  description: "",
  expertiseDomains: [],
  votingWeight: Number(votingWeight),
  active: true,
}));

export class AGSCouncilDebateEngine {
  readonly agents: CouncilAgent[];
  readonly maxRounds: number;
  readonly consensusThreshold: number;
  private readonly history: CouncilDeliberation[] = [];

  constructor(
    options: {
      agents?: CouncilAgent[];
      maxRounds?: number;
      consensusThreshold?: number;
    } = {},
  ) {
    this.agents = options.agents
      ? [...options.agents]
      : [...DEFAULT_COUNCIL_AGENTS];
    this.maxRounds = options.maxRounds ?? 3;
    this.consensusThreshold = options.consensusThreshold ?? 0.7;
  }

  async deliberate(
    packet: SapientPacket,
    topic?: string,
  ): Promise<CouncilDeliberation> {
    const deliberation: CouncilDeliberation = {
      deliberationId: randomUUID(),
      packetId: packet.packetId,
      topic: topic ?? packet.payload.content.slice(0, 200),
      context: {
        packetType: packet.packetType,
        intent: packet.payload.intent,
        sentiment: packet.payload.sentiment,
      },
      arguments: [],
      votes: [],
      roundsCompleted: 0,
      maxRounds: this.maxRounds,
      consensusReached: false,
      consensusThreshold: this.consensusThreshold,
      startedAt: toIso(),
    };

    for (let round = 1; round <= this.maxRounds; round += 1) {
      for (const agent of this.agents) {
        if (!agent.active) {
          continue;
        }
        deliberation.arguments.push(
          this.generateArgument(
            agent,
            deliberation.topic,
            deliberation.context,
            round,
          ),
        );
      }
      deliberation.roundsCompleted = round;
      if (this.hasConsensus(deliberation)) {
        deliberation.consensusReached = true;
        break;
      }
    }

    deliberation.votes = this.collectVotes(deliberation);
    deliberation.verdict = this.generateVerdict(deliberation);
    deliberation.completedAt = toIso();
    this.history.push(deliberation);
    return deliberation;
  }

  private generateArgument(
    agent: CouncilAgent,
    topic: string,
    context: Record<string, unknown>,
    round: number,
  ): CouncilArgument {
    const sentiment = numberOr(context.sentiment, 0);
    let position: CouncilArgument["position"] = "neutral";
    if (
      [
        CouncilAgentRole.CRITIC,
        CouncilAgentRole.GUARDIAN,
        CouncilAgentRole.SKEPTIC,
      ].includes(agent.role)
    ) {
      position = "oppose";
    } else if (
      [
        CouncilAgentRole.STRATEGIST,
        CouncilAgentRole.ADVOCATE,
        CouncilAgentRole.INNOVATOR,
      ].includes(agent.role)
    ) {
      position = "support";
    }
    if (position === "neutral" && sentiment > 0.4) {
      position = "support";
    }
    if (position === "neutral" && sentiment < -0.4) {
      position = "oppose";
    }
    return {
      argumentId: randomUUID(),
      agentId: agent.agentId,
      agentRole: agent.role,
      position,
      argumentText: `[Round ${round}] ${agent.role} perspective on "${topic.slice(
        0,
        80,
      )}"`,
      confidence: clamp(0.65 + Math.random() * 0.25, 0, 1),
      evidence: [String(context.packetType ?? "unknown")],
      timestamp: toIso(),
    };
  }

  private hasConsensus(deliberation: CouncilDeliberation): boolean {
    const recent = deliberation.arguments.slice(-this.agents.length);
    const counts = { support: 0, oppose: 0, neutral: 0, abstain: 0 };
    for (const argument of recent) {
      counts[argument.position] += 1;
    }
    const total = recent.length || 1;
    return (
      counts.support / total >= deliberation.consensusThreshold ||
      counts.oppose / total >= deliberation.consensusThreshold
    );
  }

  private collectVotes(deliberation: CouncilDeliberation): CouncilVote[] {
    const votes: CouncilVote[] = [];
    for (const agent of this.agents) {
      if (!agent.active) {
        continue;
      }
      const argumentsByAgent = deliberation.arguments.filter(
        (argument) => argument.agentId === agent.agentId,
      );
      const support = argumentsByAgent.filter(
        (argument) => argument.position === "support",
      ).length;
      const oppose = argumentsByAgent.filter(
        (argument) => argument.position === "oppose",
      ).length;
      const vote: CouncilVote["vote"] =
        support > oppose ? "approve" : oppose > support ? "reject" : "defer";
      votes.push({
        voteId: randomUUID(),
        agentId: agent.agentId,
        agentRole: agent.role,
        vote,
        weight: agent.votingWeight,
        rationale: `derived from ${argumentsByAgent.length} arguments`,
        timestamp: toIso(),
      });
    }
    return votes;
  }

  private generateVerdict(deliberation: CouncilDeliberation): AGSVerdict {
    const approveWeight = deliberation.votes
      .filter((vote) => vote.vote === "approve")
      .reduce((sum, vote) => sum + vote.weight, 0);
    const rejectWeight = deliberation.votes
      .filter((vote) => vote.vote === "reject")
      .reduce((sum, vote) => sum + vote.weight, 0);
    const totalWeight = deliberation.votes
      .filter((vote) => vote.vote !== "abstain")
      .reduce((sum, vote) => sum + vote.weight, 0);
    const decision: AGSVerdict["decision"] =
      approveWeight > rejectWeight
        ? "approve"
        : rejectWeight > approveWeight
          ? "reject"
          : "defer";
    const confidence =
      totalWeight === 0
        ? 0
        : Math.max(approveWeight, rejectWeight) / totalWeight;
    return {
      deliberationId: deliberation.deliberationId,
      decision,
      confidence: clamp(confidence, 0, 1),
      voteBreakdown: {
        approve: deliberation.votes.filter((vote) => vote.vote === "approve")
          .length,
        reject: deliberation.votes.filter((vote) => vote.vote === "reject")
          .length,
        defer: deliberation.votes.filter((vote) => vote.vote === "defer")
          .length,
        abstain: deliberation.votes.filter((vote) => vote.vote === "abstain")
          .length,
      },
      weightedBreakdown: {
        approve: approveWeight,
        reject: rejectWeight,
        total: totalWeight,
      },
      keyArguments: deliberation.arguments
        .slice(-5)
        .map((argument) => argument.argumentText),
      conditions: [],
      reasoning: `decision from ${deliberation.votes.length} weighted votes`,
      timestamp: toIso(),
    };
  }

  getDeliberationHistory(limit = 10): CouncilDeliberation[] {
    return this.history.slice(-Math.max(0, limit));
  }
}

export class AGSCouncilStage extends AGSStage {
  readonly debateEngine: AGSCouncilDebateEngine;
  readonly skipForSimple: boolean;
  readonly complexityThreshold: number;

  constructor(
    options: {
      config?: AGSStageConfig;
      debateEngine?: AGSCouncilDebateEngine;
      skipForSimple?: boolean;
      complexityThreshold?: number;
      logger?: LoggerLike;
    } = {},
  ) {
    super(
      options.config ?? createStageConfig(AGSStageType.COUNCIL),
      options.logger,
    );
    this.debateEngine = options.debateEngine ?? new AGSCouncilDebateEngine();
    this.skipForSimple = options.skipForSimple ?? true;
    this.complexityThreshold = options.complexityThreshold ?? 0.5;
  }

  async process(packet: SapientPacket): Promise<SapientPacketResult> {
    const governorResult = packet.results.find(
      (result) => result.stage === AGSStageType.GOVERNOR,
    );
    const requiresCouncil = Boolean(governorResult?.metadata.councilRequired);
    if (this.skipForSimple && !requiresCouncil) {
      const ingress = packet.results.find(
        (result) => result.stage === AGSStageType.INGRESS,
      );
      const complexity = numberOr(asRecord(ingress?.output).complexityScore, 0);
      if (complexity < this.complexityThreshold) {
        return {
          stage: AGSStageType.COUNCIL,
          success: true,
          output: { skipped: true, reason: "simple_packet" },
          durationMs: 0,
          tokensUsed: 0,
          costEstimate: 0,
          metadata: { skipped: true },
        };
      }
    }
    const deliberation = await this.debateEngine.deliberate(packet);
    packet.verdict = deliberation.verdict;
    return {
      stage: AGSStageType.COUNCIL,
      success: true,
      output: deliberation,
      durationMs: 0,
      tokensUsed: deliberation.arguments.length * 20,
      costEstimate: deliberation.arguments.length * 0.0002,
      metadata: {
        decision: deliberation.verdict?.decision ?? "defer",
        confidence: deliberation.verdict?.confidence ?? 0,
        rounds: deliberation.roundsCompleted,
        consensus: deliberation.consensusReached,
      },
    };
  }
}

export enum ExecutorActionType {
  RESPOND = "respond",
  TOOL_CALL = "tool_call",
  API_CALL = "api_call",
  MEMORY_OP = "memory_op",
  SPAWN_TASK = "spawn_task",
  NOTIFY = "notify",
  LOG = "log",
  STORE = "store",
  RETRIEVE = "retrieve",
  TRANSFORM = "transform",
  DELEGATE = "delegate",
}

export type ExecutorAction = {
  actionId: string;
  actionType: ExecutorActionType;
  name: string;
  parameters: Record<string, unknown>;
  priority: number;
  timeoutSeconds: number;
  retries: number;
  dependsOn: string[];
  createdAt: string;
};

export type ExecutorResult = {
  actionId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  retriesUsed: number;
  sideEffects: string[];
  completedAt: string;
};

type ExecutorHandler = (
  params: Record<string, unknown>,
) => Promise<unknown> | unknown;

export class AGSActionRegistry {
  private readonly handlers = new Map<string, ExecutorHandler>();

  register(name: string, handler: ExecutorHandler): void {
    this.handlers.set(name, handler);
  }

  unregister(name: string): boolean {
    return this.handlers.delete(name);
  }

  listActions(): string[] {
    return [...this.handlers.keys()];
  }

  async execute(action: ExecutorAction): Promise<ExecutorResult> {
    const started = Date.now();
    const handler = this.handlers.get(action.name);
    if (!handler) {
      return {
        actionId: action.actionId,
        success: false,
        error: `no handler for action ${action.name}`,
        durationMs: Date.now() - started,
        retriesUsed: 0,
        sideEffects: [],
        completedAt: toIso(),
      };
    }
    let retriesUsed = 0;
    let lastError = "unknown";
    for (let attempt = 0; attempt <= action.retries; attempt += 1) {
      try {
        const output = await Promise.race([
          Promise.resolve(handler({ ...action.parameters })),
          sleep(action.timeoutSeconds * 1000).then(() => {
            throw new Error(`action timeout after ${action.timeoutSeconds}s`);
          }),
        ]);
        return {
          actionId: action.actionId,
          success: true,
          output,
          durationMs: Date.now() - started,
          retriesUsed,
          sideEffects: [],
          completedAt: toIso(),
        };
      } catch (error: unknown) {
        retriesUsed += 1;
        lastError = error instanceof Error ? error.message : "unknown";
      }
    }
    return {
      actionId: action.actionId,
      success: false,
      error: lastError,
      durationMs: Date.now() - started,
      retriesUsed,
      sideEffects: [],
      completedAt: toIso(),
    };
  }
}

export class AGSActionPlanner {
  plan(packet: SapientPacket): ExecutorAction[] {
    const actions: ExecutorAction[] = [];
    const addAction = (
      input: Partial<ExecutorAction> & Pick<ExecutorAction, "name">,
    ) => {
      const action: ExecutorAction = {
        actionId: input.actionId ?? randomUUID(),
        actionType: input.actionType ?? ExecutorActionType.RESPOND,
        name: input.name,
        parameters: input.parameters ?? {},
        priority: input.priority ?? 0,
        timeoutSeconds: input.timeoutSeconds ?? 30,
        retries: input.retries ?? 0,
        dependsOn: input.dependsOn ?? [],
        createdAt: input.createdAt ?? toIso(),
      };
      actions.push(action);
      return action;
    };

    if (packet.packetType === SapientPacketType.QUERY) {
      addAction({
        actionType: ExecutorActionType.RESPOND,
        name: "generate_response",
        parameters: {
          query: packet.payload.content,
          context: packet.payload.context,
        },
      });
    } else if (packet.packetType === SapientPacketType.COMMAND) {
      addAction({
        actionType: ExecutorActionType.TOOL_CALL,
        name: "execute_command",
        parameters: {
          command: packet.payload.content,
          params: packet.payload.entities,
        },
      });
    } else if (packet.packetType === SapientPacketType.PLANNING) {
      addAction({
        actionType: ExecutorActionType.SPAWN_TASK,
        name: "create_plan",
        parameters: {
          goal: packet.payload.content,
          constraints: packet.payload.context.constraints,
        },
      });
    } else if (packet.packetType === SapientPacketType.EMERGENCY) {
      const alert = addAction({
        actionType: ExecutorActionType.NOTIFY,
        name: "emergency_alert",
        parameters: {
          issue: packet.payload.content,
          severity: packet.payload.context.severity,
        },
        priority: -1,
      });
      addAction({
        actionType: ExecutorActionType.RESPOND,
        name: "emergency_response",
        parameters: { issue: packet.payload.content },
        dependsOn: [alert.actionId],
      });
    }

    addAction({
      actionType: ExecutorActionType.MEMORY_OP,
      name: "store_interaction",
      parameters: {
        packetId: packet.packetId,
        content: packet.payload.content.slice(0, 500),
        intent: packet.payload.intent,
      },
      priority: 1,
    });

    return actions.sort((left, right) => left.priority - right.priority);
  }
}

export class AGSExecutorStage extends AGSStage {
  readonly actionRegistry: AGSActionRegistry;
  readonly planner: AGSActionPlanner;
  private readonly responseGenerator?: (
    query: string,
    context: Record<string, unknown>,
  ) => string | Promise<string>;

  constructor(
    options: {
      config?: AGSStageConfig;
      actionRegistry?: AGSActionRegistry;
      planner?: AGSActionPlanner;
      responseGenerator?: (
        query: string,
        context: Record<string, unknown>,
      ) => string | Promise<string>;
      logger?: LoggerLike;
    } = {},
  ) {
    super(
      options.config ?? createStageConfig(AGSStageType.EXECUTOR),
      options.logger,
    );
    this.actionRegistry = options.actionRegistry ?? new AGSActionRegistry();
    this.planner = options.planner ?? new AGSActionPlanner();
    this.responseGenerator = options.responseGenerator;
    this.installDefaultHandlers();
  }

  private installDefaultHandlers(): void {
    this.actionRegistry.register("generate_response", async (params) => {
      const query = String(params.query ?? "");
      const context = asRecord(params.context);
      if (this.responseGenerator) {
        return this.responseGenerator(query, context);
      }
      return `Processed query: ${query.slice(0, 100)}`;
    });
    this.actionRegistry.register("store_interaction", async () => true);
    this.actionRegistry.register("emergency_alert", async (params) => ({
      alerted: true,
      severity: params.severity ?? "high",
    }));
    this.actionRegistry.register(
      "emergency_response",
      async (params) =>
        `Emergency acknowledged: ${String(params.issue ?? "").slice(0, 100)}`,
    );
    this.actionRegistry.register("create_plan", async (params) => ({
      goal: params.goal,
      constraints: params.constraints ?? [],
      steps: ["Analyze goal", "Identify resources", "Execute plan"],
    }));
    this.actionRegistry.register("execute_command", async (params) => ({
      command: params.command,
      params: params.params ?? {},
      executed: true,
    }));
  }

  async process(packet: SapientPacket): Promise<SapientPacketResult> {
    if (packet.verdict?.decision === "reject") {
      return {
        stage: AGSStageType.EXECUTOR,
        success: true,
        output: { skipped: true, reason: "rejected_by_council" },
        durationMs: 0,
        tokensUsed: 0,
        costEstimate: 0,
        metadata: { skipped: true },
      };
    }
    const actions = this.planner.plan(packet);
    const pending = [...actions];
    const completed = new Set<string>();
    const results: ExecutorResult[] = [];
    while (pending.length > 0) {
      const ready = pending.filter((action) =>
        action.dependsOn.every((dependency) => completed.has(dependency)),
      );
      if (ready.length === 0) {
        break;
      }
      for (const action of ready) {
        const result = await this.actionRegistry.execute(action);
        results.push(result);
        completed.add(action.actionId);
        pending.splice(pending.indexOf(action), 1);
      }
    }
    const primaryOutput = results.find(
      (result) => result.success && typeof result.output === "string",
    )?.output as string | undefined;
    if (primaryOutput) {
      packet.finalOutput = primaryOutput;
    }
    const success = results.every((result) => result.success);
    return {
      stage: AGSStageType.EXECUTOR,
      success,
      output: {
        actionsPlanned: actions.length,
        actionsExecuted: results.length,
        actionsSuccessful: results.filter((result) => result.success).length,
        primaryOutput,
        results: results.map((result) => ({
          actionId: result.actionId,
          success: result.success,
        })),
      },
      durationMs: 0,
      tokensUsed: results.length * 20,
      costEstimate: results.length * 0.0003,
      metadata: {
        actionCount: actions.length,
        successRate:
          results.filter((result) => result.success).length /
          Math.max(1, results.length),
      },
    };
  }
}

export enum EgressFormat {
  TEXT = "text",
  JSON = "json",
  MARKDOWN = "markdown",
  HTML = "html",
  DISCORD = "discord",
  SLACK = "slack",
  API = "api",
}

export type EgressConfig = {
  format: EgressFormat;
  maxLength: number;
  includeMetadata: boolean;
  includeReasoning: boolean;
  includeConfidence: boolean;
  language: string;
  tone: string;
  customTemplate?: string;
};

export function createEgressConfig(
  overrides: Partial<EgressConfig> = {},
): EgressConfig {
  return {
    format: overrides.format ?? EgressFormat.TEXT,
    maxLength: overrides.maxLength ?? 4000,
    includeMetadata: overrides.includeMetadata ?? false,
    includeReasoning: overrides.includeReasoning ?? false,
    includeConfidence: overrides.includeConfidence ?? true,
    language: overrides.language ?? "en",
    tone: overrides.tone ?? "professional",
    customTemplate: overrides.customTemplate,
  };
}

export type EgressOutput = {
  content: string;
  format: EgressFormat;
  length: number;
  truncated: boolean;
  metadata: Record<string, unknown>;
  deliveryChannels: string[];
  timestamp: string;
};

export class AGSOutputFormatter {
  format(
    content: string,
    config: EgressConfig,
    packet?: SapientPacket,
  ): EgressOutput {
    let formatted = content;
    if (config.format === EgressFormat.MARKDOWN) {
      formatted = this.toMarkdown(content, packet, config);
    } else if (config.format === EgressFormat.JSON) {
      formatted = this.toJson(content, packet, config);
    } else if (config.format === EgressFormat.HTML) {
      formatted = this.toHtml(content, packet, config);
    } else if (config.format === EgressFormat.DISCORD) {
      formatted = this.toDiscord(content, packet, config);
    } else if (config.format === EgressFormat.SLACK) {
      formatted = this.toSlack(content, packet, config);
    }
    let truncated = false;
    if (formatted.length > config.maxLength) {
      formatted = `${formatted.slice(0, config.maxLength - 3)}...`;
      truncated = true;
    }
    return {
      content: formatted,
      format: config.format,
      length: formatted.length,
      truncated,
      metadata: {
        originalLength: content.length,
        tone: config.tone,
        language: config.language,
      },
      deliveryChannels: [],
      timestamp: toIso(),
    };
  }

  private toMarkdown(
    content: string,
    packet: SapientPacket | undefined,
    config: EgressConfig,
  ): string {
    const lines = [content];
    if (config.includeConfidence && packet?.verdict) {
      lines.push(
        "",
        `*Confidence: ${(packet.verdict.confidence * 100).toFixed(1)}%*`,
      );
    }
    if (config.includeReasoning && packet?.verdict) {
      lines.push("", `> ${packet.verdict.reasoning}`);
    }
    return lines.join("\n");
  }

  private toJson(
    content: string,
    packet: SapientPacket | undefined,
    config: EgressConfig,
  ): string {
    const payload: Record<string, unknown> = {
      response: content,
      timestamp: toIso(),
    };
    if (config.includeMetadata && packet) {
      payload.metadata = {
        packetId: packet.packetId,
        packetType: packet.packetType,
        processingTimeMs: packet.getTotalDurationMs(),
      };
    }
    if (config.includeConfidence && packet?.verdict) {
      payload.confidence = packet.verdict.confidence;
    }
    return JSON.stringify(payload, null, 2);
  }

  private toHtml(
    content: string,
    packet: SapientPacket | undefined,
    config: EgressConfig,
  ): string {
    const escaped = content
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    let html = `<div class="ags-response"><p>${escaped}</p>`;
    if (config.includeConfidence && packet?.verdict) {
      html += `<span class="confidence">Confidence: ${(
        packet.verdict.confidence * 100
      ).toFixed(1)}%</span>`;
    }
    html += "</div>";
    return html;
  }

  private toDiscord(
    content: string,
    packet: SapientPacket | undefined,
    config: EgressConfig,
  ): string {
    let suffix = "";
    if (config.includeConfidence && packet?.verdict) {
      const confidence = packet.verdict.confidence;
      const icon = confidence > 0.8 ? "🟢" : confidence > 0.5 ? "🟡" : "🔴";
      suffix = `\n${icon} Confidence: ${(confidence * 100).toFixed(1)}%`;
    }
    return `${content}${suffix}`;
  }

  private toSlack(
    content: string,
    packet: SapientPacket | undefined,
    config: EgressConfig,
  ): string {
    if (config.includeConfidence && packet?.verdict) {
      return `${content}\n_Confidence: ${(packet.verdict.confidence * 100).toFixed(1)}%_`;
    }
    return content;
  }
}

type DeliveryHandler = (output: EgressOutput) => Promise<void> | void;

export class AGSDeliveryManager {
  private readonly channels = new Map<string, DeliveryHandler>();
  private readonly history: Array<Record<string, unknown>> = [];
  private readonly logger: LoggerLike;

  constructor(logger?: LoggerLike) {
    this.logger = getLogger(logger);
  }

  registerChannel(name: string, handler: DeliveryHandler): void {
    this.channels.set(name, handler);
  }

  async deliver(
    output: EgressOutput,
    channels: string[] = ["default"],
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const channel of channels) {
      const handler = this.channels.get(channel);
      if (!handler) {
        results[channel] = false;
        continue;
      }
      try {
        await Promise.resolve(handler(output));
        output.deliveryChannels.push(channel);
        results[channel] = true;
      } catch (error: unknown) {
        this.logger.warn(
          `Delivery to ${channel} failed: ${
            error instanceof Error ? error.message : "unknown"
          }`,
        );
        results[channel] = false;
      }
    }
    this.history.push({
      timestamp: toIso(),
      channels,
      results,
      contentLength: output.length,
    });
    return results;
  }

  getHistory(limit = 50): Array<Record<string, unknown>> {
    return this.history.slice(-Math.max(0, limit));
  }
}

export class AGSEgressStage extends AGSStage {
  readonly egressConfig: EgressConfig;
  readonly formatter: AGSOutputFormatter;
  readonly delivery: AGSDeliveryManager;

  constructor(
    options: {
      config?: AGSStageConfig;
      egressConfig?: Partial<EgressConfig>;
      formatter?: AGSOutputFormatter;
      delivery?: AGSDeliveryManager;
      logger?: LoggerLike;
    } = {},
  ) {
    super(
      options.config ?? createStageConfig(AGSStageType.EGRESS),
      options.logger,
    );
    this.egressConfig = createEgressConfig(options.egressConfig);
    this.formatter = options.formatter ?? new AGSOutputFormatter();
    this.delivery = options.delivery ?? new AGSDeliveryManager(options.logger);
    this.delivery.registerChannel("default", () => undefined);
  }

  async process(packet: SapientPacket): Promise<SapientPacketResult> {
    let content = packet.finalOutput;
    if (!content) {
      const executorResult = [...packet.results]
        .reverse()
        .find((result) => result.stage === AGSStageType.EXECUTOR);
      content = String(asRecord(executorResult?.output).primaryOutput ?? "");
    }
    if (!content) {
      content = "Request processed with no explicit output.";
    }
    const output = this.formatter.format(content, this.egressConfig, packet);
    const channels = ["default"];
    if (
      packet.metadata.sourceChannel === "discord" ||
      packet.metadata.sourceChannel === "slack"
    ) {
      channels.push(packet.metadata.sourceChannel);
    }
    const delivery = await this.delivery.deliver(output, channels);
    packet.finalOutput = output.content;
    return {
      stage: AGSStageType.EGRESS,
      success: true,
      output,
      durationMs: 0,
      tokensUsed: 0,
      costEstimate: 0,
      metadata: {
        format: output.format,
        length: output.length,
        truncated: output.truncated,
        channelsDelivered: Object.values(delivery).filter(Boolean).length,
        channelsTotal: Object.keys(delivery).length,
      },
    };
  }
}

export type AGSOutcome = {
  outcomeId: string;
  packetId: string;
  packetType: SapientPacketType;
  success: boolean;
  verdictDecision?: string;
  verdictConfidence?: number;
  totalDurationMs: number;
  stagesCompleted: string[];
  errorStage?: string;
  errorMessage?: string;
  userFeedback?: number;
  feedbackText?: string;
  learned: boolean;
  timestamp: string;
};

export class AGSOutcomeTracker {
  private readonly storagePath?: string;
  private readonly maxOutcomes: number;
  private readonly logger: LoggerLike;
  private readonly outcomes: AGSOutcome[] = [];
  private readonly byPacket = new Map<string, AGSOutcome>();
  private readonly stats = {
    total: 0,
    successful: 0,
    failed: 0,
    withFeedback: 0,
    avgDurationMs: 0,
    avgFeedback: 0,
  };

  constructor(
    options: {
      storagePath?: string;
      maxOutcomes?: number;
      logger?: LoggerLike;
    } = {},
  ) {
    this.storagePath = options.storagePath;
    this.maxOutcomes = options.maxOutcomes ?? 10_000;
    this.logger = getLogger(options.logger);
    if (this.storagePath && existsSync(this.storagePath)) {
      this.load();
    }
  }

  record(packet: SapientPacket): AGSOutcome {
    const failed = packet.results.find((result) => !result.success);
    const outcome: AGSOutcome = {
      outcomeId: randomUUID(),
      packetId: packet.packetId,
      packetType: packet.packetType,
      success: packet.status === SapientPacketStatus.COMPLETED,
      verdictDecision: packet.verdict?.decision,
      verdictConfidence: packet.verdict?.confidence,
      totalDurationMs: packet.getTotalDurationMs(),
      stagesCompleted: packet.results
        .filter((result) => result.success)
        .map((result) => result.stage),
      errorStage: failed?.stage,
      errorMessage: failed?.error,
      learned: false,
      timestamp: toIso(),
    };
    this.outcomes.push(outcome);
    this.byPacket.set(outcome.packetId, outcome);
    if (this.outcomes.length > this.maxOutcomes) {
      const removed = this.outcomes.splice(
        0,
        this.outcomes.length - this.maxOutcomes,
      );
      for (const item of removed) {
        this.byPacket.delete(item.packetId);
      }
    }
    this.updateStats(outcome);
    return outcome;
  }

  addFeedback(
    packetId: string,
    rating: number,
    feedbackText?: string,
  ): boolean {
    const outcome = this.byPacket.get(packetId);
    if (!outcome) {
      return false;
    }
    outcome.userFeedback = clamp(rating, -1, 1);
    outcome.feedbackText = feedbackText;
    this.stats.withFeedback += 1;
    const feedback = this.outcomes.filter(
      (item) => typeof item.userFeedback === "number",
    );
    this.stats.avgFeedback =
      feedback.reduce((sum, item) => sum + (item.userFeedback ?? 0), 0) /
      Math.max(1, feedback.length);
    return true;
  }

  private updateStats(outcome: AGSOutcome): void {
    this.stats.total += 1;
    if (outcome.success) {
      this.stats.successful += 1;
    } else {
      this.stats.failed += 1;
    }
    this.stats.avgDurationMs =
      (this.stats.avgDurationMs * (this.stats.total - 1) +
        outcome.totalDurationMs) /
      this.stats.total;
  }

  getOutcome(packetId: string): AGSOutcome | undefined {
    const found = this.byPacket.get(packetId);
    return found ? { ...found } : undefined;
  }

  getOutcomes(
    options: {
      limit?: number;
      successOnly?: boolean;
      failedOnly?: boolean;
      withFeedback?: boolean;
    } = {},
  ): AGSOutcome[] {
    let filtered = [...this.outcomes];
    if (options.successOnly) {
      filtered = filtered.filter((outcome) => outcome.success);
    } else if (options.failedOnly) {
      filtered = filtered.filter((outcome) => !outcome.success);
    }
    if (options.withFeedback) {
      filtered = filtered.filter(
        (outcome) => typeof outcome.userFeedback === "number",
      );
    }
    return filtered.slice(-Math.max(0, options.limit ?? 100));
  }

  getStats(): Record<string, unknown> {
    return {
      ...this.stats,
      successRate: this.stats.successful / Math.max(1, this.stats.total),
    };
  }

  getFailureAnalysis(): Record<string, unknown> {
    const failed = this.outcomes.filter((outcome) => !outcome.success);
    const byStage: Record<string, number> = {};
    const byPacketType: Record<string, number> = {};
    for (const outcome of failed) {
      if (outcome.errorStage) {
        byStage[outcome.errorStage] = (byStage[outcome.errorStage] ?? 0) + 1;
      }
      byPacketType[outcome.packetType] =
        (byPacketType[outcome.packetType] ?? 0) + 1;
    }
    const entries = Object.entries(byStage).sort((a, b) => b[1] - a[1]);
    return {
      totalFailures: failed.length,
      byStage,
      byPacketType,
      mostCommonStage: entries[0]?.[0],
    };
  }

  private load(): void {
    if (!this.storagePath || !existsSync(this.storagePath)) {
      return;
    }
    try {
      const parsed = asRecord(
        JSON.parse(readFileSync(this.storagePath, "utf8")),
      );
      const outcomes = Array.isArray(parsed.outcomes)
        ? (parsed.outcomes as AGSOutcome[])
        : [];
      this.outcomes.push(...outcomes);
      for (const outcome of outcomes) {
        this.byPacket.set(outcome.packetId, outcome);
      }
      Object.assign(this.stats, asRecord(parsed.stats));
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to load outcomes: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  save(): void {
    if (!this.storagePath) {
      return;
    }
    mkdirSync(dirname(this.storagePath), { recursive: true });
    writeFileSync(
      this.storagePath,
      JSON.stringify(
        {
          outcomes: this.outcomes.slice(-1000),
          stats: this.stats,
        },
        null,
        2,
      ),
      "utf8",
    );
  }
}

export type LearningSignal = {
  signalId: string;
  signalType: "positive" | "negative" | "neutral";
  source: "feedback" | "outcome" | "performance";
  strength: number;
  context: Record<string, unknown>;
  recommendations: string[];
  timestamp: string;
};

export class AGSLearningLoop {
  private readonly outcomeTracker: AGSOutcomeTracker;
  private readonly learningRate: number;
  private readonly feedbackThreshold: number;
  private readonly logger: LoggerLike;
  private readonly signals: LearningSignal[] = [];
  private readonly adaptations: Array<Record<string, unknown>> = [];
  private lastRun?: string;

  constructor(options: {
    outcomeTracker: AGSOutcomeTracker;
    learningRate?: number;
    feedbackThreshold?: number;
    logger?: LoggerLike;
  }) {
    this.outcomeTracker = options.outcomeTracker;
    this.learningRate = options.learningRate ?? 0.1;
    this.feedbackThreshold = options.feedbackThreshold ?? 0.5;
    this.logger = getLogger(options.logger);
  }

  analyzeOutcomes(windowHours = 24): LearningSignal[] {
    const cutoff = Date.now() - windowHours * 3_600_000;
    const recent = this.outcomeTracker
      .getOutcomes({ limit: 1000 })
      .filter((outcome) => new Date(outcome.timestamp).getTime() >= cutoff);
    if (recent.length === 0) {
      return [];
    }
    const generated: LearningSignal[] = [];
    const successRate =
      recent.filter((outcome) => outcome.success).length / recent.length;
    if (successRate < 0.8) {
      generated.push({
        signalId: randomUUID(),
        signalType: "negative",
        source: "outcome",
        strength: 1 - successRate,
        context: { successRate, sampleSize: recent.length },
        recommendations: ["review failure patterns", "adjust policy rules"],
        timestamp: toIso(),
      });
    }
    const feedback = recent.filter(
      (outcome) => typeof outcome.userFeedback === "number",
    );
    if (feedback.length > 0) {
      const avgFeedback =
        feedback.reduce(
          (sum, outcome) => sum + (outcome.userFeedback ?? 0),
          0,
        ) / feedback.length;
      if (avgFeedback < this.feedbackThreshold) {
        generated.push({
          signalId: randomUUID(),
          signalType: "negative",
          source: "feedback",
          strength: this.feedbackThreshold - avgFeedback,
          context: { avgFeedback, sampleSize: feedback.length },
          recommendations: [
            "improve response quality",
            "review intent detection",
          ],
          timestamp: toIso(),
        });
      } else if (avgFeedback > 0.7) {
        generated.push({
          signalId: randomUUID(),
          signalType: "positive",
          source: "feedback",
          strength: avgFeedback,
          context: { avgFeedback, sampleSize: feedback.length },
          recommendations: ["reinforce successful patterns"],
          timestamp: toIso(),
        });
      }
    }
    const avgDuration =
      recent.reduce((sum, outcome) => sum + outcome.totalDurationMs, 0) /
      recent.length;
    if (avgDuration > 5000) {
      generated.push({
        signalId: randomUUID(),
        signalType: "negative",
        source: "performance",
        strength: clamp((avgDuration - 5000) / 10000, 0, 1),
        context: { avgDurationMs: avgDuration },
        recommendations: ["optimize slow stages", "review cache settings"],
        timestamp: toIso(),
      });
    }
    this.signals.push(...generated);
    return generated;
  }

  applyLearning(signals: LearningSignal[]): Array<Record<string, unknown>> {
    const output: Array<Record<string, unknown>> = [];
    for (const signal of signals) {
      if (signal.signalType === "positive" && signal.source === "feedback") {
        output.push({
          type: "reinforcement",
          action: "increase_confidence_weight",
          factor: 1 + signal.strength * this.learningRate,
          signalId: signal.signalId,
          timestamp: toIso(),
        });
      } else if (signal.signalType === "negative") {
        output.push({
          type: "correction",
          action:
            signal.source === "performance"
              ? "tune_timeouts_and_caching"
              : "review_quality_and_failures",
          strength: signal.strength,
          signalId: signal.signalId,
          timestamp: toIso(),
        });
      }
    }
    this.adaptations.push(...output);
    this.lastRun = toIso();
    return output;
  }

  async runLearningCycle(): Promise<Record<string, unknown>> {
    this.logger.info("running AGS learning cycle");
    const signals = this.analyzeOutcomes();
    const adaptations = this.applyLearning(signals);
    return {
      signalsDetected: signals.length,
      adaptationsMade: adaptations.length,
      positiveSignals: signals.filter(
        (signal) => signal.signalType === "positive",
      ).length,
      negativeSignals: signals.filter(
        (signal) => signal.signalType === "negative",
      ).length,
      timestamp: toIso(),
    };
  }

  getLearningHistory(limit = 50): Record<string, unknown> {
    return {
      recentSignals: this.signals.slice(-Math.max(0, limit)),
      recentAdaptations: this.adaptations.slice(-Math.max(0, limit)),
      lastRun: this.lastRun,
    };
  }
}

export class AGSAnalytics {
  private readonly pipeline?: AGSPipeline;
  private readonly outcomeTracker?: AGSOutcomeTracker;
  private readonly debateEngine?: AGSCouncilDebateEngine;
  private readonly snapshots: Array<Record<string, unknown>> = [];

  constructor(
    options: {
      pipeline?: AGSPipeline;
      outcomeTracker?: AGSOutcomeTracker;
      debateEngine?: AGSCouncilDebateEngine;
    } = {},
  ) {
    this.pipeline = options.pipeline;
    this.outcomeTracker = options.outcomeTracker;
    this.debateEngine = options.debateEngine;
  }

  captureSnapshot(): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {
      timestamp: toIso(),
      pipeline: this.pipeline?.getMetrics() ?? {},
      outcomes: this.outcomeTracker?.getStats() ?? {},
      council: {},
    };
    if (this.debateEngine) {
      const history = this.debateEngine.getDeliberationHistory(100);
      if (history.length > 0) {
        snapshot.council = {
          totalDeliberations: history.length,
          consensusRate:
            history.filter((item) => item.consensusReached).length /
            history.length,
          avgRounds:
            history.reduce((sum, item) => sum + item.roundsCompleted, 0) /
            history.length,
          avgArguments:
            history.reduce((sum, item) => sum + item.arguments.length, 0) /
            history.length,
        };
      }
    }
    this.snapshots.push(snapshot);
    if (this.snapshots.length > 1000) {
      this.snapshots.splice(0, this.snapshots.length - 500);
    }
    return snapshot;
  }

  getDashboardData(): Record<string, unknown> {
    const current = this.captureSnapshot();
    return {
      current,
      trends: this.calculateTrends(),
      alerts: this.checkAlerts(),
      recommendations: this.generateRecommendations(),
    };
  }

  private calculateTrends(): Record<string, unknown> {
    const recent = this.snapshots.slice(-10);
    if (recent.length < 2) {
      return {};
    }
    const successRates = recent
      .map((snapshot) => asRecord(asRecord(snapshot.pipeline).pipeline))
      .filter((pipeline) => numberOr(pipeline.totalProcessed, 0) > 0)
      .map(
        (pipeline) =>
          numberOr(pipeline.successful, 0) /
          Math.max(1, numberOr(pipeline.totalProcessed, 1)),
      );
    return {
      pipelineSuccessTrend: successRates,
      trendDirection:
        successRates.length > 1 && successRates.at(-1)! >= successRates[0]
          ? "up"
          : "down",
    };
  }

  private checkAlerts(): Array<Record<string, unknown>> {
    const current = this.snapshots.at(-1);
    if (!current) {
      return [];
    }
    const alerts: Array<Record<string, unknown>> = [];
    const pipeline = asRecord(asRecord(current.pipeline).pipeline);
    const total = numberOr(pipeline.totalProcessed, 0);
    if (total > 0) {
      const successRate = numberOr(pipeline.successful, 0) / total;
      if (successRate < 0.9) {
        alerts.push({
          level: successRate > 0.7 ? "warning" : "critical",
          type: "pipeline_success_rate",
          message: `pipeline success rate is ${(successRate * 100).toFixed(1)}%`,
          value: successRate,
        });
      }
    }
    const queue = asRecord(asRecord(current.pipeline).queue);
    const queueSize = numberOr(queue.currentSize, 0);
    const queueLimit = Math.max(1, numberOr(queue.maxSize, 1000));
    if (queueSize > queueLimit * 0.8) {
      alerts.push({
        level: "warning",
        type: "queue_capacity",
        message: `queue is at ${((queueSize / queueLimit) * 100).toFixed(1)}% capacity`,
        value: queueSize,
      });
    }
    if (numberOr(pipeline.avgTotalDurationMs, 0) > 10_000) {
      alerts.push({
        level: "warning",
        type: "slow_processing",
        message: `average processing time is ${Math.round(
          numberOr(pipeline.avgTotalDurationMs, 0),
        )}ms`,
        value: numberOr(pipeline.avgTotalDurationMs, 0),
      });
    }
    return alerts;
  }

  private generateRecommendations(): string[] {
    const output = new Set<string>();
    for (const alert of this.checkAlerts()) {
      if (alert.type === "pipeline_success_rate") {
        output.add("review failure patterns and error handling");
      } else if (alert.type === "queue_capacity") {
        output.add("increase worker capacity or tighten rate limiting");
      } else if (alert.type === "slow_processing") {
        output.add("enable more aggressive caching");
        output.add("raise council complexity threshold");
      }
    }
    const trends = this.calculateTrends();
    if (trends.trendDirection === "down") {
      output.add("monitor for regressions in recent changes");
    }
    return [...output];
  }

  generateReport(): string {
    const data = this.getDashboardData();
    const current = asRecord(data.current);
    const pipeline = asRecord(asRecord(current.pipeline).pipeline);
    const outcomes = asRecord(current.outcomes);
    const council = asRecord(current.council);
    const lines = [
      "# AGS Analytics Report",
      `Generated: ${toIso()}`,
      "",
      "## Current State",
      `- Total Processed: ${numberOr(pipeline.totalProcessed, 0)}`,
      `- Successful: ${numberOr(pipeline.successful, 0)}`,
      `- Failed: ${numberOr(pipeline.failed, 0)}`,
      `- Avg Duration: ${numberOr(pipeline.avgTotalDurationMs, 0).toFixed(1)}ms`,
      "",
      "## Outcomes",
      `- Total: ${numberOr(outcomes.total, 0)}`,
      `- Success Rate: ${(numberOr(outcomes.successRate, 0) * 100).toFixed(1)}%`,
      `- With Feedback: ${numberOr(outcomes.withFeedback, 0)}`,
      `- Avg Feedback: ${numberOr(outcomes.avgFeedback, 0).toFixed(2)}`,
      "",
      "## Council",
      `- Total Deliberations: ${numberOr(council.totalDeliberations, 0)}`,
      `- Consensus Rate: ${(numberOr(council.consensusRate, 0) * 100).toFixed(1)}%`,
      `- Avg Rounds: ${numberOr(council.avgRounds, 0).toFixed(1)}`,
      "",
      "## Alerts",
    ];
    for (const alert of data.alerts as Array<Record<string, unknown>>) {
      lines.push(
        `- [${String(alert.level).toUpperCase()}] ${String(alert.message)}`,
      );
    }
    lines.push("", "## Recommendations");
    for (const recommendation of data.recommendations as string[]) {
      lines.push(`- ${recommendation}`);
    }
    return lines.join("\n");
  }
}

export class AGSSystemConfig {
  readonly enableIngress: boolean;
  readonly enableGovernor: boolean;
  readonly enableCouncil: boolean;
  readonly enableExecutor: boolean;
  readonly enableEgress: boolean;
  readonly enableLearning: boolean;
  readonly enableAnalytics: boolean;
  readonly councilMaxRounds: number;
  readonly councilConsensusThreshold: number;
  readonly councilComplexityThreshold: number;
  readonly maxQueueSize: number;
  readonly maxOutcomes: number;
  readonly egressFormat: EgressFormat;
  readonly storageDir?: string;

  constructor(overrides: Partial<AGSSystemConfig> = {}) {
    this.enableIngress = overrides.enableIngress ?? true;
    this.enableGovernor = overrides.enableGovernor ?? true;
    this.enableCouncil = overrides.enableCouncil ?? true;
    this.enableExecutor = overrides.enableExecutor ?? true;
    this.enableEgress = overrides.enableEgress ?? true;
    this.enableLearning = overrides.enableLearning ?? true;
    this.enableAnalytics = overrides.enableAnalytics ?? true;
    this.councilMaxRounds = overrides.councilMaxRounds ?? 3;
    this.councilConsensusThreshold = overrides.councilConsensusThreshold ?? 0.7;
    this.councilComplexityThreshold =
      overrides.councilComplexityThreshold ?? 0.5;
    this.maxQueueSize = overrides.maxQueueSize ?? 1000;
    this.maxOutcomes = overrides.maxOutcomes ?? 10_000;
    this.egressFormat = overrides.egressFormat ?? EgressFormat.TEXT;
    this.storageDir = overrides.storageDir;
  }
}

export class AGSSystemFactory {
  static create(
    options: {
      config?: AGSSystemConfig;
      logger?: LoggerLike;
    } = {},
  ): AGSSystem {
    const config = options.config ?? new AGSSystemConfig();
    const logger = getLogger(options.logger);
    const queue = new SapientPacketQueue({
      maxSize: config.maxQueueSize,
      logger,
    });
    const packetFactory = new SapientPacketFactory({ logger });
    const pipeline = new AGSPipeline({
      packetQueue: queue,
      logger,
    });

    if (config.enableIngress) {
      pipeline.registerStage(
        new AGSIngressStage({
          logger,
        }),
      );
    }
    let governor: AGSGovernorStage | undefined;
    if (config.enableGovernor) {
      governor = new AGSGovernorStage({ logger });
      pipeline.registerStage(governor);
    }
    let debateEngine: AGSCouncilDebateEngine | undefined;
    if (config.enableCouncil) {
      debateEngine = new AGSCouncilDebateEngine({
        maxRounds: config.councilMaxRounds,
        consensusThreshold: config.councilConsensusThreshold,
      });
      pipeline.registerStage(
        new AGSCouncilStage({
          debateEngine,
          complexityThreshold: config.councilComplexityThreshold,
          logger,
        }),
      );
    }
    if (config.enableExecutor) {
      pipeline.registerStage(
        new AGSExecutorStage({
          logger,
        }),
      );
    }
    if (config.enableEgress) {
      pipeline.registerStage(
        new AGSEgressStage({
          egressConfig: {
            format: config.egressFormat,
          },
          logger,
        }),
      );
    }

    const outcomePath = config.storageDir
      ? join(config.storageDir, "outcomes.json")
      : undefined;
    const outcomeTracker = new AGSOutcomeTracker({
      storagePath: outcomePath,
      maxOutcomes: config.maxOutcomes,
      logger,
    });
    const learningLoop = config.enableLearning
      ? new AGSLearningLoop({
          outcomeTracker,
          logger,
        })
      : undefined;
    const analytics = config.enableAnalytics
      ? new AGSAnalytics({
          pipeline,
          outcomeTracker,
          debateEngine,
        })
      : undefined;

    return new AGSSystem({
      pipeline,
      packetFactory,
      outcomeTracker,
      learningLoop,
      analytics,
      config,
      logger,
      governorStage: governor,
    });
  }
}

export class AGSSystem {
  readonly pipeline: AGSPipeline;
  readonly packetFactory: SapientPacketFactory;
  readonly outcomeTracker: AGSOutcomeTracker;
  readonly learningLoop?: AGSLearningLoop;
  readonly analytics?: AGSAnalytics;
  readonly config: AGSSystemConfig;
  readonly logger: LoggerLike;
  readonly governorStage?: AGSGovernorStage;
  private processedCount = 0;

  constructor(input: {
    pipeline: AGSPipeline;
    packetFactory: SapientPacketFactory;
    outcomeTracker: AGSOutcomeTracker;
    learningLoop?: AGSLearningLoop;
    analytics?: AGSAnalytics;
    config: AGSSystemConfig;
    logger?: LoggerLike;
    governorStage?: AGSGovernorStage;
  }) {
    this.pipeline = input.pipeline;
    this.packetFactory = input.packetFactory;
    this.outcomeTracker = input.outcomeTracker;
    this.learningLoop = input.learningLoop;
    this.analytics = input.analytics;
    this.config = input.config;
    this.logger = getLogger(input.logger);
    this.governorStage = input.governorStage;
  }

  async process(
    content: string,
    options: {
      packetType?: SapientPacketType;
      context?: Record<string, unknown>;
      parameters?: Record<string, unknown>;
      severity?: string;
    } = {},
  ): Promise<Record<string, unknown>> {
    const packetType = options.packetType ?? SapientPacketType.QUERY;
    let packet: SapientPacket;
    if (packetType === SapientPacketType.QUERY) {
      packet = this.packetFactory.createQueryPacket({
        content,
        context: options.context,
      });
    } else if (packetType === SapientPacketType.COMMAND) {
      packet = this.packetFactory.createCommandPacket({
        command: content,
        parameters: options.parameters,
      });
    } else if (packetType === SapientPacketType.EMERGENCY) {
      packet = this.packetFactory.createEmergencyPacket({
        issue: content,
        severity: options.severity,
      });
    } else if (packetType === SapientPacketType.PLANNING) {
      packet = this.packetFactory.createPlanningPacket({
        goal: content,
      });
    } else {
      packet = this.packetFactory.createQueryPacket({
        content,
        context: options.context,
      });
    }
    const resultPacket = await this.pipeline.processPacket(packet);
    const outcome = this.outcomeTracker.record(resultPacket);
    this.processedCount += 1;
    return {
      packetId: resultPacket.packetId,
      status: resultPacket.status,
      output: resultPacket.finalOutput,
      durationMs: resultPacket.getTotalDurationMs(),
      verdict: resultPacket.verdict
        ? {
            decision: resultPacket.verdict.decision,
            confidence: resultPacket.verdict.confidence,
          }
        : undefined,
      outcomeId: outcome.outcomeId,
    };
  }

  submit(
    content: string,
    options: { packetType?: SapientPacketType } = {},
  ): string {
    const packet =
      options.packetType === SapientPacketType.COMMAND
        ? this.packetFactory.createCommandPacket({ command: content })
        : this.packetFactory.createQueryPacket({ content });
    this.pipeline.packetQueue.enqueue(packet);
    return packet.packetId;
  }

  addFeedback(packetId: string, rating: number, text?: string): boolean {
    return this.outcomeTracker.addFeedback(packetId, rating, text);
  }

  async runLearningCycle(): Promise<Record<string, unknown>> {
    if (!this.learningLoop) {
      return { error: "learning_loop_disabled" };
    }
    return this.learningLoop.runLearningCycle();
  }

  getAnalyticsReport(): string {
    if (!this.analytics) {
      return "analytics disabled";
    }
    return this.analytics.generateReport();
  }

  getStats(): Record<string, unknown> {
    return {
      processedCount: this.processedCount,
      pipeline: this.pipeline.getMetrics(),
      outcomes: this.outcomeTracker.getStats(),
      learning: this.learningLoop?.getLearningHistory(),
    };
  }
}

export enum AGSIntegrationStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
  DISABLED = "disabled",
}

export enum AGSIntegrationCategory {
  MONITORING = "monitoring",
  ANALYTICS = "analytics",
  BILLING = "billing",
  COMMUNICATION = "communication",
  STORAGE = "storage",
  DATABASE = "database",
  REPOSITORY = "repository",
  PRODUCTIVITY = "productivity",
}

export type AGSIntegrationHealth = {
  name: string;
  category: AGSIntegrationCategory;
  status: AGSIntegrationStatus;
  lastCheck: string;
  latencyMs?: number;
  errorCount: number;
  successRate: number;
  lastError?: string;
  metadata: Record<string, unknown>;
};

export type AGSIntegrationEvent = {
  eventId: string;
  integration: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
  source: string;
  correlationId?: string;
  priority: number;
};

export class AGSIntegrationConfig {
  readonly enabled: boolean;
  readonly timeoutMs: number;
  readonly retryCount: number;
  readonly retryDelayMs: number;
  readonly cacheTtlSeconds: number;
  readonly rateLimitPerMinute: number;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly extra: Record<string, unknown>;

  constructor(overrides: Partial<AGSIntegrationConfig> = {}) {
    this.enabled = overrides.enabled ?? true;
    this.timeoutMs = overrides.timeoutMs ?? 5000;
    this.retryCount = overrides.retryCount ?? 3;
    this.retryDelayMs = overrides.retryDelayMs ?? 1000;
    this.cacheTtlSeconds = overrides.cacheTtlSeconds ?? 300;
    this.rateLimitPerMinute = overrides.rateLimitPerMinute ?? 60;
    this.apiKey = overrides.apiKey;
    this.baseUrl = overrides.baseUrl;
    this.extra = overrides.extra ? { ...overrides.extra } : {};
  }
}

export class IntegrationDisabledError extends Error {}
export class RateLimitExceededError extends Error {}
export class AGSIntegrationError extends Error {}

export abstract class AGSBaseIntegrationClient {
  readonly name: string;
  readonly category: AGSIntegrationCategory;
  readonly config: AGSIntegrationConfig;
  protected readonly logger: LoggerLike;
  private health: AGSIntegrationHealth;
  private readonly cache = new Map<string, { value: unknown; at: number }>();
  private readonly requests: number[] = [];
  private successCount = 0;
  private errorCount = 0;

  constructor(input: {
    name: string;
    category: AGSIntegrationCategory;
    config?: AGSIntegrationConfig;
    logger?: LoggerLike;
  }) {
    this.name = input.name;
    this.category = input.category;
    this.config = input.config ?? new AGSIntegrationConfig();
    this.logger = getLogger(input.logger);
    this.health = {
      name: this.name,
      category: this.category,
      status: AGSIntegrationStatus.UNKNOWN,
      lastCheck: toIso(),
      errorCount: 0,
      successRate: 1,
      metadata: {},
    };
  }

  protected abstract executeRequest(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<unknown>;

  abstract healthCheck(): Promise<AGSIntegrationHealth>;

  async execute(
    operation: string,
    params: Record<string, unknown> = {},
    cacheKey?: string,
  ): Promise<unknown> {
    if (!this.config.enabled) {
      throw new IntegrationDisabledError(`${this.name} disabled`);
    }
    this.enforceRateLimit();
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (
        cached &&
        (Date.now() - cached.at) / 1000 < this.config.cacheTtlSeconds
      ) {
        return cached.value;
      }
    }
    let lastError = "unknown";
    for (let attempt = 0; attempt < this.config.retryCount; attempt += 1) {
      try {
        this.requests.push(Date.now());
        const value = await Promise.race([
          this.executeRequest(operation, params),
          sleep(this.config.timeoutMs).then(() => {
            throw new Error(`timeout after ${this.config.timeoutMs}ms`);
          }),
        ]);
        this.successCount += 1;
        if (cacheKey) {
          this.cache.set(cacheKey, { value, at: Date.now() });
        }
        return value;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : "unknown";
        this.errorCount += 1;
        if (attempt < this.config.retryCount - 1) {
          await sleep(this.config.retryDelayMs);
        }
      }
    }
    this.health.status = AGSIntegrationStatus.UNHEALTHY;
    this.health.lastError = lastError;
    throw new AGSIntegrationError(
      `${this.name} failed after ${this.config.retryCount} attempts: ${lastError}`,
    );
  }

  private enforceRateLimit(): void {
    const now = Date.now();
    const minuteAgo = now - 60_000;
    while (this.requests.length && this.requests[0] < minuteAgo) {
      this.requests.shift();
    }
    if (this.requests.length >= this.config.rateLimitPerMinute) {
      throw new RateLimitExceededError(`${this.name} rate limit exceeded`);
    }
  }

  getHealth(): AGSIntegrationHealth {
    const total = this.successCount + this.errorCount;
    this.health.errorCount = this.errorCount;
    this.health.successRate = total === 0 ? 1 : this.successCount / total;
    this.health.lastCheck = toIso();
    return { ...this.health, metadata: { ...this.health.metadata } };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export class AGSIntegrationRegistry {
  private readonly integrations = new Map<string, AGSBaseIntegrationClient>();
  private readonly byCategory = new Map<AGSIntegrationCategory, Set<string>>();
  private readonly logger: LoggerLike;

  constructor(logger?: LoggerLike) {
    this.logger = getLogger(logger);
    for (const category of Object.values(AGSIntegrationCategory)) {
      this.byCategory.set(category, new Set());
    }
  }

  register(client: AGSBaseIntegrationClient): void {
    this.integrations.set(client.name, client);
    this.byCategory.get(client.category)?.add(client.name);
  }

  unregister(name: string): boolean {
    const client = this.integrations.get(name);
    if (!client) {
      return false;
    }
    this.byCategory.get(client.category)?.delete(name);
    return this.integrations.delete(name);
  }

  get(name: string): AGSBaseIntegrationClient | undefined {
    return this.integrations.get(name);
  }

  getByCategory(category: AGSIntegrationCategory): AGSBaseIntegrationClient[] {
    return [...(this.byCategory.get(category) ?? [])]
      .map((name) => this.integrations.get(name))
      .filter((client): client is AGSBaseIntegrationClient => Boolean(client));
  }

  listAll(): string[] {
    return [...this.integrations.keys()];
  }

  async healthCheckAll(): Promise<Record<string, AGSIntegrationHealth>> {
    const output: Record<string, AGSIntegrationHealth> = {};
    for (const [name, client] of this.integrations.entries()) {
      try {
        output[name] = await client.healthCheck();
      } catch (error: unknown) {
        output[name] = {
          name,
          category: client.category,
          status: AGSIntegrationStatus.UNHEALTHY,
          lastCheck: toIso(),
          errorCount: 1,
          successRate: 0,
          lastError: error instanceof Error ? error.message : "unknown",
          metadata: {},
        };
      }
    }
    return output;
  }

  getSummary(): Record<string, unknown> {
    return {
      totalIntegrations: this.integrations.size,
      byCategory: Object.fromEntries(
        [...this.byCategory.entries()].map(([category, names]) => [
          category,
          names.size,
        ]),
      ),
      integrations: [...this.integrations.values()].map((client) => ({
        name: client.name,
        category: client.category,
        enabled: client.config.enabled,
        health: client.getHealth().status,
      })),
    };
  }
}

export class AGSIntegrationOrchestrator {
  private readonly registry: AGSIntegrationRegistry;
  private readonly logger: LoggerLike;
  private readonly workflows = new Map<
    string,
    Array<Record<string, unknown>>
  >();
  private readonly history: Array<Record<string, unknown>> = [];

  constructor(input: {
    registry: AGSIntegrationRegistry;
    logger?: LoggerLike;
  }) {
    this.registry = input.registry;
    this.logger = getLogger(input.logger);
  }

  defineWorkflow(name: string, steps: Array<Record<string, unknown>>): void {
    this.workflows.set(
      name,
      steps.map((step) => ({ ...step })),
    );
  }

  async executeWorkflow(
    name: string,
    context: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const steps = this.workflows.get(name);
    if (!steps) {
      throw new Error(`workflow ${name} not found`);
    }
    const executionId = randomUUID();
    const stepResults: Array<Record<string, unknown>> = [];
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const integration = String(step.integration ?? "");
      const operation = String(step.operation ?? "");
      const onError = String(step.onError ?? "abort");
      const params = this.resolveParams(asRecord(step.params), context);
      const client = this.registry.get(integration);
      if (!client) {
        const result = {
          step: index,
          status: "error",
          error: `integration ${integration} not found`,
        };
        stepResults.push(result);
        if (onError !== "skip") {
          break;
        }
        continue;
      }
      try {
        const result = await client.execute(operation, params);
        stepResults.push({ step: index, status: "success", result });
        context[`step_${index}_result`] = result;
      } catch (error: unknown) {
        const result = {
          step: index,
          status: "error",
          error: error instanceof Error ? error.message : "unknown",
        };
        stepResults.push(result);
        if (onError === "retry") {
          try {
            const retry = await client.execute(operation, params);
            stepResults[stepResults.length - 1] = {
              step: index,
              status: "success_retry",
              result: retry,
            };
            context[`step_${index}_result`] = retry;
            continue;
          } catch (retryError: unknown) {
            stepResults[stepResults.length - 1] = {
              ...result,
              retryError:
                retryError instanceof Error ? retryError.message : "unknown",
            };
          }
        }
        if (onError !== "skip") {
          break;
        }
      }
    }
    const execution = {
      executionId,
      workflow: name,
      timestamp: toIso(),
      results: stepResults,
      success: stepResults.every((result) =>
        ["success", "success_retry", "skipped"].includes(String(result.status)),
      ),
    };
    this.history.push(execution);
    return execution;
  }

  private resolveParams(
    params: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (
        typeof value === "string" &&
        value.startsWith("${") &&
        value.endsWith("}")
      ) {
        const variable = value.slice(2, -1);
        output[key] = context[variable] ?? value;
      } else {
        output[key] = value;
      }
    }
    return output;
  }

  getHistory(limit = 100): Array<Record<string, unknown>> {
    return this.history.slice(-Math.max(0, limit));
  }
}

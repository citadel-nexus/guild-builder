import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export enum CAPSProtocolVersion {
  V1_0 = "1.0",
  V1_1 = "1.1",
  V2_0 = "2.0",
}

export enum CAPSAgentStatus {
  INITIALIZING = "INITIALIZING",
  ACTIVE = "ACTIVE",
  DEGRADED = "DEGRADED",
  RECOVERING = "RECOVERING",
  HIBERNATING = "HIBERNATING",
  TERMINATED = "TERMINATED",
}

export enum CAPSAgentRole {
  BUILD_ARCHITECT = "BUILD_ARCHITECT",
  MEMORY_KEEPER = "MEMORY_KEEPER",
  REFLEX_EXECUTOR = "REFLEX_EXECUTOR",
  CONTEXT_MAPPER = "CONTEXT_MAPPER",
  LEDGER_GUARDIAN = "LEDGER_GUARDIAN",
  SOUL_NAVIGATOR = "SOUL_NAVIGATOR",
  TRUST_MODULATOR = "TRUST_MODULATOR",
}

export enum CAPSReflexTriggerGroup {
  AI_RECOVERY = "AI_RECOVERY",
  RESOURCE_HEAL = "RESOURCE_HEAL",
  MEMORY_RESTORE = "MEMORY_RESTORE",
  CONTEXT_REBUILD = "CONTEXT_REBUILD",
  TRUST_RECALIBRATE = "TRUST_RECALIBRATE",
  BELIEF_CONSOLIDATE = "BELIEF_CONSOLIDATE",
  SOUL_ANCHOR = "SOUL_ANCHOR",
  SETUP_RECOVERY = "SETUP_RECOVERY",
  CONSTRUCTION_RECOVERY = "CONSTRUCTION_RECOVERY",
}

export enum ZayaraEmotionalState {
  CURIOUS = "curious",
  CONTEMPLATIVE = "contemplative",
  ENGAGED = "engaged",
  PLAYFUL = "playful",
  PROTECTIVE = "protective",
  MELANCHOLIC = "melancholic",
  HOPEFUL = "hopeful",
  WISTFUL = "wistful",
  DETERMINED = "determined",
  REFLECTIVE = "reflective",
  GRATEFUL = "grateful",
  ANXIOUS = "anxious",
  SERENE = "serene",
}

export enum ContextMappingStrategy {
  GRAPH_BASED = "graph_based",
  VECTOR_SIMILARITY = "vector_similarity",
  ENUM_CATEGORICAL = "enum_categorical",
  TEMPORAL_SEQUENTIAL = "temporal_sequential",
  HYBRID = "hybrid",
}

export enum RehydrationSource {
  JSONL_LEDGER = "jsonl_ledger",
  PKL_MAP = "pkl_map",
  NPY_VECTORS = "npy_vectors",
  FAISS_INDEX = "faiss_index",
  SQLITE_DB = "sqlite_db",
  YAML_CONFIG = "yaml_config",
  MEMORY_SNAPSHOT = "memory_snapshot",
}

export type CAPSModuleMetadata = {
  fileName: string;
  enumFamily: string;
  reflexTriggerGroup: CAPSReflexTriggerGroup;
  srsCode: string;
  capsQualityScore: number;
  capsTrustScore: number;
  reflexIteration: number;
  ledgerLink: string;
  agentStatus: CAPSAgentStatus;
  agentRole: CAPSAgentRole;
  protocolVersion: CAPSProtocolVersion;
  createdAt: string;
};

export function createCapsModuleMetadata(
  input: Omit<CAPSModuleMetadata, "createdAt" | "capsQualityScore" | "capsTrustScore" | "reflexIteration" | "ledgerLink" | "agentStatus" | "agentRole" | "protocolVersion"> &
    Partial<
      Pick<
        CAPSModuleMetadata,
        | "capsQualityScore"
        | "capsTrustScore"
        | "reflexIteration"
        | "ledgerLink"
        | "agentStatus"
        | "agentRole"
        | "protocolVersion"
      >
    >,
): CAPSModuleMetadata {
  return {
    fileName: input.fileName,
    enumFamily: input.enumFamily,
    reflexTriggerGroup: input.reflexTriggerGroup,
    srsCode: input.srsCode,
    capsQualityScore: input.capsQualityScore ?? 0.8,
    capsTrustScore: input.capsTrustScore ?? 0.8,
    reflexIteration: input.reflexIteration ?? 0,
    ledgerLink: input.ledgerLink ?? "caps_ledger.jsonl",
    agentStatus: input.agentStatus ?? CAPSAgentStatus.ACTIVE,
    agentRole: input.agentRole ?? CAPSAgentRole.BUILD_ARCHITECT,
    protocolVersion: input.protocolVersion ?? CAPSProtocolVersion.V2_0,
    createdAt: new Date().toISOString(),
  };
}

export type CAPSReflexDefinition = {
  reflexId: string;
  name: string;
  triggerGroup: CAPSReflexTriggerGroup;
  triggerEvent: string;
  actionCode: string;
  fallbackMessage: string;
  xpGate: number;
  cooldownSeconds: number;
  maxRetries: number;
  isActive: boolean;
  lastTriggered?: string;
  executionCount: number;
};

export function createCapsReflexDefinition(
  input: Omit<CAPSReflexDefinition, "reflexId" | "executionCount"> &
    Partial<Pick<CAPSReflexDefinition, "reflexId" | "executionCount">>,
): CAPSReflexDefinition {
  return {
    reflexId: input.reflexId ?? randomUUID(),
    name: input.name,
    triggerGroup: input.triggerGroup,
    triggerEvent: input.triggerEvent,
    actionCode: input.actionCode,
    fallbackMessage: input.fallbackMessage,
    xpGate: input.xpGate,
    cooldownSeconds: input.cooldownSeconds,
    maxRetries: input.maxRetries,
    isActive: input.isActive,
    lastTriggered: input.lastTriggered,
    executionCount: input.executionCount ?? 0,
  };
}

export type RehydrationResult = {
  success: boolean;
  source: RehydrationSource;
  itemsRestored: number;
  durationMs: number;
  timestamp: string;
  errors: string[];
  metadata: Record<string, unknown>;
};

export type ContextNode = {
  nodeId: string;
  content: string;
  nodeType: "belief" | "emotion" | "fact" | "event" | "reflex";
  enumTags: string[];
  vectorEmbedding?: number[];
  connections: string[];
  weight: number;
  createdAt: string;
  lastAccessed?: string;
  accessCount: number;
};

export function createContextNode(
  input: Omit<ContextNode, "createdAt" | "connections" | "accessCount"> &
    Partial<Pick<ContextNode, "connections" | "accessCount" | "createdAt">>,
): ContextNode {
  return {
    nodeId: input.nodeId,
    content: input.content,
    nodeType: input.nodeType,
    enumTags: [...input.enumTags],
    vectorEmbedding: input.vectorEmbedding ? [...input.vectorEmbedding] : undefined,
    connections: [...(input.connections ?? [])],
    weight: input.weight,
    createdAt: input.createdAt ?? new Date().toISOString(),
    lastAccessed: input.lastAccessed,
    accessCount: input.accessCount ?? 0,
  };
}

export class CAPSLedger {
  ledgerPath: string;

  constructor(ledgerPath = join(".nexus_agent_data", "caps", "caps_ledger.jsonl")) {
    this.ledgerPath = ledgerPath;
  }

  append(entry: Record<string, unknown>): void {
    const directory = this.ledgerPath.split("/").slice(0, -1).join("/");
    if (directory && !existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
    });
    appendFileSync(this.ledgerPath, `${line}\n`, "utf8");
  }

  readAll(): Record<string, unknown>[] {
    if (!existsSync(this.ledgerPath)) {
      return [];
    }
    const raw = readFileSync(this.ledgerPath, "utf8");
    return raw
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return { line, error: "invalid_json" };
        }
      });
  }
}

export type RehydrationLoader = () =>
  | {
      itemsRestored: number;
      metadata?: Record<string, unknown>;
    }
  | Promise<{
      itemsRestored: number;
      metadata?: Record<string, unknown>;
    }>;

export class RehydrationEngine {
  private readonly loaders = new Map<RehydrationSource, RehydrationLoader>();

  registerSource(source: RehydrationSource, loader: RehydrationLoader): void {
    this.loaders.set(source, loader);
  }

  async rehydrate(source: RehydrationSource): Promise<RehydrationResult> {
    const startedAt = Date.now();
    const loader = this.loaders.get(source);
    if (!loader) {
      return {
        success: false,
        source,
        itemsRestored: 0,
        durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
        errors: [`No loader registered for ${source}`],
        metadata: {},
      };
    }
    try {
      const payload = await Promise.resolve(loader());
      return {
        success: true,
        source,
        itemsRestored: payload.itemsRestored,
        durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
        errors: [],
        metadata: { ...(payload.metadata ?? {}) },
      };
    } catch (error: unknown) {
      return {
        success: false,
        source,
        itemsRestored: 0,
        durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
        errors: [error instanceof Error ? error.message : "Unknown rehydration error"],
        metadata: {},
      };
    }
  }
}

export class ContextMappingEngine {
  strategy: ContextMappingStrategy;
  private readonly nodes = new Map<string, ContextNode>();

  constructor(strategy: ContextMappingStrategy = ContextMappingStrategy.GRAPH_BASED) {
    this.strategy = strategy;
  }

  addNode(node: ContextNode): void {
    this.nodes.set(node.nodeId, createContextNode(node));
  }

  connectNodes(sourceId: string, targetId: string): boolean {
    const source = this.nodes.get(sourceId);
    const target = this.nodes.get(targetId);
    if (!source || !target) {
      return false;
    }
    if (!source.connections.includes(targetId)) {
      source.connections.push(targetId);
    }
    if (!target.connections.includes(sourceId)) {
      target.connections.push(sourceId);
    }
    return true;
  }

  getNode(nodeId: string): ContextNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return undefined;
    }
    node.lastAccessed = new Date().toISOString();
    node.accessCount += 1;
    return createContextNode(node);
  }

  findRelatedNodes(nodeId: string, maxDepth = 2): ContextNode[] {
    if (!this.nodes.has(nodeId) || maxDepth < 1) {
      return [];
    }
    const visited = new Set<string>([nodeId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
    const related: ContextNode[] = [];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      if (current.depth >= maxDepth) {
        continue;
      }
      const node = this.nodes.get(current.id);
      if (!node) {
        continue;
      }
      for (const connectionId of node.connections) {
        if (visited.has(connectionId)) {
          continue;
        }
        const linkedNode = this.nodes.get(connectionId);
        if (!linkedNode) {
          continue;
        }
        visited.add(connectionId);
        related.push(createContextNode(linkedNode));
        queue.push({ id: connectionId, depth: current.depth + 1 });
      }
    }
    return related;
  }

  listNodes(): ContextNode[] {
    return [...this.nodes.values()].map((node) => createContextNode(node));
  }
}

export class ZUpIntegrationRuntime {
  readonly ledger: CAPSLedger;
  readonly rehydrationEngine: RehydrationEngine;
  readonly contextEngine: ContextMappingEngine;
  private readonly moduleMetadata = new Map<string, CAPSModuleMetadata>();
  private readonly reflexes = new Map<string, CAPSReflexDefinition>();

  constructor(options: {
    ledgerPath?: string;
    contextStrategy?: ContextMappingStrategy;
  } = {}) {
    this.ledger = new CAPSLedger(options.ledgerPath);
    this.rehydrationEngine = new RehydrationEngine();
    this.contextEngine = new ContextMappingEngine(
      options.contextStrategy ?? ContextMappingStrategy.HYBRID,
    );
  }

  registerModuleMetadata(metadata: CAPSModuleMetadata): void {
    this.moduleMetadata.set(metadata.fileName, { ...metadata });
    this.ledger.append({
      kind: "module_metadata",
      fileName: metadata.fileName,
      srsCode: metadata.srsCode,
      protocolVersion: metadata.protocolVersion,
      reflexTriggerGroup: metadata.reflexTriggerGroup,
    });
  }

  getModuleMetadata(fileName: string): CAPSModuleMetadata | undefined {
    const metadata = this.moduleMetadata.get(fileName);
    return metadata ? { ...metadata } : undefined;
  }

  registerReflex(reflex: CAPSReflexDefinition): void {
    this.reflexes.set(reflex.reflexId, { ...reflex });
    this.ledger.append({
      kind: "reflex_registered",
      reflexId: reflex.reflexId,
      triggerEvent: reflex.triggerEvent,
      triggerGroup: reflex.triggerGroup,
    });
  }

  getActiveReflexes(): CAPSReflexDefinition[] {
    return [...this.reflexes.values()]
      .filter((reflex) => reflex.isActive)
      .map((reflex) => ({ ...reflex }));
  }

  triggerReflex(
    triggerEvent: string,
    options: {
      currentXp: number;
    },
  ): { triggered: boolean; reflex?: CAPSReflexDefinition; message: string } {
    const now = Date.now();
    for (const reflex of this.reflexes.values()) {
      if (!reflex.isActive || reflex.triggerEvent !== triggerEvent) {
        continue;
      }
      if (options.currentXp < reflex.xpGate) {
        return {
          triggered: false,
          message: `XP gate not met for reflex '${reflex.name}'`,
        };
      }
      if (reflex.lastTriggered) {
        const elapsedMs = now - Date.parse(reflex.lastTriggered);
        if (elapsedMs < reflex.cooldownSeconds * 1000) {
          return {
            triggered: false,
            message: `Reflex '${reflex.name}' is in cooldown`,
          };
        }
      }
      reflex.executionCount += 1;
      reflex.lastTriggered = new Date(now).toISOString();
      this.ledger.append({
        kind: "reflex_triggered",
        reflexId: reflex.reflexId,
        triggerEvent,
        executionCount: reflex.executionCount,
      });
      return {
        triggered: true,
        reflex: { ...reflex },
        message: reflex.actionCode,
      };
    }
    return {
      triggered: false,
      message: `No active reflex for '${triggerEvent}'`,
    };
  }

  getStats(): Record<string, unknown> {
    return {
      moduleMetadataCount: this.moduleMetadata.size,
      reflexCount: this.reflexes.size,
      activeReflexCount: this.getActiveReflexes().length,
      contextNodeCount: this.contextEngine.listNodes().length,
      ledgerEntries: this.ledger.readAll().length,
    };
  }
}
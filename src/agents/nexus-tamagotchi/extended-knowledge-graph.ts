import { randomUUID } from "node:crypto";

export type KnowledgeEntityType =
  | "concept"
  | "person"
  | "place"
  | "thing"
  | "action"
  | "topic";

export type KnowledgeEntity = {
  id: string;
  name: string;
  entityType: KnowledgeEntityType;
  description: string;
  attributes: Record<string, unknown>;
  embedding?: number[];
  createdAt: string;
  updatedAt?: string;
  mentionCount: number;
  lastMentionedAt?: string;
  sourceInteractions: string[];
  confidence: number;
  metadata: Record<string, unknown>;
};

export type KnowledgeRelationship = {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  strength: number;
  bidirectional: boolean;
  description: string;
  evidence: string[];
  createdAt: string;
  confidence: number;
  metadata: Record<string, unknown>;
};

export type KnowledgeCluster = {
  id: string;
  name: string;
  description: string;
  entityIds: string[];
  centroid?: number[];
  coherenceScore: number;
  createdAt: string;
  representativeTerms: string[];
};

export type KnowledgeGraphSnapshot = {
  entities: KnowledgeEntity[];
  relationships: KnowledgeRelationship[];
  clusters: KnowledgeCluster[];
};

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

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  if (
    !value.every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    return undefined;
  }
  return [...value];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function createKnowledgeEntity(
  input: Partial<KnowledgeEntity> & { name: string },
): KnowledgeEntity {
  const now = new Date().toISOString();
  return {
    id: input.id ?? randomUUID(),
    name: input.name,
    entityType: (input.entityType ?? "concept") as KnowledgeEntityType,
    description: input.description ?? "",
    attributes: { ...(input.attributes ?? {}) },
    embedding: input.embedding ? [...input.embedding] : undefined,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt,
    mentionCount: input.mentionCount ?? 1,
    lastMentionedAt: input.lastMentionedAt ?? now,
    sourceInteractions: [...(input.sourceInteractions ?? [])],
    confidence: clamp01(input.confidence ?? 1),
    metadata: { ...(input.metadata ?? {}) },
  };
}

export function knowledgeEntityToDict(
  entity: KnowledgeEntity,
): Record<string, unknown> {
  return {
    id: entity.id,
    name: entity.name,
    entityType: entity.entityType,
    description: entity.description,
    attributes: { ...entity.attributes },
    embedding: entity.embedding ? [...entity.embedding] : undefined,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    mentionCount: entity.mentionCount,
    lastMentionedAt: entity.lastMentionedAt,
    sourceInteractions: [...entity.sourceInteractions],
    confidence: entity.confidence,
    metadata: { ...entity.metadata },
  };
}

export function knowledgeEntityFromDict(
  value: unknown,
): KnowledgeEntity | undefined {
  const record = parseRecord(value);
  const name = parseString(record.name, "");
  if (name.length === 0) {
    return undefined;
  }
  return createKnowledgeEntity({
    id: parseString(record.id, randomUUID()),
    name,
    entityType: parseString(
      record.entityType,
      "concept",
    ) as KnowledgeEntityType,
    description: parseString(record.description, ""),
    attributes: parseRecord(record.attributes),
    embedding: parseNumberArray(record.embedding),
    createdAt: parseString(record.createdAt, new Date().toISOString()),
    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : undefined,
    mentionCount: parseNumber(record.mentionCount, 1),
    lastMentionedAt:
      typeof record.lastMentionedAt === "string"
        ? record.lastMentionedAt
        : undefined,
    sourceInteractions: parseStringArray(record.sourceInteractions),
    confidence: parseNumber(record.confidence, 1),
    metadata: parseRecord(record.metadata),
  });
}

export class KnowledgeGraph {
  private readonly entities = new Map<string, KnowledgeEntity>();

  private readonly entitiesByName = new Map<string, string>();

  private readonly relationships = new Map<string, KnowledgeRelationship>();

  private readonly adjacency = new Map<string, Set<string>>();

  private readonly clusters = new Map<string, KnowledgeCluster>();

  upsertEntity(
    input: Partial<KnowledgeEntity> & { name: string },
  ): KnowledgeEntity {
    const key = input.name.trim().toLowerCase();
    const existingId = input.id ?? this.entitiesByName.get(key);
    if (!existingId || !this.entities.has(existingId)) {
      const entity = createKnowledgeEntity(input);
      this.entities.set(entity.id, entity);
      this.entitiesByName.set(entity.name.toLowerCase(), entity.id);
      return {
        ...entity,
        attributes: { ...entity.attributes },
        metadata: { ...entity.metadata },
      };
    }

    const existing = this.entities.get(existingId)!;
    const now = new Date().toISOString();
    const updated: KnowledgeEntity = {
      ...existing,
      name: input.name ?? existing.name,
      entityType:
        (input.entityType as KnowledgeEntityType) ?? existing.entityType,
      description: input.description ?? existing.description,
      attributes: {
        ...existing.attributes,
        ...(input.attributes ?? {}),
      },
      embedding: input.embedding ? [...input.embedding] : existing.embedding,
      updatedAt: now,
      mentionCount: existing.mentionCount + 1,
      lastMentionedAt: now,
      sourceInteractions: Array.from(
        new Set([
          ...(existing.sourceInteractions ?? []),
          ...(input.sourceInteractions ?? []),
        ]),
      ),
      confidence: clamp01(
        input.confidence !== undefined
          ? (existing.confidence + input.confidence) / 2
          : existing.confidence,
      ),
      metadata: {
        ...existing.metadata,
        ...(input.metadata ?? {}),
      },
    };
    this.entities.set(updated.id, updated);
    this.entitiesByName.set(updated.name.toLowerCase(), updated.id);
    return {
      ...updated,
      attributes: { ...updated.attributes },
      metadata: { ...updated.metadata },
    };
  }

  addRelationship(
    input: Omit<KnowledgeRelationship, "id" | "createdAt"> & {
      id?: string;
      createdAt?: string;
    },
  ): KnowledgeRelationship | undefined {
    if (
      !this.entities.has(input.sourceId) ||
      !this.entities.has(input.targetId)
    ) {
      return undefined;
    }
    const relationship: KnowledgeRelationship = {
      id: input.id ?? randomUUID(),
      sourceId: input.sourceId,
      targetId: input.targetId,
      relationshipType: input.relationshipType,
      strength: clamp01(input.strength),
      bidirectional: input.bidirectional,
      description: input.description,
      evidence: [...input.evidence],
      createdAt: input.createdAt ?? new Date().toISOString(),
      confidence: clamp01(input.confidence),
      metadata: { ...input.metadata },
    };
    this.relationships.set(relationship.id, relationship);
    this.linkAdjacency(relationship.sourceId, relationship.targetId);
    if (relationship.bidirectional) {
      this.linkAdjacency(relationship.targetId, relationship.sourceId);
    }
    return {
      ...relationship,
      evidence: [...relationship.evidence],
      metadata: { ...relationship.metadata },
    };
  }

  getEntity(entityId: string): KnowledgeEntity | undefined {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return undefined;
    }
    return {
      ...entity,
      attributes: { ...entity.attributes },
      embedding: entity.embedding ? [...entity.embedding] : undefined,
      sourceInteractions: [...entity.sourceInteractions],
      metadata: { ...entity.metadata },
    };
  }

  findEntitiesByName(query: string): KnowledgeEntity[] {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {
      return [];
    }
    const output: KnowledgeEntity[] = [];
    for (const entity of this.entities.values()) {
      if (!entity.name.toLowerCase().includes(normalized)) {
        continue;
      }
      output.push(this.getEntity(entity.id)!);
    }
    output.sort((left, right) => right.mentionCount - left.mentionCount);
    return output;
  }

  getNeighbors(entityId: string): KnowledgeEntity[] {
    const neighbors = this.adjacency.get(entityId);
    if (!neighbors) {
      return [];
    }
    const output: KnowledgeEntity[] = [];
    for (const neighborId of neighbors) {
      const entity = this.getEntity(neighborId);
      if (entity) {
        output.push(entity);
      }
    }
    return output;
  }

  createCluster(
    name: string,
    entityIds: string[],
    options: {
      description?: string;
      representativeTerms?: string[];
      coherenceScore?: number;
      centroid?: number[];
    } = {},
  ): KnowledgeCluster | undefined {
    if (entityIds.length === 0) {
      return undefined;
    }
    const validIds = entityIds.filter((id) => this.entities.has(id));
    if (validIds.length === 0) {
      return undefined;
    }
    const cluster: KnowledgeCluster = {
      id: randomUUID(),
      name,
      description: options.description ?? "",
      entityIds: [...new Set(validIds)],
      centroid: options.centroid ? [...options.centroid] : undefined,
      coherenceScore: clamp01(options.coherenceScore ?? 0),
      createdAt: new Date().toISOString(),
      representativeTerms: [...(options.representativeTerms ?? [])],
    };
    this.clusters.set(cluster.id, cluster);
    return {
      ...cluster,
      entityIds: [...cluster.entityIds],
      centroid: cluster.centroid ? [...cluster.centroid] : undefined,
      representativeTerms: [...cluster.representativeTerms],
    };
  }

  getCluster(clusterId: string): KnowledgeCluster | undefined {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      return undefined;
    }
    return {
      ...cluster,
      entityIds: [...cluster.entityIds],
      centroid: cluster.centroid ? [...cluster.centroid] : undefined,
      representativeTerms: [...cluster.representativeTerms],
    };
  }

  exportSnapshot(): KnowledgeGraphSnapshot {
    return {
      entities: Array.from(this.entities.values()).map(
        (entity) => this.getEntity(entity.id)!,
      ),
      relationships: Array.from(this.relationships.values()).map(
        (relationship) => ({
          ...relationship,
          evidence: [...relationship.evidence],
          metadata: { ...relationship.metadata },
        }),
      ),
      clusters: Array.from(this.clusters.values()).map(
        (cluster) => this.getCluster(cluster.id)!,
      ),
    };
  }

  private linkAdjacency(sourceId: string, targetId: string): void {
    const existing = this.adjacency.get(sourceId) ?? new Set<string>();
    existing.add(targetId);
    this.adjacency.set(sourceId, existing);
  }
}

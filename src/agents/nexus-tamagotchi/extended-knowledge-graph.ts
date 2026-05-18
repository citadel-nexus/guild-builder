import { randomUUID } from "node:crypto";

export type KnowledgeEntityType =
  | "concept"
  | "person"
  | "organization"
  | "place"
  | "thing"
  | "action"
  | "event"
  | "topic"
  | "skill"
  | "technology";

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

export type ConceptPath = {
  sourceId: string;
  targetId: string;
  pathNodes: string[];
  pathEdges: string[];
  totalDistance: number;
  relationshipTypes: string[];
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
  static readonly RELATIONSHIP_TYPES = [
    "related_to",
    "is_a",
    "has_a",
    "part_of",
    "causes",
    "caused_by",
    "similar_to",
    "opposite_of",
    "used_for",
    "created_by",
    "contains",
    "depends_on",
    "influences",
    "precedes",
    "follows",
  ] as const;

  static readonly ENTITY_TYPES: KnowledgeEntityType[] = [
    "concept",
    "person",
    "organization",
    "place",
    "thing",
    "action",
    "event",
    "topic",
    "skill",
    "technology",
  ];

  private readonly entities = new Map<string, KnowledgeEntity>();

  private readonly entitiesByName = new Map<string, string>();

  private readonly entitiesByType = new Map<KnowledgeEntityType, Set<string>>();

  private readonly relationships = new Map<string, KnowledgeRelationship>();

  private readonly relationshipsBySource = new Map<string, Set<string>>();

  private readonly relationshipsByTarget = new Map<string, Set<string>>();

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
      this.indexEntityType(entity.entityType, entity.id);
      return {
        ...entity,
        attributes: { ...entity.attributes },
        metadata: { ...entity.metadata },
      };
    }

    const existing = this.entities.get(existingId)!;
    const now = new Date().toISOString();
    const nextName = (input.name ?? existing.name).trim();
    const nextType =
      (input.entityType as KnowledgeEntityType | undefined) ??
      existing.entityType;

    const updated: KnowledgeEntity = {
      ...existing,
      name: nextName,
      entityType: nextType,
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
    if (existing.name.toLowerCase() !== updated.name.toLowerCase()) {
      this.entitiesByName.delete(existing.name.toLowerCase());
    }
    if (existing.entityType !== updated.entityType) {
      this.unindexEntityType(existing.entityType, existing.id);
      this.indexEntityType(updated.entityType, updated.id);
    }
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
    const existingRelationship = this.findRelationshipByEndpoints(
      input.sourceId,
      input.targetId,
      input.relationshipType,
    );
    if (existingRelationship) {
      const updated: KnowledgeRelationship = {
        ...existingRelationship,
        strength: clamp01(existingRelationship.strength + 0.1),
        confidence: clamp01(
          (existingRelationship.confidence + clamp01(input.confidence)) / 2,
        ),
        evidence: Array.from(
          new Set([...existingRelationship.evidence, ...input.evidence]),
        ),
        metadata: {
          ...existingRelationship.metadata,
          ...input.metadata,
        },
      };
      this.relationships.set(updated.id, updated);
      return {
        ...updated,
        evidence: [...updated.evidence],
        metadata: { ...updated.metadata },
      };
    }
    const relationship: KnowledgeRelationship = {
      id: input.id ?? randomUUID(),
      sourceId: input.sourceId,
      targetId: input.targetId,
      relationshipType: input.relationshipType || "related_to",
      strength: clamp01(input.strength),
      bidirectional: input.bidirectional,
      description: input.description,
      evidence: [...input.evidence],
      createdAt: input.createdAt ?? new Date().toISOString(),
      confidence: clamp01(input.confidence),
      metadata: { ...input.metadata },
    };
    this.relationships.set(relationship.id, relationship);
    this.indexRelationshipMap(
      this.relationshipsBySource,
      relationship.sourceId,
      relationship.id,
    );
    this.indexRelationshipMap(
      this.relationshipsByTarget,
      relationship.targetId,
      relationship.id,
    );
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

  addEntity(
    name: string,
    options: {
      entityType?: KnowledgeEntityType;
      description?: string;
      attributes?: Record<string, unknown>;
      sourceInteractionId?: string;
    } = {},
  ): KnowledgeEntity {
    return this.upsertEntity({
      name,
      entityType: options.entityType ?? "concept",
      description: options.description ?? "",
      attributes: options.attributes ?? {},
      sourceInteractions: options.sourceInteractionId
        ? [options.sourceInteractionId]
        : [],
    });
  }

  getEntityByName(name: string): KnowledgeEntity | undefined {
    const key = name.trim().toLowerCase();
    const entityId = this.entitiesByName.get(key);
    if (!entityId) {
      return undefined;
    }
    return this.getEntity(entityId);
  }

  getEntityById(entityId: string): KnowledgeEntity | undefined {
    return this.getEntity(entityId);
  }

  addRelationshipByName(
    sourceName: string,
    targetName: string,
    options: {
      relationshipType?: string;
      strength?: number;
      evidenceInteractionId?: string;
      description?: string;
      bidirectional?: boolean;
      confidence?: number;
      metadata?: Record<string, unknown>;
    } = {},
  ): KnowledgeRelationship | undefined {
    const source =
      this.getEntityByName(sourceName) ??
      this.addEntity(sourceName, { entityType: "concept" });
    const target =
      this.getEntityByName(targetName) ??
      this.addEntity(targetName, { entityType: "concept" });
    return this.addRelationship({
      sourceId: source.id,
      targetId: target.id,
      relationshipType: options.relationshipType ?? "related_to",
      strength: options.strength ?? 1,
      bidirectional: options.bidirectional ?? true,
      description: options.description ?? "",
      evidence: options.evidenceInteractionId
        ? [options.evidenceInteractionId]
        : [],
      confidence: options.confidence ?? 1,
      metadata: options.metadata ?? {},
    });
  }

  getEntitiesByType(entityType: KnowledgeEntityType): KnowledgeEntity[] {
    const entityIds = this.entitiesByType.get(entityType);
    if (!entityIds || entityIds.size === 0) {
      return [];
    }
    const output: KnowledgeEntity[] = [];
    for (const entityId of entityIds) {
      const entity = this.getEntity(entityId);
      if (entity) {
        output.push(entity);
      }
    }
    return output;
  }

  getRelationshipsForEntity(
    entityId: string,
    direction: "source" | "target" | "both" = "both",
  ): KnowledgeRelationship[] {
    const relationshipIds = new Set<string>();
    if (direction === "source" || direction === "both") {
      for (const relationshipId of this.relationshipsBySource.get(entityId) ?? []) {
        relationshipIds.add(relationshipId);
      }
    }
    if (direction === "target" || direction === "both") {
      for (const relationshipId of this.relationshipsByTarget.get(entityId) ?? []) {
        relationshipIds.add(relationshipId);
      }
    }
    const output: KnowledgeRelationship[] = [];
    for (const relationshipId of relationshipIds) {
      const relationship = this.relationships.get(relationshipId);
      if (!relationship) {
        continue;
      }
      output.push({
        ...relationship,
        evidence: [...relationship.evidence],
        metadata: { ...relationship.metadata },
      });
    }
    return output;
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

  findPath(
    sourceName: string,
    targetName: string,
    maxDepth = 5,
  ): ConceptPath | undefined {
    const source = this.getEntityByName(sourceName);
    const target = this.getEntityByName(targetName);
    if (!source || !target) {
      return undefined;
    }
    if (source.id === target.id) {
      return {
        sourceId: source.id,
        targetId: target.id,
        pathNodes: [source.id],
        pathEdges: [],
        totalDistance: 0,
        relationshipTypes: [],
      };
    }

    const visited = new Set<string>([source.id]);
    const queue: Array<{
      currentId: string;
      pathNodes: string[];
      pathEdges: string[];
      relationshipTypes: string[];
      totalDistance: number;
      depth: number;
    }> = [
      {
        currentId: source.id,
        pathNodes: [source.id],
        pathEdges: [],
        relationshipTypes: [],
        totalDistance: 0,
        depth: 0,
      },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      if (current.depth >= maxDepth) {
        continue;
      }

      for (const relationshipId of this.relationshipsBySource.get(current.currentId) ?? []) {
        const relationship = this.relationships.get(relationshipId);
        if (!relationship) {
          continue;
        }
        const neighborId = relationship.targetId;
        if (visited.has(neighborId)) {
          continue;
        }
        const next = {
          currentId: neighborId,
          pathNodes: [...current.pathNodes, neighborId],
          pathEdges: [...current.pathEdges, relationship.id],
          relationshipTypes: [
            ...current.relationshipTypes,
            relationship.relationshipType,
          ],
          totalDistance: current.totalDistance + (1 - relationship.strength),
          depth: current.depth + 1,
        };
        if (neighborId === target.id) {
          return {
            sourceId: source.id,
            targetId: target.id,
            pathNodes: next.pathNodes,
            pathEdges: next.pathEdges,
            relationshipTypes: next.relationshipTypes,
            totalDistance: next.totalDistance,
          };
        }
        visited.add(neighborId);
        queue.push(next);
      }

      for (const relationshipId of this.relationshipsByTarget.get(current.currentId) ?? []) {
        const relationship = this.relationships.get(relationshipId);
        if (!relationship || !relationship.bidirectional) {
          continue;
        }
        const neighborId = relationship.sourceId;
        if (visited.has(neighborId)) {
          continue;
        }
        const next = {
          currentId: neighborId,
          pathNodes: [...current.pathNodes, neighborId],
          pathEdges: [...current.pathEdges, relationship.id],
          relationshipTypes: [
            ...current.relationshipTypes,
            relationship.relationshipType,
          ],
          totalDistance: current.totalDistance + (1 - relationship.strength),
          depth: current.depth + 1,
        };
        if (neighborId === target.id) {
          return {
            sourceId: source.id,
            targetId: target.id,
            pathNodes: next.pathNodes,
            pathEdges: next.pathEdges,
            relationshipTypes: next.relationshipTypes,
            totalDistance: next.totalDistance,
          };
        }
        visited.add(neighborId);
        queue.push(next);
      }
    }

    return undefined;
  }

  getRelatedConcepts(
    entityName: string,
    maxDepth = 2,
    minStrength = 0.3,
  ): Array<[KnowledgeEntity, number]> {
    const entity = this.getEntityByName(entityName);
    if (!entity) {
      return [];
    }

    const visited = new Set<string>([entity.id]);
    const scores = new Map<string, number>();
    const queue: Array<{ entityId: string; score: number; depth: number }> = [
      { entityId: entity.id, score: 1, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      if (current.depth >= maxDepth) {
        continue;
      }

      const relationships = this.getRelationshipsForEntity(current.entityId, "both");
      for (const relationship of relationships) {
        const neighborId =
          relationship.sourceId === current.entityId
            ? relationship.targetId
            : relationship.sourceId;
        if (visited.has(neighborId)) {
          continue;
        }
        const nextScore = current.score * relationship.strength * 0.7;
        if (nextScore < minStrength) {
          continue;
        }
        const existingScore = scores.get(neighborId) ?? 0;
        if (nextScore > existingScore) {
          scores.set(neighborId, nextScore);
        }
        visited.add(neighborId);
        queue.push({
          entityId: neighborId,
          score: nextScore,
          depth: current.depth + 1,
        });
      }
    }

    const output: Array<[KnowledgeEntity, number]> = [];
    for (const [neighborId, score] of scores.entries()) {
      const relatedEntity = this.getEntity(neighborId);
      if (!relatedEntity) {
        continue;
      }
      output.push([relatedEntity, score]);
    }
    output.sort((left, right) => right[1] - left[1]);
    return output;
  }

  extractEntitiesFromText(text: string): KnowledgeEntity[] {
    const words = text.split(/\s+/);
    const output: KnowledgeEntity[] = [];
    const seen = new Set<string>();
    for (const [index, word] of words.entries()) {
      const cleaned = word.replace(/[.,!?'"()[\]{}:;]/g, "");
      if (cleaned.length < 3 || cleaned[0] !== cleaned[0].toUpperCase()) {
        continue;
      }
      if (index === 0 && cleaned.length <= 10) {
        continue;
      }
      const entity = this.addEntity(cleaned, { entityType: "concept" });
      if (!seen.has(entity.id)) {
        output.push(entity);
        seen.add(entity.id);
      }
    }
    return output;
  }

  getStats(): {
    totalEntities: number;
    totalRelationships: number;
    totalClusters: number;
    entityTypes: Record<KnowledgeEntityType, number>;
    relationshipTypes: Record<string, number>;
    avgRelationshipsPerEntity: number;
  } {
    const entityTypes = {} as Record<KnowledgeEntityType, number>;
    for (const entityType of KnowledgeGraph.ENTITY_TYPES) {
      entityTypes[entityType] = this.entitiesByType.get(entityType)?.size ?? 0;
    }
    const relationshipTypes: Record<string, number> = {};
    for (const relationship of this.relationships.values()) {
      const relationshipType = relationship.relationshipType;
      relationshipTypes[relationshipType] =
        (relationshipTypes[relationshipType] ?? 0) + 1;
    }
    return {
      totalEntities: this.entities.size,
      totalRelationships: this.relationships.size,
      totalClusters: this.clusters.size,
      entityTypes,
      relationshipTypes,
      avgRelationshipsPerEntity:
        this.relationships.size / Math.max(this.entities.size, 1),
    };
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

  private findRelationshipByEndpoints(
    sourceId: string,
    targetId: string,
    relationshipType: string,
  ): KnowledgeRelationship | undefined {
    for (const relationshipId of this.relationshipsBySource.get(sourceId) ?? []) {
      const relationship = this.relationships.get(relationshipId);
      if (!relationship) {
        continue;
      }
      if (
        relationship.targetId === targetId &&
        relationship.relationshipType === relationshipType
      ) {
        return relationship;
      }
    }
    return undefined;
  }

  private indexEntityType(entityType: KnowledgeEntityType, entityId: string): void {
    const existing = this.entitiesByType.get(entityType) ?? new Set<string>();
    existing.add(entityId);
    this.entitiesByType.set(entityType, existing);
  }

  private unindexEntityType(entityType: KnowledgeEntityType, entityId: string): void {
    const existing = this.entitiesByType.get(entityType);
    if (!existing) {
      return;
    }
    existing.delete(entityId);
    if (existing.size === 0) {
      this.entitiesByType.delete(entityType);
      return;
    }
    this.entitiesByType.set(entityType, existing);
  }

  private indexRelationshipMap(
    indexMap: Map<string, Set<string>>,
    key: string,
    relationshipId: string,
  ): void {
    const existing = indexMap.get(key) ?? new Set<string>();
    existing.add(relationshipId);
    indexMap.set(key, existing);
  }

  private linkAdjacency(sourceId: string, targetId: string): void {
    const existing = this.adjacency.get(sourceId) ?? new Set<string>();
    existing.add(targetId);
    this.adjacency.set(sourceId, existing);
  }
}

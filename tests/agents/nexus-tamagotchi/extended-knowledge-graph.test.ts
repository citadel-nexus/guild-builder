import { describe, expect, it } from "vitest";

import {
  KnowledgeGraph,
  createKnowledgeEntity,
  knowledgeEntityFromDict,
  knowledgeEntityToDict,
} from "../../../src/agents/nexus-tamagotchi/extended-knowledge-graph.js";

describe("extended-knowledge-graph", () => {
  it("creates entities and supports dictionary conversion", () => {
    const entity = createKnowledgeEntity({
      name: "canary rollout",
      entityType: "concept",
      confidence: 0.8,
    });
    const serialized = knowledgeEntityToDict(entity);
    const parsed = knowledgeEntityFromDict(serialized);

    expect(parsed).toBeDefined();
    expect(parsed?.name).toBe("canary rollout");
    expect(parsed?.confidence).toBeCloseTo(0.8);
  });

  it("builds relationships, neighbors, clusters, and snapshot", () => {
    const graph = new KnowledgeGraph();
    const deploy = graph.upsertEntity({
      name: "deployment",
      entityType: "topic",
    });
    const rollback = graph.upsertEntity({
      name: "rollback",
      entityType: "action",
    });
    const incident = graph.upsertEntity({
      name: "incident",
      entityType: "topic",
    });

    const relationship = graph.addRelationship({
      sourceId: deploy.id,
      targetId: rollback.id,
      relationshipType: "requires",
      strength: 0.9,
      bidirectional: false,
      description: "Deployments require rollback plans.",
      evidence: ["i-1"],
      confidence: 0.95,
      metadata: {},
    });
    expect(relationship).toBeDefined();

    const neighbors = graph.getNeighbors(deploy.id);
    expect(neighbors.some((node) => node.id === rollback.id)).toBe(true);

    const cluster = graph.createCluster("release-safety", [
      deploy.id,
      rollback.id,
      incident.id,
    ]);
    expect(cluster).toBeDefined();

    const snapshot = graph.exportSnapshot();
    expect(snapshot.entities.length).toBe(3);
    expect(snapshot.relationships.length).toBe(1);
    expect(snapshot.clusters.length).toBe(1);
  });
});

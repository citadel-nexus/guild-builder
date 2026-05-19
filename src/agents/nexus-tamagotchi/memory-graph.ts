import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { LongTermMemory } from "./long-term-memory.js";
import type { ShortTermMemoryBuffer } from "./short-term-memory.js";

type VectorMetadata = {
  id: string;
  domain: string;
  content: string;
  source: "ltm" | "stm";
  createdAt?: string;
};

function parseIsoAgeHours(timestamp?: string): number {
  if (!timestamp) {
    return 0;
  }
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, (Date.now() - parsed) / 3_600_000);
}

function normalize(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return values.map(() => 0);
  }
  return values.map((value) => ((value - min) / (max - min)) * 2 - 1);
}

function distance2d(
  left: { x: number; y: number },
  right: { x: number; y: number },
): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function tokenizeTheme(content: string): string[] {
  return content
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4)
    .slice(0, 8);
}

export type ClusterInfo = {
  clusterId: number;
  centroid2d: [number, number];
  memberCount: number;
  domain: string;
  themeKeywords: string[];
  avgAgeDays: number;
  representativeMemories: string[];
};

export type MemoryNode = {
  id: string;
  x: number;
  y: number;
  domain: string;
  contentPreview: string;
  ageHours: number;
  importance: number;
  connections: string[];
};

export type MemoryEdge = {
  sourceId: string;
  targetId: string;
  similarity: number;
  edgeType: "semantic" | "temporal" | "causal";
};

export type MemoryGraph = {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  clusters: ClusterInfo[];
  domainColors: Record<string, string>;
  timestamp: string;
};

export class MemoryGraphRenderer {
  static readonly DOMAIN_COLORS: Record<string, string> = {
    general: "#4A90D9",
    conversation: "#7B68EE",
    skills: "#20B2AA",
    facts: "#FFD700",
    user_preferences: "#FF69B4",
    emotional_patterns: "#FF6347",
  };

  constructor(
    readonly ltm: LongTermMemory,
    readonly stm?: ShortTermMemoryBuffer,
  ) {}

  projectTo2d(): {
    coords: Array<{ x: number; y: number }>;
    metadata: VectorMetadata[];
  } {
    const { vectors, metadata } = this.getAllVectorsWithMetadata();
    if (vectors.length === 0) {
      return { coords: [], metadata: [] };
    }

    const rawX = vectors.map((vector, index) => vector[0] ?? Math.sin(index));
    const rawY = vectors.map(
      (vector, index) => vector[1] ?? vector[0] ?? Math.cos(index),
    );
    const normalizedX = normalize(rawX);
    const normalizedY = normalize(rawY);
    const coords = normalizedX.map((x, index) => ({
      x,
      y: normalizedY[index],
    }));
    return { coords, metadata };
  }

  buildGraph(similarityThreshold: number = 0.5): MemoryGraph {
    const { coords, metadata } = this.projectTo2d();
    if (coords.length === 0) {
      return {
        nodes: [],
        edges: [],
        clusters: [],
        domainColors: { ...MemoryGraphRenderer.DOMAIN_COLORS },
        timestamp: new Date().toISOString(),
      };
    }

    const nodes: MemoryNode[] = coords.map((coord, index) => {
      const meta = metadata[index];
      const ageHours = parseIsoAgeHours(meta.createdAt);
      return {
        id: meta.id,
        x: coord.x,
        y: coord.y,
        domain: meta.domain,
        contentPreview: meta.content.slice(0, 80),
        ageHours,
        importance: 1 / (1 + ageHours / 24),
        connections: [],
      };
    });

    const edges: MemoryEdge[] = [];
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const dist = distance2d(nodes[left], nodes[right]);
        const similarity = 1 / (1 + dist);
        if (similarity < similarityThreshold) {
          continue;
        }
        edges.push({
          sourceId: nodes[left].id,
          targetId: nodes[right].id,
          similarity,
          edgeType: "semantic",
        });
        nodes[left].connections.push(nodes[right].id);
        nodes[right].connections.push(nodes[left].id);
      }
    }

    return {
      nodes,
      edges,
      clusters: this.identifyClusters(nodes, metadata),
      domainColors: { ...MemoryGraphRenderer.DOMAIN_COLORS },
      timestamp: new Date().toISOString(),
    };
  }

  renderToJson(outputPath?: string): string {
    const graph = this.buildGraph();
    const payload = {
      timestamp: graph.timestamp,
      domainColors: graph.domainColors,
      nodes: graph.nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        domain: node.domain,
        contentPreview: node.contentPreview,
        ageHours: node.ageHours,
        importance: node.importance,
        connections: [...node.connections],
      })),
      edges: graph.edges.map((edge) => ({
        source: edge.sourceId,
        target: edge.targetId,
        similarity: edge.similarity,
        type: edge.edgeType,
      })),
      clusters: graph.clusters.map((cluster) => ({
        id: cluster.clusterId,
        centroid: cluster.centroid2d,
        count: cluster.memberCount,
        domain: cluster.domain,
        keywords: [...cluster.themeKeywords],
        representatives: [...cluster.representativeMemories],
      })),
      stats: {
        totalNodes: graph.nodes.length,
        totalEdges: graph.edges.length,
        totalClusters: graph.clusters.length,
        domains: Array.from(new Set(graph.nodes.map((node) => node.domain))),
      },
    };
    const serialized = JSON.stringify(payload, null, 2);
    if (outputPath) {
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, serialized, "utf8");
    }
    return serialized;
  }

  renderToHtml(outputPath?: string): string {
    const graphJson = this.renderToJson();
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />

  <title>Brain Synapse Map</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #111827; color: #f3f4f6; margin: 0; }
    header { padding: 16px 24px; border-bottom: 1px solid #1f2937; }
    h1 { margin: 0; font-size: 1.25rem; letter-spacing: 0.04em; }
    #graph { width: 100vw; height: calc(100vh - 64px); display: grid; place-items: center; }

  <title>Nexus Memory Graph</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #111827; color: #f3f4f6; margin: 0; }
    #graph { width: 100vw; height: 100vh; display: grid; place-items: center; }

    pre { max-width: 90vw; max-height: 85vh; overflow: auto; background: #0b1220; padding: 16px; border-radius: 8px; border: 1px solid #1f2937; }
  </style>
</head>
<body>
  <header><h1>Brain Synapse Map</h1></header>
  <div id="graph"><pre id="payload"></pre></div>
  <script>
    const payload = ${graphJson};
    document.getElementById('payload').textContent = JSON.stringify(payload, null, 2);
  </script>
</body>
</html>`;
    if (outputPath) {
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, html, "utf8");
    }
    return html;
  }

  getGrowthStats(): Record<string, unknown> {
    const { metadata } = this.projectTo2d();
    const growthByDay: Record<string, number> = {};
    const domainDistribution: Record<string, number> = {};

    for (const item of metadata) {
      if (item.createdAt) {
        const parsed = Date.parse(item.createdAt);
        if (Number.isFinite(parsed)) {
          const day = new Date(parsed).toISOString().slice(0, 10);
          growthByDay[day] = (growthByDay[day] ?? 0) + 1;
        }
      }
      domainDistribution[item.domain] =
        (domainDistribution[item.domain] ?? 0) + 1;
    }

    const days = Object.keys(growthByDay).length;
    const totalMemories = metadata.length;
    return {
      totalMemories,
      growthByDay,
      domainDistribution,
      domains: Object.keys(domainDistribution),
      avgDailyGrowth: days === 0 ? totalMemories : totalMemories / days,
    };
  }

  private getAllVectorsWithMetadata(): {
    vectors: number[][];
    metadata: VectorMetadata[];
  } {
    const vectors: number[][] = [];
    const metadata: VectorMetadata[] = [];

    for (const [domain, index] of Object.entries(this.ltm.indexes)) {
      const records = index.getVectorRecords();
      for (const record of records) {
        const ltmEntry = this.ltm.entries[domain]?.[record.vectorId];
        vectors.push([...record.vector]);
        metadata.push({
          id: record.vectorId,
          domain,
          content: ltmEntry?.content ?? "",
          source: "ltm",
          createdAt: ltmEntry?.createdAt,
        });
      }
    }

    if (this.stm) {
      const stmEntries = this.stm.getRecent(1_000_000);
      for (const entry of stmEntries) {
        if (!entry.embedding) {
          continue;
        }
        vectors.push([...entry.embedding]);
        metadata.push({
          id: entry.id,
          domain: entry.context,
          content: entry.content,
          source: "stm",
          createdAt: entry.timestamp,
        });
      }
    }

    return { vectors, metadata };
  }

  private identifyClusters(
    nodes: MemoryNode[],
    metadata: VectorMetadata[],
  ): ClusterInfo[] {
    const grouped = new Map<
      string,
      Array<{ node: MemoryNode; meta: VectorMetadata }>
    >();
    for (let index = 0; index < nodes.length; index += 1) {
      const domain = nodes[index].domain;
      const group = grouped.get(domain) ?? [];
      group.push({ node: nodes[index], meta: metadata[index] });
      grouped.set(domain, group);
    }

    const clusters: ClusterInfo[] = [];
    let clusterId = 0;
    for (const [domain, members] of grouped.entries()) {
      const centroidX =
        members.reduce((sum, item) => sum + item.node.x, 0) / members.length;
      const centroidY =
        members.reduce((sum, item) => sum + item.node.y, 0) / members.length;
      const avgAgeDays =
        members.reduce((sum, item) => sum + item.node.ageHours, 0) /
        (members.length * 24);
      const representativeMemories = members
        .slice(0, 3)
        .map((item) => item.meta.content.slice(0, 60));
      const keywordFrequency = new Map<string, number>();
      for (const member of members) {
        for (const token of tokenizeTheme(member.meta.content)) {
          keywordFrequency.set(token, (keywordFrequency.get(token) ?? 0) + 1);
        }
      }
      const themeKeywords = Array.from(keywordFrequency.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([token]) => token);

      clusters.push({
        clusterId,
        centroid2d: [centroidX, centroidY],
        memberCount: members.length,
        domain,
        themeKeywords,
        avgAgeDays,
        representativeMemories,
      });
      clusterId += 1;
    }

    return clusters;
  }
}

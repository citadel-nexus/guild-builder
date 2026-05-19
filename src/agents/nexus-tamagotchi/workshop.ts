type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

export type WorkshopToolDefinition = {
  name: string;
  description: string;
  category: string;
  requires: string[];
  enabledByDefault: boolean;
  schema: Record<string, unknown>;
  handler?: ToolHandler;
};

export type WorkshopSyncResult = {
  success: boolean;
  itemsSynced: number;
  itemsFailed: number;
  errors: string[];
  syncTimestamp: string;
};

export type WorkshopTransport = {
  post: (
    path: string,
    body: Record<string, unknown>,
    headers?: Record<string, string>,
  ) => Promise<{
    ok: boolean;
    status: number;
    json?: Record<string, unknown>;
  }>;
};

type AgentWithWorkshopSurfaces = {
  agentId?: string;
  stm?: {
    search?: (
      query: string,
      topK?: number,
    ) => Promise<
      Array<{
        entry: { content: string; emotion: string };
        similarity: number;
      }>
    >;
  };
  ltm?: {
    retrieve?: (
      query: string,
      options?: { topK?: number; domain?: string },
    ) => Array<{
      entry: { content: string; domain: string };
      similarity: number;
    }>;
    entries?: Record<
      string,
      Record<
        string,
        {
          content: string;
          domain: string;
          createdAt: string;
          metadata: Record<string, unknown>;
        }
      >
    >;
  };
  selfAwareness?: {
    introspect?: () => {
      agentName: string;
      stmEntryCount: number;
      ltmTotalVectors: number;
      learningVelocity: number;
      currentEmotion: string;
      integrations: Record<string, { status: string }>;
    };
  };
  memoryRenderer?: {
    renderToJson?: (outputPath?: string) => string;
  };
  learningEngine?: {
    learn?: (
      content: string,
      context?: Record<string, unknown>,
      domain?: string,
    ) => {
      success: boolean;
      domain: string;
      entryId?: string;
    };
  };
};

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function parseRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export class WorkshopIntegration {
  static readonly DEFAULT_WORKSHOP_URL = "http://localhost:8000";

  readonly agent: AgentWithWorkshopSurfaces;

  readonly workshopUrl: string;

  readonly apiKey?: string;

  private readonly transport?: WorkshopTransport;

  private readonly registeredTools = new Map<string, WorkshopToolDefinition>();

  private readonly syncErrors: string[] = [];

  private lastSync?: string;

  constructor(
    agent: AgentWithWorkshopSurfaces,
    options: {
      workshopUrl?: string;
      apiKey?: string;
      transport?: WorkshopTransport;
    } = {},
  ) {
    this.agent = agent;
    this.workshopUrl =
      options.workshopUrl ?? WorkshopIntegration.DEFAULT_WORKSHOP_URL;
    this.apiKey = options.apiKey ?? process.env.CITADEL_WORKSHOP_API_KEY;
    this.transport = options.transport;
    this.registerDefaultTools();
  }

  registerTool(tool: WorkshopToolDefinition): void {
    this.registeredTools.set(tool.name, {
      ...tool,
      requires: [...tool.requires],
      schema: { ...tool.schema },
    });
  }

  getRegisteredTools(): Array<{
    name: string;
    description: string;
    category: string;
    schema: Record<string, unknown>;
  }> {
    return Array.from(this.registeredTools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      schema: { ...tool.schema },
    }));
  }

  async invokeTool(
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const tool = this.registeredTools.get(toolName);
    if (!tool) {
      return {
        error: `Tool not found: ${toolName}`,
      };
    }
    if (!tool.handler) {
      return {
        error: `Tool has no handler: ${toolName}`,
      };
    }
    return tool.handler(parseRecord(args));
  }

  async syncToWorkshop(
    options: {
      includeMemories?: boolean;
      includeLearnings?: boolean;
      includeBrainMap?: boolean;
    } = {},
  ): Promise<WorkshopSyncResult> {
    const includeMemories = options.includeMemories ?? true;
    const includeLearnings = options.includeLearnings ?? true;
    const includeBrainMap = options.includeBrainMap ?? true;
    const result: WorkshopSyncResult = {
      success: true,
      itemsSynced: 0,
      itemsFailed: 0,
      errors: [],
      syncTimestamp: new Date().toISOString(),
    };

    if (!this.transport) {
      result.success = false;
      result.errors.push("Workshop transport unavailable");
      this.pushSyncError("Workshop transport unavailable");
      return result;
    }

    const headers: Record<string, string> = this.apiKey
      ? { Authorization: `Bearer ${this.apiKey}` }
      : {};

    if (includeMemories && this.agent.ltm?.entries) {
      for (const [domain, domainEntries] of Object.entries(
        this.agent.ltm.entries,
      )) {
        for (const entry of Object.values(domainEntries)) {
          const response = await this.transport.post(
            "/api/v1/documents",
            {
              content: entry.content,
              metadata: {
                source: "nexus_agent",
                domain,
                agentId: this.agent.agentId ?? "",
              },
            },
            headers,
          );
          if (response.ok) {
            result.itemsSynced += 1;
          } else {
            result.itemsFailed += 1;
          }
        }
      }
    }

    if (includeLearnings && this.agent.learningEngine?.learn) {
      result.itemsSynced += 0;
    }

    if (includeBrainMap) {
      const brainMap = await this.handleBrainMap({});
      const brainMap = await this.handleBrainMap();
      if (!brainMap.error) {
        const response = await this.transport.post(
          "/api/v1/visualizations/brain-map",
          brainMap,
          headers,
        );
        if (response.ok) {
          result.itemsSynced += 1;
        } else {
          result.itemsFailed += 1;
          result.errors.push(
            `Brain map sync failed with status ${response.status}`,
          );
        }
      }
    }

    if (result.itemsFailed > 0 || result.errors.length > 0) {
      result.success = false;
      for (const error of result.errors) {
        this.pushSyncError(error);
      }
    }
    this.lastSync = result.syncTimestamp;
    return result;
  }

  async fetchFromWorkshop(
    query: string = "",
    limit: number = 10,
  ): Promise<Array<Record<string, unknown>>> {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    if (this.transport) {
      const headers: Record<string, string> = this.apiKey
        ? { Authorization: `Bearer ${this.apiKey}` }
        : {};
      const response = await this.transport.post(
        "/api/v1/search",
        {
          query,
          limit: normalizedLimit,
        },
        headers,
      );
      if (response.ok && Array.isArray(response.json?.results)) {
        return response.json?.results as Array<Record<string, unknown>>;
      }
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const fallback: Array<Record<string, unknown>> = [];
    for (const [domain, domainEntries] of Object.entries(
      this.agent.ltm?.entries ?? {},
    )) {
      for (const entry of Object.values(domainEntries)) {
        if (
          lowerQuery.length > 0 &&
          !entry.content.toLowerCase().includes(lowerQuery)
        ) {
          continue;
        }
        fallback.push({
          content: entry.content,
          metadata: {
            domain,
            source: "local-fallback",
          },
        });
        if (fallback.length >= normalizedLimit) {
          return fallback;
        }
      }
    }
    return fallback;
  }

  getSyncStatus(): Record<string, unknown> {
    return {
      connected: Boolean(this.apiKey),
      workshopUrl: this.workshopUrl,
      lastSync: this.lastSync ?? null,
      registeredTools: this.registeredTools.size,
      recentErrors: [...this.syncErrors.slice(-5)],
    };
  }

  private registerDefaultTools(): void {
    this.registerTool({
      name: "nexus_memory_search",
      description: "Search agent's STM/LTM memory surfaces",
      category: "memory",
      requires: [],
      enabledByDefault: true,
      schema: {
        type: "object",
        properties: {
          query: { type: "string" },
          topK: { type: "number" },
        },
        required: ["query"],
      },
      handler: async (args) => this.handleMemorySearch(args),
    });

    this.registerTool({
      name: "nexus_introspect",
      description: "Get agent self-awareness status snapshot",
      category: "awareness",
      requires: [],
      enabledByDefault: true,
      schema: {
        type: "object",
        properties: {},
      },
      handler: async () => this.handleIntrospect(),
    });

    this.registerTool({
      name: "nexus_brain_map",
      description: "Render memory graph data as JSON",
      category: "visualization",
      requires: [],
      enabledByDefault: true,
      schema: {
        type: "object",
        properties: {},
      },
      handler: async () => this.handleBrainMap(),
    });

    this.registerTool({
      name: "nexus_learn",
      description: "Learn and store domain knowledge",
      category: "learning",
      requires: [],
      enabledByDefault: true,
      schema: {
        type: "object",
        properties: {
          content: { type: "string" },
          domain: { type: "string" },
          context: { type: "object" },
        },
        required: ["content"],
      },
      handler: async (args) => this.handleLearn(args),
    });
  }

  private async handleMemorySearch(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const query = parseString(args.query, "");
    const topK = Math.max(1, Math.floor(parseNumber(args.topK, 5)));
    const results: Array<Record<string, unknown>> = [];

    if (query.length === 0) {
      return {
        results,
        count: 0,
      };
    }

    if (this.agent.stm?.search) {
      const stmResults = await this.agent.stm.search(query, topK);
      for (const result of stmResults) {
        results.push({
          source: "stm",
          content: result.entry.content,
          similarity: result.similarity,
          emotion: result.entry.emotion,
        });
      }
    }

    if (this.agent.ltm?.retrieve) {
      const ltmResults = this.agent.ltm.retrieve(query, { topK });
      for (const result of ltmResults) {
        results.push({
          source: "ltm",
          content: result.entry.content,
          similarity: result.similarity,
          domain: result.entry.domain,
        });
      }
    }

    return {
      results,
      count: results.length,
    };
  }

  private async handleIntrospect(): Promise<Record<string, unknown>> {
    const report = this.agent.selfAwareness?.introspect?.();
    if (!report) {
      return {
        error: "Self-awareness module not available",
      };
    }
    return {
      agentName: report.agentName,
      stmEntries: report.stmEntryCount,
      ltmEntries: report.ltmTotalVectors,
      learningVelocity: report.learningVelocity,
      emotion: report.currentEmotion,
      integrations: Object.fromEntries(
        Object.entries(report.integrations).map(([name, status]) => [
          name,
          status.status,
        ]),
      ),
    };
  }

  private async handleBrainMap(): Promise<Record<string, unknown>> {
    const graphJson = this.agent.memoryRenderer?.renderToJson?.();
    if (!graphJson) {
      return {
        error: "Memory renderer not available",
      };
    }
    try {
      return parseRecord(JSON.parse(graphJson));
    } catch {
      return {
        error: "Memory renderer returned invalid JSON",
      };
    }
  }

  private async handleLearn(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const content = parseString(args.content, "");
    const domain = parseString(args.domain, "");
    const context = parseRecord(args.context);
    if (content.length === 0) {
      return {
        error: "content is required",
      };
    }
    const result = this.agent.learningEngine?.learn?.(
      content,
      context,
      domain.length > 0 ? domain : undefined,
    );
    if (!result) {
      return {
        error: "Learning engine not available",
      };
    }
    return {
      success: result.success,
      domain: result.domain,
      entryId: result.entryId ?? null,
    };
  }

  private pushSyncError(error: string): void {
    this.syncErrors.push(error);
    if (this.syncErrors.length > 100) {
      this.syncErrors.splice(0, this.syncErrors.length - 100);
    }
  }
}

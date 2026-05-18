import { randomUUID } from "node:crypto";

export type UIConfig = {
  theme: "dark" | "light";
  primaryColor: string;
  secondaryColor: string;
  port: number;
  host: string;
  autoOpenBrowser: boolean;
  showReasoning: boolean;
  showToolCalls: boolean;
  maxMessageHistory: number;
  enableMarkdown: boolean;
  enableCodeHighlighting: boolean;
  windowTitle: string;
  fontFamily: string;
  fontSize: string;
};

export type UIMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "thinking";
  content: string;
  timestamp: string;
  isStreaming: boolean;
  toolCalls: Array<Record<string, unknown>>;
  reasoning?: string;
  metadata: Record<string, unknown>;
};

export type UIState = {
  connected: boolean;
  connectionId: string;
  messages: UIMessage[];
  isTyping: boolean;
  agentStatus: "ready" | "busy" | "error";
  settingsOpen: boolean;
  currentEmotion: string;
  xpTotal: number;
  rank: string;
};

export class ResponseLengthConfig {
  static readonly PRESETS: Record<
    string,
    {
      maxTokens: number;
      temperature: number;
      systemSuffix: string;
      description: string;
    }
  > = {
    concise: {
      maxTokens: 150,
      temperature: 0.7,
      systemSuffix: "Keep responses brief and to the point.",
      description: "Short, focused responses",
    },
    balanced: {
      maxTokens: 500,
      temperature: 0.8,
      systemSuffix: "",
      description: "Standard response length",
    },
    detailed: {
      maxTokens: 1500,
      temperature: 0.8,
      systemSuffix: "Provide thorough, detailed explanations.",
      description: "Comprehensive, detailed responses",
    },
    elongated: {
      maxTokens: 4000,
      temperature: 0.85,
      systemSuffix:
        "Provide extensive depth, examples, and broader implementation context.",
      description: "Extended, comprehensive responses",
    },
    maximum: {
      maxTokens: 8000,
      temperature: 0.9,
      systemSuffix:
        "Provide the most comprehensive response possible with full context.",
      description: "Maximum detail and coverage",
    },
  };

  private preset: string;

  private customMaxTokens?: number;

  private customSuffix?: string;

  constructor(preset: string = "balanced") {
    this.preset = ResponseLengthConfig.PRESETS[preset] ? preset : "balanced";
  }

  setPreset(preset: string): void {
    if (!ResponseLengthConfig.PRESETS[preset]) {
      return;
    }
    this.preset = preset;
    this.customMaxTokens = undefined;
    this.customSuffix = undefined;
  }

  setCustom(maxTokens: number, suffix: string = ""): void {
    this.preset = "custom";
    this.customMaxTokens = Math.max(1, Math.floor(maxTokens));
    this.customSuffix = suffix;
  }

  get maxTokens(): number {
    if (this.customMaxTokens !== undefined) {
      return this.customMaxTokens;
    }
    return ResponseLengthConfig.PRESETS[this.preset]?.maxTokens ?? 500;
  }

  get systemSuffix(): string {
    if (this.customSuffix !== undefined) {
      return this.customSuffix;
    }
    return ResponseLengthConfig.PRESETS[this.preset]?.systemSuffix ?? "";
  }

  get temperature(): number {
    return ResponseLengthConfig.PRESETS[this.preset]?.temperature ?? 0.8;
  }

  toDict(): Record<string, unknown> {
    return {
      preset: this.preset,
      maxTokens: this.maxTokens,
      systemSuffix: this.systemSuffix,
      temperature: this.temperature,
    };
  }
}

export const DEFAULT_UI_CONFIG: UIConfig = {
  theme: "dark",
  primaryColor: "#00d9ff",
  secondaryColor: "#7B68EE",
  port: 8765,
  host: "127.0.0.1",
  autoOpenBrowser: true,
  showReasoning: true,
  showToolCalls: true,
  maxMessageHistory: 100,
  enableMarkdown: true,
  enableCodeHighlighting: true,
  windowTitle: "Citadel Nexus Agent",
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: "14px",
};

export type AgentStatusSnapshot = {
  xp?: number;
  rank?: string;
  emotion?: string;
  memoryUsage?: number;
};

export type AgentInfoSnapshot = {
  agentName?: string;
  model?: string;
  xp?: number;
  tp?: number;
  rank?: string;
  interactions?: number;
  memories?: number;
};

export type AgentChatCapabilities = {
  agentName?: string;
  interact?: (input: string) => string | Promise<string>;
  generateResponseStreaming?: (
    input: string,
    context: string,
  ) => AsyncIterable<string>;
  getStatusSnapshot?: () => AgentStatusSnapshot;
  getInfoSnapshot?: () => AgentInfoSnapshot;
};

type UIIncomingMessage =
  | {
      type: "init";
      settings?: {
        responsePreset?: string;
      };
    }
  | {
      type: "message";
      content: string;
      settings?: {
        responsePreset?: string;
      };
      sessionId?: string;
    }
  | {
      type: "clear";
    }
  | {
      type: "status";
    }
  | {
      type: "info";
    };

export type UIServerMessage =
  | { type: "typing"; sessionId?: string }
  | {
      type: "response";
      sessionId?: string;
      content: string;
      reasoning?: string;
      toolCalls?: Array<Record<string, unknown>>;
    }
  | {
      type: "stream_token";
      sessionId: string;
      token: string;
    }
  | {
      type: "stream_complete";
      sessionId: string;
      fullResponse: string;
    }
  | {
      type: "status";
      xp: number;
      rank: string;
      emotion: string;
      memoryUsage: number;
    }
  | {
      type: "info";
      content: string;
    }
  | {
      type: "error";
      content: string;
    };

type ProcessedResponse = {
  content: string;
  reasoning?: string;
  toolCalls: Array<Record<string, unknown>>;
};

export class AgentChatServer {
  readonly agent: AgentChatCapabilities;

  readonly config: UIConfig;

  readonly responseConfig: ResponseLengthConfig;

  readonly state: UIState;

  private readonly messageHistory: UIMessage[] = [];

  constructor(
    agent: AgentChatCapabilities,
    config: Partial<UIConfig> = {},
    responseConfig: ResponseLengthConfig = new ResponseLengthConfig("balanced"),
  ) {
    this.agent = agent;
    this.config = { ...DEFAULT_UI_CONFIG, ...config };
    this.responseConfig = responseConfig;
    this.state = {
      connected: false,
      connectionId: "",
      messages: [],
      isTyping: false,
      agentStatus: "ready",
      settingsOpen: false,
      currentEmotion: "neutral",
      xpTotal: 0,
      rank: "INITIATE",
    };
  }

  generateHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${this.config.windowTitle}</title>
  </head>
  <body>
    <main>
      <h1>${this.agent.agentName ?? "Nexus Agent"}</h1>
      <p>UI endpoint initialized.</p>
      <p>WebSocket: ws://${this.config.host}:${this.config.port}/ws</p>
    </main>
  </body>
</html>`;
  }

  async handleMessage(payload: UIIncomingMessage): Promise<UIServerMessage[]> {
    switch (payload.type) {
      case "init": {
        if (payload.settings?.responsePreset) {
          this.responseConfig.setPreset(payload.settings.responsePreset);
        }
        this.state.connected = true;
        this.state.connectionId = randomUUID();
        return [this.getStatusMessage(), this.getInfoMessage()];
      }
      case "message": {
        if (payload.settings?.responsePreset) {
          this.responseConfig.setPreset(payload.settings.responsePreset);
        }
        const content = payload.content?.trim();
        if (!content) {
          return [{ type: "error", content: "Message content is required" }];
        }
        this.appendMessage("user", content);
        const response = await this.processMessage(content);
        this.appendMessage(
          "assistant",
          response.content,
          response.reasoning,
          response.toolCalls,
        );
        return [
          { type: "typing", sessionId: payload.sessionId },
          {
            type: "response",
            sessionId: payload.sessionId,
            content: response.content,
            reasoning: response.reasoning,
            toolCalls: response.toolCalls,
          },
          this.getStatusMessage(),
        ];
      }
      case "clear": {
        this.messageHistory.length = 0;
        this.state.messages = [];
        return [];
      }
      case "status": {
        return [this.getStatusMessage()];
      }
      case "info": {
        return [this.getInfoMessage()];
      }
      default: {
        return [{ type: "error", content: "Unsupported message type" }];
      }
    }
  }

  async *processMessageStreaming(
    userInput: string,
    sessionId: string = randomUUID(),
  ): AsyncGenerator<UIServerMessage> {
    const message = userInput.trim();
    if (!message) {
      yield { type: "error", content: "Message content is required" };
      return;
    }
    this.appendMessage("user", message);
    yield { type: "typing", sessionId };

    const stream = this.agent.generateResponseStreaming;
    if (!stream) {
      const response = await this.processMessage(message);
      this.appendMessage(
        "assistant",
        response.content,
        response.reasoning,
        response.toolCalls,
      );
      yield {
        type: "response",
        sessionId,
        content: response.content,
        reasoning: response.reasoning,
        toolCalls: response.toolCalls,
      };
      yield this.getStatusMessage();
      return;
    }

    const context = this.buildContextFromHistory(4);
    let fullResponse = "";
    for await (const token of stream(message, context)) {
      fullResponse += token;
      yield { type: "stream_token", sessionId, token };
    }

    const clipped = this.clipByTokenBudget(fullResponse);
    this.appendMessage("assistant", clipped, undefined, []);
    yield { type: "stream_complete", sessionId, fullResponse: clipped };
    yield this.getStatusMessage();
  }

  getStatusSnapshot(): AgentStatusSnapshot {
    if (this.agent.getStatusSnapshot) {
      return this.agent.getStatusSnapshot();
    }
    return {
      xp: this.state.xpTotal,
      rank: this.state.rank,
      emotion: this.state.currentEmotion,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  getInfoSnapshot(): AgentInfoSnapshot {
    if (this.agent.getInfoSnapshot) {
      return this.agent.getInfoSnapshot();
    }
    return {
      agentName: this.agent.agentName ?? "Nexus Agent",
      interactions: this.messageHistory.filter((m) => m.role === "user").length,
      memories: this.messageHistory.length,
      rank: this.state.rank,
      xp: this.state.xpTotal,
      tp: 0,
    };
  }

  start(): { host: string; port: number; html: string } {
    this.state.connected = true;
    this.state.connectionId = randomUUID();
    return {
      host: this.config.host,
      port: this.config.port,
      html: this.generateHtml(),
    };
  }

  launchUi(): { host: string; port: number; html: string } {
    return this.start();
  }

  private async processMessage(userInput: string): Promise<ProcessedResponse> {
    try {
      const handler = this.agent.interact;
      const raw = handler
        ? await handler(userInput)
        : "Agent interaction not available";
      const clipped = this.clipByTokenBudget(raw);
      return {
        content: clipped,
        reasoning: undefined,
        toolCalls: [],
      };
    } catch (error) {
      const content =
        error instanceof Error
          ? `Error processing message: ${error.message}`
          : "Error processing message";
      return {
        content,
        reasoning: undefined,
        toolCalls: [],
      };
    }
  }

  private appendMessage(
    role: UIMessage["role"],
    content: string,
    reasoning?: string,
    toolCalls: Array<Record<string, unknown>> = [],
  ): void {
    const message: UIMessage = {
      id: randomUUID(),
      role,
      content,
      timestamp: new Date().toISOString(),
      isStreaming: false,
      toolCalls,
      reasoning,
      metadata: {},
    };
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.config.maxMessageHistory) {
      this.messageHistory.splice(
        0,
        this.messageHistory.length - this.config.maxMessageHistory,
      );
    }
    this.state.messages = [...this.messageHistory];
  }

  private buildContextFromHistory(maxMessages: number): string {
    return this.messageHistory
      .slice(-Math.max(1, maxMessages))
      .map((message) => `${message.role}: ${message.content.slice(0, 200)}`)
      .join("\n");
  }

  private clipByTokenBudget(content: string): string {
    const budgetChars = this.responseConfig.maxTokens * 4;
    if (content.length <= budgetChars) {
      return content;
    }
    return `${content.slice(0, budgetChars)}...`;
  }

  private estimateMemoryUsage(): number {
    if (this.config.maxMessageHistory <= 0) {
      return 0;
    }
    return Math.min(
      100,
      Math.round(
        (this.messageHistory.length / this.config.maxMessageHistory) * 100,
      ),
    );
  }

  private getStatusMessage(): UIServerMessage {
    const snapshot = this.getStatusSnapshot();
    this.state.xpTotal = snapshot.xp ?? this.state.xpTotal;
    this.state.rank = snapshot.rank ?? this.state.rank;
    this.state.currentEmotion = snapshot.emotion ?? this.state.currentEmotion;
    return {
      type: "status",
      xp: snapshot.xp ?? this.state.xpTotal,
      rank: snapshot.rank ?? this.state.rank,
      emotion: snapshot.emotion ?? this.state.currentEmotion,
      memoryUsage: Math.max(
        0,
        Math.min(100, snapshot.memoryUsage ?? this.estimateMemoryUsage()),
      ),
    };
  }

  private getInfoMessage(): UIServerMessage {
    const info = this.getInfoSnapshot();
    const lines = [
      `Name: ${info.agentName ?? this.agent.agentName ?? "Nexus Agent"}`,
      `Model: ${info.model ?? "unknown"}`,
      `XP: ${info.xp ?? 0}`,
      `TP: ${info.tp ?? 0}`,
      `Rank: ${info.rank ?? this.state.rank}`,
      `Interactions: ${info.interactions ?? 0}`,
      `Memories: ${info.memories ?? this.messageHistory.length}`,
    ];
    return {
      type: "info",
      content: lines.join("\n"),
    };
  }
}

export function launchAgentUi(
  agent: AgentChatCapabilities,
  options: {
    port?: number;
    host?: string;
    autoOpen?: boolean;
    responsePreset?: string;
  } = {},
): AgentChatServer {
  const responseConfig = new ResponseLengthConfig(
    options.responsePreset ?? "balanced",
  );
  const server = new AgentChatServer(
    agent,
    {
      port: options.port ?? DEFAULT_UI_CONFIG.port,
      host: options.host ?? DEFAULT_UI_CONFIG.host,
      autoOpenBrowser: options.autoOpen ?? DEFAULT_UI_CONFIG.autoOpenBrowser,
    },
    responseConfig,
  );
  server.launchUi();
  return server;
}

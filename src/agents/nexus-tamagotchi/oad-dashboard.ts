import { createServer, type Server } from "node:http";

export enum OADTheme {
  CITADEL_DARK = "citadel_dark",
  CITADEL_LIGHT = "citadel_light",
  NEXUS_PURPLE = "nexus_purple",
  BROTHERHOOD_GOLD = "brotherhood_gold",
  MATRIX_GREEN = "matrix_green",
  CYBERPUNK = "cyberpunk",
}

export enum OADPanel {
  OVERVIEW = "overview",
  CHAT = "chat",
  MEMORY = "memory",
  PROFESSORS = "professors",
  MISSIONS = "missions",
  SKILLS = "skills",
  INTEGRATIONS = "integrations",
  ANALYTICS = "analytics",
  SETTINGS = "settings",
}

export type OADConfig = {
  host: string;
  port: number;
  autoOpenBrowser: boolean;
  theme: OADTheme;
  windowTitle: string;
  showAnimations: boolean;
  compactMode: boolean;
  defaultPanel: OADPanel;
  enabledPanels: OADPanel[];
  statsUpdateIntervalMs: number;
  memoryUpdateIntervalMs: number;
  integrationUpdateIntervalMs: number;
  enableVoiceInput: boolean;
  enableNotifications: boolean;
  enableSoundEffects: boolean;
  enableKeyboardShortcuts: boolean;
};

export const DEFAULT_OAD_CONFIG: OADConfig = {
  host: "127.0.0.1",
  port: 8888,
  autoOpenBrowser: false,
  theme: OADTheme.CITADEL_DARK,
  windowTitle: "Citadel OAD - Operator Access Dashboard",
  showAnimations: true,
  compactMode: false,
  defaultPanel: OADPanel.OVERVIEW,
  enabledPanels: Object.values(OADPanel),
  statsUpdateIntervalMs: 1000,
  memoryUpdateIntervalMs: 5000,
  integrationUpdateIntervalMs: 10_000,
  enableVoiceInput: false,
  enableNotifications: true,
  enableSoundEffects: false,
  enableKeyboardShortcuts: true,
};

export type OADState = {
  activePanel: OADPanel;
  isConnected: boolean;
  lastUpdate?: string;
  errorMessage?: string;
  notifications: Array<{
    type: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
    timestamp: string;
  }>;
  selectedMemoryDomain: string;
  selectedProfessor?: string;
  chatHistory: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
  }>;
};

type OADThemeDefinition = {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  warning: string;
  danger: string;
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  bgHover: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  gradientStart: string;
  gradientEnd: string;
};

export const OAD_THEMES: Record<OADTheme, OADThemeDefinition> = {
  [OADTheme.CITADEL_DARK]: {
    name: "Citadel Dark",
    primary: "#00d9ff",
    secondary: "#7b68ee",
    accent: "#4ade80",
    warning: "#fbbf24",
    danger: "#ef4444",
    bgPrimary: "#0a0a1a",
    bgSecondary: "#1a1a2e",
    bgCard: "#16213e",
    bgHover: "#1e3a5f",
    textPrimary: "#ffffff",
    textSecondary: "#a0a0b0",
    border: "#2a2a4a",
    gradientStart: "#00d9ff",
    gradientEnd: "#7b68ee",
  },
  [OADTheme.CITADEL_LIGHT]: {
    name: "Citadel Light",
    primary: "#00d9ff",
    secondary: "#7b68ee",
    accent: "#4ade80",
    warning: "#fbbf24",
    danger: "#ef4444",
    bgPrimary: "#f0f4f8",
    bgSecondary: "#e2e8f0",
    bgCard: "#ffffff",
    bgHover: "#edf2f7",
    textPrimary: "#1a202c",
    textSecondary: "#4a5568",
    border: "#cbd5e0",
    gradientStart: "#00d9ff",
    gradientEnd: "#7b68ee",
  },
  [OADTheme.NEXUS_PURPLE]: {
    name: "Nexus Purple",
    primary: "#a855f7",
    secondary: "#ec4899",
    accent: "#22d3ee",
    warning: "#f59e0b",
    danger: "#ef4444",
    bgPrimary: "#0f0a1a",
    bgSecondary: "#1a0f2e",
    bgCard: "#1e1030",
    bgHover: "#2d1a4a",
    textPrimary: "#ffffff",
    textSecondary: "#b8a0c0",
    border: "#3a2a5a",
    gradientStart: "#a855f7",
    gradientEnd: "#ec4899",
  },
  [OADTheme.BROTHERHOOD_GOLD]: {
    name: "Brotherhood Gold",
    primary: "#fbbf24",
    secondary: "#f59e0b",
    accent: "#22c55e",
    warning: "#fb923c",
    danger: "#dc2626",
    bgPrimary: "#0f0d0a",
    bgSecondary: "#1a1610",
    bgCard: "#242018",
    bgHover: "#302820",
    textPrimary: "#fef3c7",
    textSecondary: "#d4a574",
    border: "#4a3a2a",
    gradientStart: "#fbbf24",
    gradientEnd: "#f59e0b",
  },
  [OADTheme.MATRIX_GREEN]: {
    name: "Matrix Green",
    primary: "#22c55e",
    secondary: "#10b981",
    accent: "#06b6d4",
    warning: "#eab308",
    danger: "#ef4444",
    bgPrimary: "#000a00",
    bgSecondary: "#001a00",
    bgCard: "#002800",
    bgHover: "#003800",
    textPrimary: "#22c55e",
    textSecondary: "#15803d",
    border: "#166534",
    gradientStart: "#22c55e",
    gradientEnd: "#10b981",
  },
  [OADTheme.CYBERPUNK]: {
    name: "Cyberpunk",
    primary: "#f0f000",
    secondary: "#ff00ff",
    accent: "#00ffff",
    warning: "#ff6600",
    danger: "#ff0040",
    bgPrimary: "#0a0014",
    bgSecondary: "#140028",
    bgCard: "#1e0038",
    bgHover: "#280048",
    textPrimary: "#ffffff",
    textSecondary: "#c0a0e0",
    border: "#400070",
    gradientStart: "#f0f000",
    gradientEnd: "#ff00ff",
  },
};

type AgentBrotherhoodLike = {
  totalXp: number;
  totalTp: number;
  currentRank?: string;
  rank?: string;
  streakDays?: number;
};

type AgentVitalsLike = {
  interactionCount?: number;
  memoryCount?: number;
  emotionalState?: string;
};

type AgentStatusPayload = {
  xp: number;
  tp: number;
  rank: string;
  streak: number;
  interactions: number;
  memories: number;
  emotion: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function getBrotherhood(agent: unknown): AgentBrotherhoodLike | undefined {
  const record = asRecord(agent);
  const candidate = record.brotherhood;
  if (typeof candidate !== "object" || candidate === null) {
    return undefined;
  }
  const brotherhood = candidate as Record<string, unknown>;
  if (typeof brotherhood.totalXp !== "number" || typeof brotherhood.totalTp !== "number") {
    return undefined;
  }
  return {
    totalXp: brotherhood.totalXp,
    totalTp: brotherhood.totalTp,
    currentRank: typeof brotherhood.currentRank === "string" ? brotherhood.currentRank : undefined,
    rank: typeof brotherhood.rank === "string" ? brotherhood.rank : undefined,
    streakDays: typeof brotherhood.streakDays === "number" ? brotherhood.streakDays : undefined,
  };
}

function getVitals(agent: unknown): AgentVitalsLike | undefined {
  const record = asRecord(agent);
  const candidate = record.vitals;
  if (typeof candidate !== "object" || candidate === null) {
    return undefined;
  }
  const vitals = candidate as Record<string, unknown>;
  return {
    interactionCount:
      typeof vitals.interactionCount === "number" ? vitals.interactionCount : undefined,
    memoryCount: typeof vitals.memoryCount === "number" ? vitals.memoryCount : undefined,
    emotionalState:
      typeof vitals.emotionalState === "string" ? vitals.emotionalState : undefined,
  };
}

export class OADServer {
  agent: unknown;
  config: OADConfig;
  state: OADState;
  private server?: Server;

  constructor(agent: unknown, config: Partial<OADConfig> = {}) {
    this.agent = agent;
    this.config = { ...DEFAULT_OAD_CONFIG, ...config };
    this.state = {
      activePanel: this.config.defaultPanel,
      isConnected: false,
      notifications: [],
      selectedMemoryDomain: "all",
      chatHistory: [],
    };
  }

  getThemeCssVariables(): string {
    const theme = OAD_THEMES[this.config.theme] ?? OAD_THEMES[OADTheme.CITADEL_DARK];
    const entries = Object.entries(theme).filter(([key]) => key !== "name");
    return entries
      .map(([key, value]) => {
        const cssKey = key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
        return `--${cssKey}: ${value};`;
      })
      .join("\n");
  }

  buildStatusPayload(): AgentStatusPayload {
    const brotherhood = getBrotherhood(this.agent);
    const vitals = getVitals(this.agent);
    const root = asRecord(this.agent);
    const xpFromRoot = asNumber(root.totalXp, 0);
    const tpFromRoot = asNumber(root.totalTp, 0);
    return {
      xp: brotherhood?.totalXp ?? xpFromRoot,
      tp: brotherhood?.totalTp ?? tpFromRoot,
      rank: brotherhood?.currentRank ?? brotherhood?.rank ?? "INITIATE",
      streak: brotherhood?.streakDays ?? 0,
      interactions: vitals?.interactionCount ?? 0,
      memories: vitals?.memoryCount ?? 0,
      emotion: asString(vitals?.emotionalState, "neutral"),
    };
  }

  addNotification(
    type: "info" | "success" | "warning" | "error",
    title: string,
    message: string,
  ): void {
    this.state.notifications.push({
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
    });
    if (this.state.notifications.length > 50) {
      this.state.notifications = this.state.notifications.slice(-50);
    }
    this.state.lastUpdate = new Date().toISOString();
  }

  switchPanel(panel: OADPanel): void {
    if (!this.config.enabledPanels.includes(panel)) {
      return;
    }
    this.state.activePanel = panel;
    this.state.lastUpdate = new Date().toISOString();
  }

  generateDashboardHtml(): string {
    const status = this.buildStatusPayload();
    const themeCss = this.getThemeCssVariables();
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${this.config.windowTitle}</title>
  <style>
    :root {
      ${themeCss}
      --font-family: Inter, system-ui, sans-serif;
      --radius: 12px;
    }
    body {
      margin: 0;
      font-family: var(--font-family);
      color: var(--text-primary);
      background: var(--bg-primary);
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(90px, 1fr));
      gap: 12px;
      margin: 20px;
    }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px;
    }
    .label {
      color: var(--text-secondary);
      font-size: 12px;
      text-transform: uppercase;
    }
    .value {
      margin-top: 8px;
      font-size: 22px;
      font-weight: 700;
    }
    .panels {
      margin: 20px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .panel-pill {
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      font-size: 12px;
    }
    .active {
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      color: var(--bg-primary);
      border-color: transparent;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <strong>CITADEL OAD</strong>
      <div style="font-size:12px;color:var(--text-secondary)">Operator Access Dashboard</div>
    </div>
    <div style="font-size:12px;color:var(--text-secondary)">Theme: ${this.config.theme}</div>
  </header>
  <section class="stats">
    <div class="card"><div class="label">XP</div><div class="value">${status.xp.toLocaleString()}</div></div>
    <div class="card"><div class="label">TP</div><div class="value">${status.tp.toLocaleString()}</div></div>
    <div class="card"><div class="label">Rank</div><div class="value">${status.rank}</div></div>
    <div class="card"><div class="label">Interactions</div><div class="value">${status.interactions.toLocaleString()}</div></div>
  </section>
  <section class="panels">
    ${Object.values(OADPanel)
      .map((panel) => {
        const activeClass = panel === this.state.activePanel ? "panel-pill active" : "panel-pill";
        return `<span class="${activeClass}">${panel}</span>`;
      })
      .join("")}
  </section>
</body>
</html>`;
  }

  async start(): Promise<{ url: string }> {
    if (this.server) {
      return { url: `http://${this.config.host}:${this.config.port}` };
    }
    const html = this.generateDashboardHtml();
    this.server = createServer((request, response) => {
      if (!request.url || request.url === "/") {
        response.statusCode = 200;
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end(html);
        return;
      }
      if (request.url === "/status") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.end(
          JSON.stringify(
            {
              status: this.buildStatusPayload(),
              state: this.state,
            },
            null,
            2,
          ),
        );
        return;
      }
      response.statusCode = 404;
      response.end("not found");
    });
    await new Promise<void>((resolve, reject) => {
      const targetServer = this.server;
      if (!targetServer) {
        reject(new Error("server unavailable"));
        return;
      }
      targetServer.on("error", reject);
      targetServer.listen(this.config.port, this.config.host, () => {
        targetServer.off("error", reject);
        this.state.isConnected = true;
        this.state.lastUpdate = new Date().toISOString();
        resolve();
      });
    });
    return { url: `http://${this.config.host}:${this.config.port}` };
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const targetServer = this.server;
      if (!targetServer) {
        resolve();
        return;
      }
      targetServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    this.server = undefined;
    this.state.isConnected = false;
    this.state.lastUpdate = new Date().toISOString();
  }
}

export async function launchOAD(
  agent: unknown,
  options: {
    port?: number;
    autoOpen?: boolean;
    theme?: OADTheme;
  } = {},
): Promise<OADServer> {
  const server = new OADServer(agent, {
    port: options.port ?? DEFAULT_OAD_CONFIG.port,
    autoOpenBrowser: options.autoOpen ?? false,
    theme: options.theme ?? DEFAULT_OAD_CONFIG.theme,
  });
  await server.start();
  return server;
}
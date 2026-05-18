import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export type AgentConfiguration = {
  agentId: string;
  agentName: string;
  agentVersion: string;
  model: string;
  temperature: number;
  maxTokens: number;
  responsePreset: string;
  enableCouncil: boolean;
  enableGamification: boolean;
  enableProfessors: boolean;
  enableAuditTrail: boolean;
  enableCognitive: boolean;
  enableUi: boolean;
  stmMaxEntries: number;
  ltmEnabled: boolean;
  memoryConsolidationThreshold: number;
  uiPort: number;
  uiHost: string;
  uiAutoOpen: boolean;
  uiTheme: "dark" | "light";
  supabaseEnabled: boolean;
  datadogEnabled: boolean;
  posthogEnabled: boolean;
  slackEnabled: boolean;
  discordEnabled: boolean;
  trackInteractions: boolean;
  trackXp: boolean;
  trackMemory: boolean;
  automationEnabled: boolean;
  autoConsolidate: boolean;
  autoSync: boolean;
  dataDir: string;
  autoSave: boolean;
  saveIntervalSeconds: number;
};

export const DEFAULT_AGENT_CONFIGURATION: AgentConfiguration = {
  agentId: randomUUID(),
  agentName: "Aurora",
  agentVersion: "5.0.0",
  model: "gpt-4o-mini",
  temperature: 0.8,
  maxTokens: 4000,
  responsePreset: "balanced",
  enableCouncil: true,
  enableGamification: true,
  enableProfessors: true,
  enableAuditTrail: true,
  enableCognitive: true,
  enableUi: false,
  stmMaxEntries: 1000,
  ltmEnabled: true,
  memoryConsolidationThreshold: 0.7,
  uiPort: 8765,
  uiHost: "127.0.0.1",
  uiAutoOpen: true,
  uiTheme: "dark",
  supabaseEnabled: true,
  datadogEnabled: true,
  posthogEnabled: true,
  slackEnabled: true,
  discordEnabled: true,
  trackInteractions: true,
  trackXp: true,
  trackMemory: true,
  automationEnabled: true,
  autoConsolidate: true,
  autoSync: true,
  dataDir: join(process.cwd(), ".nexus_cache"),
  autoSave: true,
  saveIntervalSeconds: 60,
};

function parseRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeConfig(
  input: Partial<AgentConfiguration>,
  defaults: AgentConfiguration,
): AgentConfiguration {
  return {
    agentId: parseString(input.agentId, defaults.agentId),
    agentName: parseString(input.agentName, defaults.agentName),
    agentVersion: parseString(input.agentVersion, defaults.agentVersion),
    model: parseString(input.model, defaults.model),
    temperature: parseNumber(input.temperature, defaults.temperature),
    maxTokens: parseNumber(input.maxTokens, defaults.maxTokens),
    responsePreset: parseString(input.responsePreset, defaults.responsePreset),
    enableCouncil: parseBoolean(input.enableCouncil, defaults.enableCouncil),
    enableGamification: parseBoolean(
      input.enableGamification,
      defaults.enableGamification,
    ),
    enableProfessors: parseBoolean(
      input.enableProfessors,
      defaults.enableProfessors,
    ),
    enableAuditTrail: parseBoolean(
      input.enableAuditTrail,
      defaults.enableAuditTrail,
    ),
    enableCognitive: parseBoolean(input.enableCognitive, defaults.enableCognitive),
    enableUi: parseBoolean(input.enableUi, defaults.enableUi),
    stmMaxEntries: parseNumber(input.stmMaxEntries, defaults.stmMaxEntries),
    ltmEnabled: parseBoolean(input.ltmEnabled, defaults.ltmEnabled),
    memoryConsolidationThreshold: parseNumber(
      input.memoryConsolidationThreshold,
      defaults.memoryConsolidationThreshold,
    ),
    uiPort: parseNumber(input.uiPort, defaults.uiPort),
    uiHost: parseString(input.uiHost, defaults.uiHost),
    uiAutoOpen: parseBoolean(input.uiAutoOpen, defaults.uiAutoOpen),
    uiTheme:
      parseString(input.uiTheme, defaults.uiTheme) === "light" ? "light" : "dark",
    supabaseEnabled: parseBoolean(
      input.supabaseEnabled,
      defaults.supabaseEnabled,
    ),
    datadogEnabled: parseBoolean(input.datadogEnabled, defaults.datadogEnabled),
    posthogEnabled: parseBoolean(input.posthogEnabled, defaults.posthogEnabled),
    slackEnabled: parseBoolean(input.slackEnabled, defaults.slackEnabled),
    discordEnabled: parseBoolean(input.discordEnabled, defaults.discordEnabled),
    trackInteractions: parseBoolean(
      input.trackInteractions,
      defaults.trackInteractions,
    ),
    trackXp: parseBoolean(input.trackXp, defaults.trackXp),
    trackMemory: parseBoolean(input.trackMemory, defaults.trackMemory),
    automationEnabled: parseBoolean(
      input.automationEnabled,
      defaults.automationEnabled,
    ),
    autoConsolidate: parseBoolean(input.autoConsolidate, defaults.autoConsolidate),
    autoSync: parseBoolean(input.autoSync, defaults.autoSync),
    dataDir: parseString(input.dataDir, defaults.dataDir),
    autoSave: parseBoolean(input.autoSave, defaults.autoSave),
    saveIntervalSeconds: parseNumber(
      input.saveIntervalSeconds,
      defaults.saveIntervalSeconds,
    ),
  };
}

function envBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }
  if (["true", "1", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }
  return undefined;
}

function envNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function configurationFromDict(
  value: unknown,
  defaults: AgentConfiguration = DEFAULT_AGENT_CONFIGURATION,
): AgentConfiguration {
  return normalizeConfig(parseRecord(value), defaults);
}

export function configurationFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  defaults: AgentConfiguration = DEFAULT_AGENT_CONFIGURATION,
): AgentConfiguration {
  const partial: Partial<AgentConfiguration> = {};
  if (env.NEXUS_AGENT_ID) partial.agentId = env.NEXUS_AGENT_ID;
  if (env.NEXUS_AGENT_NAME) partial.agentName = env.NEXUS_AGENT_NAME;
  if (env.NEXUS_MODEL) partial.model = env.NEXUS_MODEL;
  if (env.NEXUS_TEMPERATURE) {
    const value = envNumber(env.NEXUS_TEMPERATURE);
    if (value !== undefined) partial.temperature = value;
  }
  if (env.NEXUS_MAX_TOKENS) {
    const value = envNumber(env.NEXUS_MAX_TOKENS);
    if (value !== undefined) partial.maxTokens = value;
  }
  if (env.NEXUS_RESPONSE_PRESET) partial.responsePreset = env.NEXUS_RESPONSE_PRESET;
  if (env.NEXUS_UI_PORT) {
    const value = envNumber(env.NEXUS_UI_PORT);
    if (value !== undefined) partial.uiPort = value;
  }
  if (env.NEXUS_UI_HOST) partial.uiHost = env.NEXUS_UI_HOST;
  if (env.NEXUS_DATA_DIR) partial.dataDir = env.NEXUS_DATA_DIR;
  if (env.NEXUS_ENABLE_UI) {
    const value = envBoolean(env.NEXUS_ENABLE_UI);
    if (value !== undefined) partial.enableUi = value;
  }
  return normalizeConfig(partial, defaults);
}

export type ConfigurationManagerOptions = {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
  defaults?: AgentConfiguration;
};

export class ConfigurationManager {
  private readonly configPath: string;

  private readonly env: NodeJS.ProcessEnv;

  private readonly defaults: AgentConfiguration;

  private config: AgentConfiguration;

  private loaded = false;

  constructor(options: ConfigurationManagerOptions = {}) {
    this.defaults = options.defaults
      ? normalizeConfig(options.defaults, DEFAULT_AGENT_CONFIGURATION)
      : { ...DEFAULT_AGENT_CONFIGURATION };
    this.config = { ...this.defaults };
    this.configPath =
      options.configPath ??
      join(this.defaults.dataDir, "config", "nexus-agent-config.json");
    this.env = options.env ?? process.env;
  }

  load(): AgentConfiguration {
    this.config = { ...this.defaults };
    if (existsSync(this.configPath)) {
      try {
        const raw = readFileSync(this.configPath, "utf8");
        this.config = configurationFromDict(JSON.parse(raw), this.config);
      } catch {
        this.config = { ...this.defaults };
      }
    }
    this.config = configurationFromEnv(this.env, this.config);
    this.loaded = true;
    return { ...this.config };
  }

  save(): void {
    mkdirSync(dirname(this.configPath), { recursive: true });
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf8");
  }

  get(): AgentConfiguration {
    if (!this.loaded) {
      return this.load();
    }
    return { ...this.config };
  }

  set<Key extends keyof AgentConfiguration>(
    key: Key,
    value: AgentConfiguration[Key],
  ): void {
    this.config[key] = value;
    this.save();
  }

  resetToDefaults(): void {
    this.config = { ...this.defaults };
    this.save();
  }
}

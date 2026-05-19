import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

type RequiredFileConfig = {
  template: string;
  required: boolean;
};

export type AutoInstallationResult = {
  timestamp: string;
  modulesMissingRequired: string[];
  modulesMissingOptional: string[];
  filesCreated: string[];
  directoriesCreated: string[];
  errors: string[];
  warnings: string[];
  status: "success" | "partial";
  xpAwarded?: number;
  tpAwarded?: number;
};

const REQUIRED_MODULES = ["nats"];
const OPTIONAL_MODULES = ["posthog", "datadog", "slack_sdk", "notion-client"];

const REQUIRED_DIRECTORIES = [
  ".nexus_agent_data",
  ".nexus_cache",
  ".nexus_sanctum",
  ".nexus_sanctum/snapshots",
  "logs",
];

const REQUIRED_FILES: Record<string, RequiredFileConfig> = {
  ".nexus_agent_data/config.yaml": {
    template: [
      "# Nexus Agent Configuration",
      "agent:",
      '  name: "Aurora"',
      '  model: "gpt-3.5-turbo"',
      "  enable_council: true",
      "  enable_gamification: true",
      "paths:",
      '  state_dir: ".nexus_agent_data"',
      '  cache_dir: ".nexus_cache"',
      '  sanctum_dir: ".nexus_sanctum"',
      `created_at: "{date}"`,
      "",
    ].join("\n"),
    required: true,
  },
  ".nexus_sanctum/memory_index.json": {
    template: `{"version":"1.0.0","created_at":"{date}","memories":[]}`,
    required: true,
  },
  ".nexus_agent_data/brotherhood_state.json": {
    template:
      '{"version":"1.0.0","created_at":"{date}","total_xp":0,"total_tp":0,"rank":"INITIATE"}',
    required: true,
  },
  ".nexus_agent_data/tracked_skills.json": {
    template: '{"skills":[],"updated_at":"{date}"}',
    required: false,
  },
};

const requireResolver = createRequire(import.meta.url);

function isModuleAvailable(moduleName: string): boolean {
  try {
    requireResolver.resolve(moduleName);
    return true;
  } catch {
    return false;
  }
}

function replaceDateToken(template: string): string {
  return template.replace("{date}", new Date().toISOString());
}

export class AutoInstallationSystem {
  readonly installationLog: AutoInstallationResult[] = [];

  constructor(private readonly basePath: string = process.cwd()) {}

  runFullInstallationCheck(): AutoInstallationResult {
    const result: AutoInstallationResult = {
      timestamp: new Date().toISOString(),
      modulesMissingRequired: [],
      modulesMissingOptional: [],
      filesCreated: [],
      directoriesCreated: [],
      errors: [],
      warnings: [],
      status: "success",
    };

    result.directoriesCreated = this.ensureDirectories();

    const missingModules = this.getMissingDependencies();
    result.modulesMissingRequired = missingModules.modulesRequired;
    result.modulesMissingOptional = missingModules.modulesOptional;
    if (missingModules.modulesRequired.length > 0) {
      result.status = "partial";
      result.errors.push(
        `Missing required modules: ${missingModules.modulesRequired.join(", ")}`,
      );
    }
    if (missingModules.modulesOptional.length > 0) {
      result.warnings.push(
        `Optional modules missing: ${missingModules.modulesOptional.join(", ")}`,
      );
    }

    result.filesCreated = this.scaffoldMissingFiles();
    const validationErrors = this.validate();
    if (validationErrors.length > 0) {
      result.status = "partial";
      result.errors.push(...validationErrors);
    }

    if (result.status === "success") {
      result.xpAwarded = 25 + result.filesCreated.length * 5;
      result.tpAwarded = 10 + result.filesCreated.length * 2;
    }

    this.logToLedger(result);
    this.installationLog.push(result);
    return result;
  }

  getMissingDependencies(): {
    modulesRequired: string[];
    modulesOptional: string[];
    files: string[];
  } {
    const modulesRequired = REQUIRED_MODULES.filter(
      (moduleName) => !isModuleAvailable(moduleName),
    );
    const modulesOptional = OPTIONAL_MODULES.filter(
      (moduleName) => !isModuleAvailable(moduleName),
    );
    const files = Object.entries(REQUIRED_FILES)
      .filter(
        ([relativePath, config]) =>
          config.required && !existsSync(this.resolve(relativePath)),
      )
      .map(([relativePath]) => relativePath);
    return {
      modulesRequired,
      modulesOptional,
      files,
    };
  }

  scaffoldSingleFile(relativePath: string, template: string): boolean {
    const fullPath = this.resolve(relativePath);
    if (existsSync(fullPath)) {
      return false;
    }

    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, replaceDateToken(template), "utf8");
    return true;
  }

  static getIntegrationStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const moduleName of OPTIONAL_MODULES) {
      status[moduleName] = isModuleAvailable(moduleName);
    }
    return status;
  }

  private ensureDirectories(): string[] {
    const created: string[] = [];
    for (const directory of REQUIRED_DIRECTORIES) {
      const fullPath = this.resolve(directory);
      if (existsSync(fullPath)) {
        continue;
      }
      mkdirSync(fullPath, { recursive: true });
      created.push(directory);
    }
    return created;
  }

  private scaffoldMissingFiles(): string[] {
    const created: string[] = [];
    for (const [relativePath, config] of Object.entries(REQUIRED_FILES)) {
      const fullPath = this.resolve(relativePath);
      if (existsSync(fullPath)) {
        continue;
      }
      if (!config.required && config.template.length === 0) {
        continue;
      }
      mkdirSync(join(fullPath, ".."), { recursive: true });
      writeFileSync(fullPath, replaceDateToken(config.template), "utf8");
      created.push(relativePath);
    }
    return created;
  }

  private validate(): string[] {
    const errors: string[] = [];
    for (const directory of REQUIRED_DIRECTORIES.slice(0, 3)) {
      if (!existsSync(this.resolve(directory))) {
        errors.push(`Missing required directory: ${directory}`);
      }
    }
    for (const [relativePath, config] of Object.entries(REQUIRED_FILES)) {
      if (!config.required) {
        continue;
      }
      if (!existsSync(this.resolve(relativePath))) {
        errors.push(`Missing required file: ${relativePath}`);
      }
    }
    return errors;
  }

  private logToLedger(result: AutoInstallationResult): void {
    const ledgerPath = this.resolve(
      "LEDGER/AUTHORITY_AUDIT/installation_events.jsonl",
    );
    mkdirSync(join(ledgerPath, ".."), { recursive: true });
    const ledgerEntry = JSON.stringify({
      timestamp: result.timestamp,
      eventType: "AUTO_INSTALLATION",
      status: result.status,
      directoriesCreated: result.directoriesCreated.length,
      filesCreated: result.filesCreated.length,
      errorsCount: result.errors.length,
      xpAwarded: result.xpAwarded ?? 0,
      tpAwarded: result.tpAwarded ?? 0,
    });
    appendFileSync(ledgerPath, `${ledgerEntry}\n`, "utf8");
  }

  private resolve(relativePath: string): string {
    return join(this.basePath, relativePath);
  }
}

let autoInstaller: AutoInstallationSystem | undefined;

export function getAutoInstaller(basePath?: string): AutoInstallationSystem {
  if (!autoInstaller) {
    autoInstaller = new AutoInstallationSystem(basePath);
  }
  return autoInstaller;
}

export function ensureAgentEnvironment(
  basePath?: string,
): AutoInstallationResult {
  return getAutoInstaller(basePath).runFullInstallationCheck();
}

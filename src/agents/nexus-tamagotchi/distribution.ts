import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type DistributionMode =
  | 'install'
  | 'run'
  | 'service'
  | 'uninstall'
  | 'status'
  | 'preflight';

export type ServiceConfig = {
  serviceName: string;
  displayName: string;
  description: string;
  workingDir: string;
  runtimePath: string;
  agentName: string;
  model: string;
  autoStart: boolean;
  restartOnFailure: boolean;
};

export type PlatformServiceMethod = 'systemd' | 'launchd' | 'task_scheduler' | 'unknown';

export type PlatformInfo = {
  system: string;
  release: string;
  machine: string;
  serviceMethod: PlatformServiceMethod;
  servicePath: string;
};

export type DistributionActionResult = {
  success: boolean;
  mode: DistributionMode;
  message: string;
  platform: PlatformInfo;
  plannedFiles: string[];
  commands: string[];
};

export type DistributionStatus = {
  installed: boolean;
  running: boolean;
  platform: PlatformInfo;
};

function detectSystem(): string {
  if (process.platform === 'win32') {
    return 'Windows';
  }
  if (process.platform === 'darwin') {
    return 'Darwin';
  }
  if (process.platform === 'linux') {
    return 'Linux';
  }
  return process.platform;
}

function detectServiceMethod(system: string): PlatformServiceMethod {
  if (system === 'Linux') {
    return 'systemd';
  }
  if (system === 'Darwin') {
    return 'launchd';
  }
  if (system === 'Windows') {
    return 'task_scheduler';
  }
  return 'unknown';
}

function defaultServiceConfig(basePath: string): ServiceConfig {
  return {
    serviceName: 'citadel-nexus-agent',
    displayName: 'Citadel Nexus Agent',
    description: 'AI companion with gamification and governance',
    workingDir: basePath,
    runtimePath: process.execPath,
    agentName: 'Aurora',
    model: 'gpt-3.5-turbo',
    autoStart: true,
    restartOnFailure: true,
  };
}

export class DistributionFramework {
  readonly config: ServiceConfig;
  readonly basePath: string;
  readonly system: string;

  constructor(
    config: Partial<ServiceConfig> = {},
    options: {
      basePath?: string;
    } = {},
  ) {
    this.basePath = options.basePath ?? process.cwd();
    this.system = detectSystem();
    this.config = {
      ...defaultServiceConfig(this.basePath),
      ...config,
    };
  }

  detectPlatform(): PlatformInfo {
    const serviceMethod = detectServiceMethod(this.system);
    return {
      system: this.system,
      release: process.release.name,
      machine: process.arch,
      serviceMethod,
      servicePath: this.getManagedServicePath(),
    };
  }

  runPreflight(checker?: () => boolean): boolean {
    if (!checker) {
      return true;
    }
    try {
      return checker();
    } catch {
      return false;
    }
  }

  install(options: { runPreflight?: boolean; checker?: () => boolean } = {}): DistributionActionResult {
    const shouldRunPreflight = options.runPreflight ?? true;
    if (shouldRunPreflight && !this.runPreflight(options.checker)) {
      return {
        success: false,
        mode: 'install',
        message: 'Preflight failed',
        platform: this.detectPlatform(),
        plannedFiles: [],
        commands: [],
      };
    }

    const plannedFiles = this.writeManagedServiceFiles();
    const commands = this.getInstallCommands();
    return {
      success: true,
      mode: 'install',
      message: 'Service files planned in managed workspace path',
      platform: this.detectPlatform(),
      plannedFiles,
      commands,
    };
  }

  uninstall(): DistributionActionResult {
    const serviceDir = this.getServiceWorkspaceDir();
    if (existsSync(serviceDir)) {
      rmSync(serviceDir, { recursive: true, force: true });
    }
    return {
      success: true,
      mode: 'uninstall',
      message: 'Managed service files removed',
      platform: this.detectPlatform(),
      plannedFiles: [],
      commands: this.getUninstallCommands(),
    };
  }

  status(): DistributionStatus {
    const servicePath = this.getManagedServicePath();
    return {
      installed: existsSync(servicePath),
      running: false,
      platform: this.detectPlatform(),
    };
  }

  buildSystemdTemplate(scriptPath: string): string {
    const restart = this.config.restartOnFailure ? 'on-failure' : 'no';
    return [
      '[Unit]',
      `Description=${this.config.displayName}`,
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      `WorkingDirectory=${this.config.workingDir}`,
      `ExecStart=${this.config.runtimePath} ${scriptPath} --name ${this.config.agentName} --model ${this.config.model} --service`,
      `Restart=${restart}`,
      'RestartSec=10',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      '',
    ].join('\n');
  }

  buildLaunchAgentTemplate(scriptPath: string): string {
    const runAtLoad = this.config.autoStart ? 'true' : 'false';
    const keepAlive = this.config.restartOnFailure ? 'true' : 'false';
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      '  <key>Label</key>',
      `  <string>${this.config.serviceName}</string>`,
      '  <key>ProgramArguments</key>',
      '  <array>',
      `    <string>${this.config.runtimePath}</string>`,
      `    <string>${scriptPath}</string>`,
      '    <string>--name</string>',
      `    <string>${this.config.agentName}</string>`,
      '    <string>--model</string>',
      `    <string>${this.config.model}</string>`,
      '    <string>--service</string>',
      '  </array>',
      '  <key>WorkingDirectory</key>',
      `  <string>${this.config.workingDir}</string>`,
      '  <key>RunAtLoad</key>',
      `  <${runAtLoad}/>`,
      '  <key>KeepAlive</key>',
      `  <${keepAlive}/>`,
      '</dict>',
      '</plist>',
      '',
    ].join('\n');
  }

  private getServiceWorkspaceDir(): string {
    return join(this.basePath, '.nexus_services');
  }

  private getManagedServicePath(): string {
    const dir = this.getServiceWorkspaceDir();
    const method = detectServiceMethod(this.system);
    if (method === 'systemd') {
      return join(dir, `${this.config.serviceName}.service`);
    }
    if (method === 'launchd') {
      return join(dir, `${this.config.serviceName}.plist`);
    }
    if (method === 'task_scheduler') {
      return join(dir, `${this.config.serviceName}.task.json`);
    }
    return join(dir, `${this.config.serviceName}.unknown`);
  }

  private writeManagedServiceFiles(): string[] {
    const directory = this.getServiceWorkspaceDir();
    mkdirSync(directory, { recursive: true });
    const servicePath = this.getManagedServicePath();
    const scriptPath = join(this.config.workingDir, 'nexus-agent.js');
    const method = detectServiceMethod(this.system);

    if (method === 'systemd') {
      writeFileSync(servicePath, this.buildSystemdTemplate(scriptPath), 'utf8');
      return [servicePath];
    }

    if (method === 'launchd') {
      writeFileSync(servicePath, this.buildLaunchAgentTemplate(scriptPath), 'utf8');
      return [servicePath];
    }

    if (method === 'task_scheduler') {
      const task = {
        serviceName: this.config.serviceName,
        runtimePath: this.config.runtimePath,
        scriptPath,
        agentName: this.config.agentName,
        model: this.config.model,
        workingDir: this.config.workingDir,
        autoStart: this.config.autoStart,
      };
      writeFileSync(servicePath, JSON.stringify(task, null, 2), 'utf8');
      return [servicePath];
    }

    writeFileSync(servicePath, 'unsupported platform', 'utf8');
    return [servicePath];
  }

  private getInstallCommands(): string[] {
    const method = detectServiceMethod(this.system);
    if (method === 'systemd') {
      return [
        `sudo cp ${this.getManagedServicePath()} /etc/systemd/system/${this.config.serviceName}.service`,
        'sudo systemctl daemon-reload',
        `sudo systemctl enable ${this.config.serviceName}`,
        `sudo systemctl start ${this.config.serviceName}`,
      ];
    }
    if (method === 'launchd') {
      return [
        `cp ${this.getManagedServicePath()} ~/Library/LaunchAgents/${this.config.serviceName}.plist`,
        `launchctl load ~/Library/LaunchAgents/${this.config.serviceName}.plist`,
      ];
    }
    if (method === 'task_scheduler') {
      return [
        `schtasks /Create /TN ${this.config.serviceName} /XML ${this.getManagedServicePath()} /F`,
      ];
    }
    return ['No install commands available for this platform'];
  }

  private getUninstallCommands(): string[] {
    const method = detectServiceMethod(this.system);
    if (method === 'systemd') {
      return [
        `sudo systemctl stop ${this.config.serviceName}`,
        `sudo systemctl disable ${this.config.serviceName}`,
        `sudo rm /etc/systemd/system/${this.config.serviceName}.service`,
      ];
    }
    if (method === 'launchd') {
      return [
        `launchctl unload ~/Library/LaunchAgents/${this.config.serviceName}.plist`,
        `rm ~/Library/LaunchAgents/${this.config.serviceName}.plist`,
      ];
    }
    if (method === 'task_scheduler') {
      return [`schtasks /Delete /TN ${this.config.serviceName} /F`];
    }
    return ['No uninstall commands available for this platform'];
  }
}

export const DISTRO = new DistributionFramework();

export function readManagedServiceFile(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  return readFileSync(path, 'utf8');
}
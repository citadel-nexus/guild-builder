import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';

type SupportedService = {
  envVar: string;
  displayName: string;
  required: boolean;
  category: 'llm' | 'storage' | 'integration' | 'billing' | 'analytics' | 'monitoring';
};

type StoredKeyRecord = {
  iv: string;
  authTag: string;
  ciphertext: string;
  updatedAt: string;
};

type KeyStatus = {
  configured: boolean;
  source: 'env' | 'vault' | 'none';
  validationStatus?: 'unchecked' | 'valid' | 'invalid';
  updatedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseStoredKeyRecord(value: unknown): StoredKeyRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    typeof value.iv !== 'string' ||
    typeof value.authTag !== 'string' ||
    typeof value.ciphertext !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return undefined;
  }
  return {
    iv: value.iv,
    authTag: value.authTag,
    ciphertext: value.ciphertext,
    updatedAt: value.updatedAt,
  };
}

export class SecureKeyVault {
  static readonly SUPPORTED_SERVICES: Record<string, SupportedService> = {
    openai: {
      envVar: 'OPENAI_API_KEY',
      displayName: 'OpenAI',
      required: true,
      category: 'llm',
    },
    anthropic: {
      envVar: 'ANTHROPIC_API_KEY',
      displayName: 'Anthropic',
      required: false,
      category: 'llm',
    },
    supabase_url: {
      envVar: 'SUPABASE_URL',
      displayName: 'Supabase URL',
      required: false,
      category: 'storage',
    },
    supabase_key: {
      envVar: 'SUPABASE_SERVICE_ROLE_KEY',
      displayName: 'Supabase Service Key',
      required: false,
      category: 'storage',
    },
    slack: {
      envVar: 'SLACK_BOT_TOKEN',
      displayName: 'Slack Bot',
      required: false,
      category: 'integration',
    },
    discord: {
      envVar: 'DISCORD_BOT_TOKEN',
      displayName: 'Discord Bot',
      required: false,
      category: 'integration',
    },
    stripe: {
      envVar: 'STRIPE_SECRET_KEY',
      displayName: 'Stripe',
      required: false,
      category: 'billing',
    },
    posthog: {
      envVar: 'POSTHOG_API_KEY',
      displayName: 'PostHog',
      required: false,
      category: 'analytics',
    },
    datadog: {
      envVar: 'DD_API_KEY',
      displayName: 'Datadog',
      required: false,
      category: 'monitoring',
    },
    linear: {
      envVar: 'LINEAR_API_KEY',
      displayName: 'Linear',
      required: false,
      category: 'integration',
    },
    notion: {
      envVar: 'NOTION_TOKEN',
      displayName: 'Notion',
      required: false,
      category: 'integration',
    },
    gitlab: {
      envVar: 'GITLAB_TOKEN',
      displayName: 'GitLab',
      required: false,
      category: 'integration',
    },
    github: {
      envVar: 'GITHUB_TOKEN',
      displayName: 'GitHub',
      required: false,
      category: 'integration',
    },
    intercom: {
      envVar: 'INTERCOM_ACCESS_TOKEN',
      displayName: 'Intercom',
      required: false,
      category: 'integration',
    },
  };

  private readonly vaultDir: string;
  private readonly encryptionKey: Buffer;
  private readonly keyStatus: Record<string, KeyStatus> = {};

  constructor(options: {
    vaultDir?: string;
    agentId?: string;
    env?: NodeJS.ProcessEnv;
  } = {}) {
    const agentId = options.agentId ?? 'default';
    this.vaultDir = options.vaultDir ?? join('.nexus_sanctum', 'vault');
    mkdirSync(this.vaultDir, { recursive: true });
    this.encryptionKey = this.deriveKey(agentId);
    this.loadFromEnvironment(options.env ?? process.env);
    this.loadFromVault();
  }

  setKey(service: string, value: string): boolean {
    if (!SecureKeyVault.SUPPORTED_SERVICES[service] || value.trim().length === 0) {
      return false;
    }
    const encrypted = this.encrypt(value);
    const path = this.pathFor(service);
    writeFileSync(path, JSON.stringify(encrypted), 'utf8');
    this.keyStatus[service] = {
      configured: true,
      source: 'vault',
      validationStatus: 'unchecked',
      updatedAt: encrypted.updatedAt,
    };
    return true;
  }

  storeKey(service: string, value: string): {
    success: boolean;
    message: string;
    status: 'stored' | 'error';
    maskedKey?: string;
  } {
    const success = this.setKey(service, value);
    if (!success) {
      return {
        success: false,
        message: `Unable to store key for ${service}`,
        status: 'error',
      };
    }
    const metadata = SecureKeyVault.SUPPORTED_SERVICES[service];
    if (metadata) {
      process.env[metadata.envVar] = value;
    }
    return {
      success: true,
      message: `Key stored for ${service}`,
      status: 'stored',
      maskedKey: this.getMaskedKey(service),
    };
  }

  getKey(service: string): string | undefined {
    if (!SecureKeyVault.SUPPORTED_SERVICES[service]) {
      return undefined;
    }

    const serviceInfo = SecureKeyVault.SUPPORTED_SERVICES[service];
    const envValue = process.env[serviceInfo.envVar];
    if (envValue && envValue.trim().length > 0) {
      this.keyStatus[service] = {
        configured: true,
        source: 'env',
        validationStatus: 'unchecked',
      };
      return envValue.trim();
    }

    const path = this.pathFor(service);
    if (!existsSync(path)) {
      return undefined;
    }
    try {
      const content = readFileSync(path, 'utf8');
      const parsed = parseStoredKeyRecord(JSON.parse(content));
      if (!parsed) {
        return undefined;
      }
      const value = this.decrypt(parsed);
      this.keyStatus[service] = {
        configured: true,
        source: 'vault',
        validationStatus: this.keyStatus[service]?.validationStatus ?? 'unchecked',
        updatedAt: parsed.updatedAt,
      };
      return value;
    } catch {
      return undefined;
    }
  }

  getMaskedKey(service: string): string | undefined {
    const value = this.getKey(service);
    if (!value || value.length < 8) {
      return undefined;
    }
    const prefix = value.slice(0, 4);
    const suffix = value.slice(-4);
    return `${prefix}...${suffix}`;
  }

  getStatus(): Record<string, KeyStatus> {
    const output: Record<string, KeyStatus> = {};
    for (const service of Object.keys(SecureKeyVault.SUPPORTED_SERVICES)) {
      const status = this.keyStatus[service];
      output[service] = status
        ? { ...status }
        : {
            configured: false,
            source: 'none',
          };
    }
    return output;
  }

  getMissingRequiredServices(): string[] {
    const missing: string[] = [];
    for (const [service, metadata] of Object.entries(SecureKeyVault.SUPPORTED_SERVICES)) {
      if (!metadata.required) {
        continue;
      }
      const key = this.getKey(service);
      if (!key) {
        missing.push(service);
      }
    }
    return missing;
  }

  validateKey(service: string): {
    success: boolean;
    status: 'valid' | 'invalid' | 'not_found';
    message: string;
  } {
    const value = this.getKey(service);
    if (!value) {
      return {
        success: false,
        status: 'not_found',
        message: 'Key not found',
      };
    }
    const valid = value.trim().length >= 12;
    this.keyStatus[service] = {
      ...(this.keyStatus[service] ?? { configured: true, source: 'vault' }),
      validationStatus: valid ? 'valid' : 'invalid',
    };
    return {
      success: valid,
      status: valid ? 'valid' : 'invalid',
      message: valid ? 'Key format looks valid' : 'Key format is too short',
    };
  }

  validateAll(): Record<
    string,
    {
      success: boolean;
      status: 'valid' | 'invalid' | 'not_found';
      message: string;
    }
  > {
    const output: Record<
      string,
      {
        success: boolean;
        status: 'valid' | 'invalid' | 'not_found';
        message: string;
      }
    > = {};
    for (const service of Object.keys(SecureKeyVault.SUPPORTED_SERVICES)) {
      output[service] = this.validateKey(service);
    }
    return output;
  }

  getAllStatus(): Record<
    string,
    {
      source: 'env' | 'vault' | 'none';
      status: 'missing' | 'unchecked' | 'valid' | 'invalid';
      displayName: string;
      category: SupportedService['category'];
      required: boolean;
      maskedKey?: string;
    }
  > {
    const output: Record<
      string,
      {
        source: 'env' | 'vault' | 'none';
        status: 'missing' | 'unchecked' | 'valid' | 'invalid';
        displayName: string;
        category: SupportedService['category'];
        required: boolean;
        maskedKey?: string;
      }
    > = {};

    for (const [service, metadata] of Object.entries(
      SecureKeyVault.SUPPORTED_SERVICES,
    )) {
      const status = this.keyStatus[service];
      if (!status || !status.configured) {
        output[service] = {
          source: 'none',
          status: 'missing',
          displayName: metadata.displayName,
          category: metadata.category,
          required: metadata.required,
        };
        continue;
      }

      output[service] = {
        source: status.source,
        status: status.validationStatus ?? 'unchecked',
        displayName: metadata.displayName,
        category: metadata.category,
        required: metadata.required,
        maskedKey: this.getMaskedKey(service),
      };
    }

    return output;
  }

  getContextSummary(): string {
    const status = this.getAllStatus();
    const lines: string[] = ['API Key Status:'];
    const categories = new Map<SupportedService['category'], string[]>();
    for (const [service, entry] of Object.entries(status)) {
      const current = categories.get(entry.category) ?? [];
      const icon =
        entry.status === 'valid'
          ? '✓'
          : entry.status === 'unchecked'
            ? '○'
            : entry.status === 'invalid'
              ? '✗'
              : '—';
      current.push(
        `${icon} ${entry.displayName} (${service}): ${entry.status}`,
      );
      categories.set(entry.category, current);
    }

    for (const [category, items] of categories.entries()) {
      lines.push(``);
      lines.push(`${category.toUpperCase()}:`);
      lines.push(...items.map((item) => `  ${item}`));
    }
    return lines.join('\n');
  }

  promptForKey(service: string): string {
    const metadata = SecureKeyVault.SUPPORTED_SERVICES[service];
    if (!metadata) {
      return `Unknown service: ${service}`;
    }
    return [
      `To enable ${metadata.displayName}, provide an API key.`,
      `Environment variable: ${metadata.envVar}`,
      `You can set it via secure runtime configuration.`,
    ].join('\n');
  }

  removeKey(service: string): { success: boolean; message: string } {
    const metadata = SecureKeyVault.SUPPORTED_SERVICES[service];
    if (!metadata) {
      return {
        success: false,
        message: `Unknown service: ${service}`,
      };
    }

    const path = this.pathFor(service);
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch {
        writeFileSync(path, '', 'utf8');
      }
    }
    delete this.keyStatus[service];
    delete process.env[metadata.envVar];
    return {
      success: true,
      message: `Removed key for ${service}`,
    };
  }

  private deriveKey(agentId: string): Buffer {
    const material = `${hostname()}:${agentId}:nexus-vault`;
    const digest = createHash('sha256').update(material).digest();
    return digest.subarray(0, 32);
  }

  private encrypt(plainText: string): StoredKeyRecord {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      updatedAt: new Date().toISOString(),
    };
  }

  private decrypt(record: StoredKeyRecord): string {
    const iv = Buffer.from(record.iv, 'base64');
    const authTag = Buffer.from(record.authTag, 'base64');
    const ciphertext = Buffer.from(record.ciphertext, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  private pathFor(service: string): string {
    return join(this.vaultDir, `${service}.json`);
  }

  private loadFromEnvironment(env: NodeJS.ProcessEnv): void {
    for (const [service, metadata] of Object.entries(SecureKeyVault.SUPPORTED_SERVICES)) {
      const value = env[metadata.envVar];
      if (value && value.trim().length > 0) {
        this.keyStatus[service] = {
          configured: true,
          source: 'env',
          validationStatus: 'unchecked',
        };
      }
    }
  }

  private loadFromVault(): void {
    for (const service of Object.keys(SecureKeyVault.SUPPORTED_SERVICES)) {
      const path = this.pathFor(service);
      if (!existsSync(path)) {
        continue;
      }
      if (!this.keyStatus[service]) {
        this.keyStatus[service] = {
          configured: true,
          source: 'vault',
          validationStatus: 'unchecked',
        };
      }
    }
  }
}
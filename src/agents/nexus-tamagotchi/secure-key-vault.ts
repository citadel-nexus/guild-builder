import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
      updatedAt: encrypted.updatedAt,
    };
    return true;
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
        };
      }
    }
  }
}
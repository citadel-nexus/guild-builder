/**
 * Vault Client — resolves secrets from Supabase Vault at agent boot.
 *
 * The ONE bootstrap secret is SUPABASE_SERVICE_ROLE_KEY (provided via env).
 * Everything else (DD_API_KEY, POSTHOG_KEY, etc.) is fetched from Vault.
 *
 * This is the PUBLIC spine — it defines the interface and fetch logic.
 * Vault key names and tenant-specific configuration live in CNWB.
 */

export type VaultSecret = {
  name: string;
  value: string;
  description?: string;
  updatedAt?: string;
};

export type VaultClientConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  cacheTtlMs?: number;
};

export type VaultResolveResult = {
  resolved: Record<string, string>;
  missing: string[];
  fromCache: boolean;
};

type CachedSecret = {
  value: string;
  expiresAtEpochMs: number;
};

const DEFAULT_CACHE_TTL_MS = 300_000;
const READ_SECRET_RPC_PATH = '/rest/v1/rpc/read_secret';

function normalizeSupabaseUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function normalizeSecretKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const key of keys) {
    const trimmed = key.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function readEnvVar(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStringField(
  source: Record<string, unknown>,
  fieldName: string,
): string | null {
  const fieldValue = source[fieldName];
  return typeof fieldValue === 'string' && fieldValue.length > 0
    ? fieldValue
    : null;
}

function extractSecretValue(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.length > 0) {
    return payload;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const candidate = extractSecretValue(item);
      if (candidate !== null) {
        return candidate;
      }
    }
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const knownFieldOrder = [
    'value',
    'secret',
    'decrypted_secret',
    'decryptedSecret',
    'plaintext',
    'text',
    'read_secret',
  ];

  for (const fieldName of knownFieldOrder) {
    const candidate = readStringField(payload, fieldName);
    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
}

async function parseVaultResponseBody(response: Response): Promise<unknown> {
  const body = await response.text();
  if (body.length === 0) {
    return null;
  }

  try {
    const parsedBody: unknown = JSON.parse(body);
    return parsedBody;
  } catch {
    return body;
  }
}

export class VaultClient {
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, CachedSecret>();

  constructor(config: VaultClientConfig) {
    const normalizedUrl = normalizeSupabaseUrl(config.supabaseUrl);
    const normalizedKey = config.serviceRoleKey.trim();
    const ttlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

    if (normalizedUrl.length === 0) {
      throw new Error('VaultClient requires a non-empty supabaseUrl');
    }
    if (normalizedKey.length === 0) {
      throw new Error('VaultClient requires a non-empty serviceRoleKey');
    }
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('VaultClient cacheTtlMs must be a positive number');
    }

    this.supabaseUrl = normalizedUrl;
    this.serviceRoleKey = normalizedKey;
    this.cacheTtlMs = ttlMs;
  }

  async resolve(keys: string[]): Promise<VaultResolveResult> {
    const normalizedKeys = normalizeSecretKeys(keys);
    const resolved: Record<string, string> = {};
    const missing: string[] = [];

    if (normalizedKeys.length === 0) {
      return { resolved, missing, fromCache: true };
    }

    const now = Date.now();
    const toFetch: string[] = [];

    for (const key of normalizedKeys) {
      const cached = this.readCache(key, now);
      if (cached !== null) {
        resolved[key] = cached;
      } else {
        toFetch.push(key);
      }
    }

    const fromCache = toFetch.length === 0;
    if (toFetch.length > 0) {
      const fetched = await Promise.all(
        toFetch.map(async (key) => {
          const value = await this.readSecret(key);
          return { key, value };
        }),
      );

      const expiresAtEpochMs = Date.now() + this.cacheTtlMs;
      for (const item of fetched) {
        if (item.value === null) {
          missing.push(item.key);
          continue;
        }

        resolved[item.key] = item.value;
        this.cache.set(item.key, {
          value: item.value,
          expiresAtEpochMs,
        });
      }
    }

    return {
      resolved,
      missing,
      fromCache,
    };
  }

  async resolveOne(key: string): Promise<string | null> {
    const normalized = key.trim();
    if (normalized.length === 0) {
      return null;
    }

    const result = await this.resolve([normalized]);
    return result.resolved[normalized] ?? null;
  }

  clearCache(): void {
    this.cache.clear();
  }

  static fromEnv(): VaultClient | null {
    const supabaseUrl = readEnvVar('SUPABASE_URL');
    const serviceRoleKey = readEnvVar('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl === null || serviceRoleKey === null) {
      return null;
    }

    return new VaultClient({
      supabaseUrl,
      serviceRoleKey,
    });
  }

  private readCache(key: string, nowEpochMs: number): string | null {
    const item = this.cache.get(key);
    if (item === undefined) {
      return null;
    }

    if (item.expiresAtEpochMs <= nowEpochMs) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  private async readSecret(secretName: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.supabaseUrl}${READ_SECRET_RPC_PATH}`,
        {
          method: 'POST',
          headers: {
            apikey: this.serviceRoleKey,
            Authorization: `Bearer ${this.serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ secret_name: secretName }),
        },
      );

      if (!response.ok) {
        return null;
      }

      const payload = await parseVaultResponseBody(response);
      return extractSecretValue(payload);
    } catch {
      return null;
    }
  }
}
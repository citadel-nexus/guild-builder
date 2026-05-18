import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveConfig, resolveConfigs } from '../../../src/agents/shared/resolve-config.js';
import { VaultClient } from '../../../src/agents/shared/vault-client.js';

type EnvSnapshot = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  FALLBACK_ENV_A?: string;
  FALLBACK_ENV_B?: string;
};

function snapshotEnv(): EnvSnapshot {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    FALLBACK_ENV_A: process.env.FALLBACK_ENV_A,
    FALLBACK_ENV_B: process.env.FALLBACK_ENV_B,
  };
}

function restoreEnv(snapshot: EnvSnapshot): void {
  const entries: Array<[keyof EnvSnapshot, string | undefined]> = [
    ['SUPABASE_URL', snapshot.SUPABASE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', snapshot.SUPABASE_SERVICE_ROLE_KEY],
    ['FALLBACK_ENV_A', snapshot.FALLBACK_ENV_A],
    ['FALLBACK_ENV_B', snapshot.FALLBACK_ENV_B],
  ];

  for (const [key, value] of entries) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSecretName(body: string): string {
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed) || typeof parsed.secret_name !== 'string') {
    throw new Error('invalid test fetch payload');
  }
  return parsed.secret_name;
}

function mockVaultFetch(
  valuesBySecretName: Record<string, string>,
  options: { missingStatus?: number } = {},
): { calls: () => number } {
  let count = 0;
  const missingStatus = options.missingStatus ?? 404;

  const fetchImpl = async (
    _input: string | URL | globalThis.Request,
    init?: RequestInit,
  ): Promise<Response> => {
    count += 1;

    if (typeof init?.body !== 'string') {
      return new Response('', { status: 400 });
    }

    const secretName = parseSecretName(init.body);
    const secretValue = valuesBySecretName[secretName];
    if (typeof secretValue !== 'string') {
      return new Response('', { status: missingStatus });
    }

    return new Response(JSON.stringify({ value: secretValue }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  vi.stubGlobal('fetch', fetchImpl);
  return {
    calls: () => count,
  };
}

describe('VaultClient', () => {
  let envSnapshot: EnvSnapshot;

  beforeEach(() => {
    envSnapshot = snapshotEnv();
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.unstubAllGlobals();
  });

  it('resolves secrets and serves subsequent reads from cache', async () => {
    const fetchStats = mockVaultFetch({
      DD_API_KEY: 'dd-from-vault',
    });
    const client = new VaultClient({
      supabaseUrl: 'https://vault.example',
      serviceRoleKey: 'svc-role',
      cacheTtlMs: 60_000,
    });

    const first = await client.resolve(['DD_API_KEY']);
    expect(first.resolved).toEqual({ DD_API_KEY: 'dd-from-vault' });
    expect(first.missing).toEqual([]);
    expect(first.fromCache).toBe(false);
    expect(fetchStats.calls()).toBe(1);

    const second = await client.resolve(['DD_API_KEY']);
    expect(second.resolved).toEqual({ DD_API_KEY: 'dd-from-vault' });
    expect(second.missing).toEqual([]);
    expect(second.fromCache).toBe(true);
    expect(fetchStats.calls()).toBe(1);
  });

  it('returns null from fromEnv when required env vars are missing', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(VaultClient.fromEnv()).toBeNull();
  });

  it('returns resolved and missing keys from resolve()', async () => {
    mockVaultFetch({
      DD_API_KEY: 'dd-key',
    });
    const client = new VaultClient({
      supabaseUrl: 'https://vault.example',
      serviceRoleKey: 'svc-role',
    });

    const result = await client.resolve(['DD_API_KEY', 'POSTHOG_API_KEY']);
    expect(result.resolved).toEqual({ DD_API_KEY: 'dd-key' });
    expect(result.missing).toEqual(['POSTHOG_API_KEY']);
    expect(result.fromCache).toBe(false);
  });

  it('resolveConfig falls back to env var when vault does not have a key', async () => {
    process.env.FALLBACK_ENV_A = 'from-env';

    mockVaultFetch({
      DD_API_KEY: 'from-vault',
    });
    const client = new VaultClient({
      supabaseUrl: 'https://vault.example',
      serviceRoleKey: 'svc-role',
    });

    const vaultPreferred = await resolveConfig(client, 'DD_API_KEY', 'FALLBACK_ENV_A');
    const fallback = await resolveConfig(client, 'MISSING_KEY', 'FALLBACK_ENV_A');

    expect(vaultPreferred).toBe('from-vault');
    expect(fallback).toBe('from-env');
  });

  it('resolveConfigs resolves a batch with vault-first behavior', async () => {
    process.env.FALLBACK_ENV_A = 'env-fallback-a';
    process.env.FALLBACK_ENV_B = 'env-fallback-b';

    mockVaultFetch({
      DD_API_KEY: 'dd-from-vault',
    });
    const client = new VaultClient({
      supabaseUrl: 'https://vault.example',
      serviceRoleKey: 'svc-role',
    });

    const resolved = await resolveConfigs(client, [
      { vaultKey: 'DD_API_KEY', envVar: 'FALLBACK_ENV_A' },
      { vaultKey: 'MISSING_KEY', envVar: 'FALLBACK_ENV_B' },
    ]);

    expect(resolved.FALLBACK_ENV_A).toBe('dd-from-vault');
    expect(resolved.FALLBACK_ENV_B).toBe('env-fallback-b');
  });
});

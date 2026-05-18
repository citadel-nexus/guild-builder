import type { VaultClient } from './vault-client.js';

type ConfigMapping = {
  vaultKey: string;
  envVar: string;
};

function readEnvValue(envVar: string): string | null {
  const value = process.env[envVar];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve a configuration value: try Vault first, fall back to env var.
 * This is the standard pattern all agents use for credential resolution.
 */
export async function resolveConfig(
  vault: VaultClient | null,
  vaultKey: string,
  envVar: string,
): Promise<string | null> {
  if (vault !== null) {
    const fromVault = await vault.resolveOne(vaultKey);
    if (fromVault !== null) {
      return fromVault;
    }
  }

  return readEnvValue(envVar);
}

/**
 * Resolve multiple configuration values with Vault-first fallback.
 * The result object is keyed by env var name.
 */
export async function resolveConfigs(
  vault: VaultClient | null,
  mappings: ConfigMapping[],
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};

  const uniqueVaultKeys = new Set<string>();
  for (const mapping of mappings) {
    const normalizedVaultKey = mapping.vaultKey.trim();
    if (normalizedVaultKey.length > 0) {
      uniqueVaultKeys.add(normalizedVaultKey);
    }
  }

  const resolvedByVaultKey: Record<string, string> = {};
  if (vault !== null && uniqueVaultKeys.size > 0) {
    const batch = await vault.resolve([...uniqueVaultKeys]);
    for (const [vaultKey, value] of Object.entries(batch.resolved)) {
      resolvedByVaultKey[vaultKey] = value;
    }
  }

  for (const mapping of mappings) {
    const normalizedVaultKey = mapping.vaultKey.trim();
    const fromVault =
      normalizedVaultKey.length > 0
        ? resolvedByVaultKey[normalizedVaultKey]
        : undefined;

    if (typeof fromVault === 'string' && fromVault.length > 0) {
      results[mapping.envVar] = fromVault;
      continue;
    }

    results[mapping.envVar] = readEnvValue(mapping.envVar);
  }

  return results;
}

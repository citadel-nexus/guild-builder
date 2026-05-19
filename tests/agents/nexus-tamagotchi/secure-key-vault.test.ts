import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { SecureKeyVault } from '../../../src/agents/nexus-tamagotchi/secure-key-vault.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeVault(): SecureKeyVault {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-vault-'));
  tempDirs.push(dir);
  return new SecureKeyVault({
    vaultDir: dir,
    agentId: 'test-agent',
  });
}

describe('SecureKeyVault', () => {
  it('stores and retrieves encrypted keys', () => {
    const vault = makeVault();
    const stored = vault.storeKey('openai', 'test-key-123456789');
    expect(stored.success).toBe(true);
    expect(vault.getKey('openai')).toBe('test-key-123456789');
    expect(vault.getMaskedKey('openai')).toBe('test...6789');
  });

  it('reports status and validates key presence', () => {
    const vault = makeVault();
    vault.storeKey('openai', 'test-key-123456789');
    const validation = vault.validateKey('openai');
    expect(validation.success).toBe(true);

    const status = vault.getAllStatus();
    expect(status.openai.status).toBe('valid');
    expect(vault.getMissingRequiredServices().length).toBe(0);
  });

  it('removes stored keys and resets status', () => {
    const vault = makeVault();
    vault.storeKey('openai', 'test-key-123456789');
    const removed = vault.removeKey('openai');
    expect(removed.success).toBe(true);
    expect(vault.getKey('openai')).toBeUndefined();
  });
});
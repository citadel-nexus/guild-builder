import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AgentFeatureTier,
  AuthIntegratedBrotherhoodSystem,
  CitadelAuthClient,
  OfflineSyncStrategy,
  type AuthApiRequester,
} from '../../../src/agents/nexus-tamagotchi/backend-auth.js';
import { BrotherhoodSystem } from '../../../src/agents/nexus-tamagotchi/brotherhood.js';

describe('backend-auth foundations', () => {
  it('supports tier-based feature checks', () => {
    const client = new CitadelAuthClient({
      apiKey: 'test-key',
      enableOfflineSync: false,
    });

    const freeCheck = client.checkFeature('professor_network');
    expect(freeCheck.allowed).toBe(false);
    expect(freeCheck.requiredTier).toBe(AgentFeatureTier.PRO);
  });

  it('buffers offline awards then flushes after authentication', () => {
    const requester: AuthApiRequester = ({ endpoint, payload }) => {
      if (endpoint === 'authenticate') {
        return {
          success: true,
          sessionToken: 'session-1',
          userId: 'user-1',
          userTier: AgentFeatureTier.PRO,
          features: { professor_network: true },
          xpBalance: 0,
          tpBalance: 0,
          rank: 'INITIATE',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        };
      }
      if (endpoint === 'sync-xp') {
        const amount =
          typeof payload?.amount === 'number' ? payload.amount : 0;
        return {
          success: true,
          validatedAmount: amount,
          newTotal: amount,
          rankChanged: false,
          badgesUnlocked: [],
          validationFlags: [],
        };
      }
      if (endpoint === 'sync-tp') {
        const amount =
          typeof payload?.amount === 'number' ? payload.amount : 0;
        return {
          success: true,
          validatedAmount: amount,
          newTotal: amount,
          rankChanged: false,
          badgesUnlocked: [],
          validationFlags: [],
        };
      }
      return { success: false, error: 'Unhandled endpoint' };
    };

    const client = new CitadelAuthClient({
      apiKey: 'test-key',
      requester,
    });

    const bufferedXp = client.syncXp(30, 'interaction');
    const bufferedTp = client.syncTp(6, 'interaction');
    expect(bufferedXp.validationFlags).toContain('BUFFERED');
    expect(bufferedTp.validationFlags).toContain('BUFFERED');

    const auth = client.authenticate();
    expect(auth.success).toBe(true);

    const flush = client.flushOfflineBuffer();
    expect(flush.success).toBe(true);
    expect(flush.xpEntriesProcessed).toBeGreaterThan(0);
    expect(flush.tpEntriesProcessed).toBeGreaterThan(0);
  });

  it('tracks auth-integrated brotherhood sync state', () => {
    const requester: AuthApiRequester = ({ endpoint, payload }) => {
      if (endpoint === 'authenticate') {
        return {
          success: true,
          sessionToken: 'session-2',
          userId: 'user-2',
          userTier: AgentFeatureTier.NEXUS_DEV,
          features: {},
          xpBalance: 0,
          tpBalance: 0,
          rank: 'INITIATE',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        };
      }
      if (endpoint === 'sync-xp' || endpoint === 'sync-tp') {
        const amount =
          typeof payload?.amount === 'number' ? payload.amount : 0;
        return {
          success: true,
          validatedAmount: amount,
          newTotal: amount,
          rankChanged: false,
          badgesUnlocked: [],
          validationFlags: [],
        };
      }
      return { success: false, error: 'Unhandled endpoint' };
    };

    const client = new CitadelAuthClient({
      apiKey: 'test-key',
      requester,
      autoAuthenticate: true,
    });
    const brotherhood = new BrotherhoodSystem('agent-auth-sync');
    const integrated = new AuthIntegratedBrotherhoodSystem(client, brotherhood);

    const xpResult = integrated.awardXp(50, 'feat');
    const tpResult = integrated.awardTp(10, 'feat');
    expect(xpResult.success).toBe(true);
    expect(tpResult.success).toBe(true);

    const status = integrated.getSyncStatus();
    expect(status.pendingSync).toBe(false);
    expect(status.localXp).toBeGreaterThanOrEqual(50);
  });

  it('exposes offline sync buffer status', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'nexus-offline-auth-'));
    const strategy = new OfflineSyncStrategy(
      join(tempDir, 'offline-buffer.json'),
    );
    strategy.queueXp(10, 'interaction');
    strategy.queueTp(2, 'interaction');

    const status = strategy.getBufferStatus();
    expect(status.xpEntries).toBeGreaterThan(0);
    expect(status.tpEntries).toBeGreaterThan(0);
    rmSync(tempDir, { recursive: true, force: true });
  });
});
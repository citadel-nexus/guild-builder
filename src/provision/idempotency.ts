/**
 * Idempotency store for tenant provisioning.
 *
 * Each (tenantId, stageName) pair runs at most once per logical attempt.
 * Re-running the orchestrator on the same tenant returns the cached
 * StageResult instead of re-executing the stage body — this is what
 * makes the dispatch's §F.1 "fails are checkpointed; re-runs are no-ops"
 * actually true.
 *
 * Default in-memory implementation; downstream services swap for a
 * Supabase- or Redis-backed store via dependency injection.
 */
import type { StageResult } from './types.js';

export type IdempotencyKey = {
  tenantId: string;
  stage: string;
};

export interface IdempotencyStore {
  get(key: IdempotencyKey): Promise<StageResult | undefined>;
  put(key: IdempotencyKey, result: StageResult): Promise<void>;
  clear(tenantId: string): Promise<void>;
}

function keyOf(key: IdempotencyKey): string {
  return `${key.tenantId}::${key.stage}`;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly map = new Map<string, StageResult>();

  async get(key: IdempotencyKey): Promise<StageResult | undefined> {
    return this.map.get(keyOf(key));
  }

  async put(key: IdempotencyKey, result: StageResult): Promise<void> {
    this.map.set(keyOf(key), result);
  }

  async clear(tenantId: string): Promise<void> {
    for (const k of [...this.map.keys()]) {
      if (k.startsWith(`${tenantId}::`)) {
        this.map.delete(k);
      }
    }
  }
}

import { describe, expect, it } from 'vitest';

import {
  InMemoryIdempotencyStore,
  ProvisionOrchestrator,
  type Stage,
} from '../../src/provision/index.js';

function counter(): { stage: Stage; count: () => number } {
  let calls = 0;
  return {
    stage: {
      name: 'count',
      run: async () => {
        calls += 1;
        return { status: 'ok', data: { calls } };
      },
    },
    count: () => calls,
  };
}

describe('ProvisionOrchestrator idempotency', () => {
  it('does not re-run a stage on a second pass for the same tenant', async () => {
    const store = new InMemoryIdempotencyStore();
    const c = counter();
    const orchestrator = new ProvisionOrchestrator({
      stages: [c.stage],
      idempotency: store,
    });

    const ctx = { tenantId: 't1', industry: 'x', tier: 'starter' as const };
    const first = await orchestrator.run(ctx);
    const second = await orchestrator.run(ctx);

    expect(c.count()).toBe(1);
    expect(first.status).toBe('complete');
    expect(second.status).toBe('complete');
    expect(second.stages[0].data?.calls).toBe(1);
  });

  it('runs the stage again after the cached entry is cleared', async () => {
    const store = new InMemoryIdempotencyStore();
    const c = counter();
    const orchestrator = new ProvisionOrchestrator({
      stages: [c.stage],
      idempotency: store,
    });
    const ctx = { tenantId: 't1', industry: 'x', tier: 'starter' as const };

    await orchestrator.run(ctx);
    await store.clear('t1');
    await orchestrator.run(ctx);

    expect(c.count()).toBe(2);
  });

  it('treats different tenant ids as independent pipelines', async () => {
    const store = new InMemoryIdempotencyStore();
    const c = counter();
    const orchestrator = new ProvisionOrchestrator({
      stages: [c.stage],
      idempotency: store,
    });

    await orchestrator.run({ tenantId: 't1', industry: 'x', tier: 'starter' });
    await orchestrator.run({ tenantId: 't2', industry: 'x', tier: 'starter' });

    expect(c.count()).toBe(2);
  });

  it('retries previously failed stages on a subsequent run', async () => {
    const store = new InMemoryIdempotencyStore();
    let attempt = 0;
    const stage: Stage = {
      name: 'flaky',
      run: async () => {
        attempt += 1;
        return attempt === 1
          ? { status: 'failed', detail: 'first try fails' }
          : { status: 'ok' };
      },
    };
    const orchestrator = new ProvisionOrchestrator({
      stages: [stage],
      idempotency: store,
    });
    const ctx = { tenantId: 't1', industry: 'x', tier: 'starter' as const };

    const first = await orchestrator.run(ctx);
    expect(first.status).toBe('failed');

    const second = await orchestrator.run(ctx);
    expect(second.status).toBe('complete');
    expect(attempt).toBe(2);
  });

  it('emits stage.done with the cached result on a re-run', async () => {
    const store = new InMemoryIdempotencyStore();
    const c = counter();

    const events1: string[] = [];
    const events2: string[] = [];
    const orchestrator = new ProvisionOrchestrator({
      stages: [c.stage],
      idempotency: store,
      publish: (event) => {
        events1.push(`${event.kind}:${event.stage ?? ''}`);
      },
    });
    const ctx = { tenantId: 't1', industry: 'x', tier: 'starter' as const };

    await orchestrator.run(ctx);
    await orchestrator.run(ctx, {
      publish: (event) => {
        events2.push(`${event.kind}:${event.stage ?? ''}`);
      },
    });

    // First run: started, stage.started, stage.done, complete
    expect(events1).toContain('stage.started:count');
    expect(events1).toContain('stage.done:count');

    // Second run: skips stage.started, still emits stage.done with cached result
    expect(events2).not.toContain('stage.started:count');
    expect(events2).toContain('stage.done:count');
  });
});

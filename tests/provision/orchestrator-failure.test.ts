import { describe, expect, it } from 'vitest';

import {
  ProvisionOrchestrator,
  type ProvisionEvent,
  type Stage,
} from '../../src/provision/index.js';

function recorder() {
  const events: ProvisionEvent[] = [];
  return {
    events,
    publish: (event: ProvisionEvent) => {
      events.push(event);
    },
  };
}

describe('ProvisionOrchestrator (failure paths)', () => {
  it('stops the pipeline when a stage returns status: failed', async () => {
    const stages: Stage[] = [
      { name: 'a', run: async () => ({ status: 'ok' }) },
      { name: 'b', run: async () => ({ status: 'failed', detail: 'boom' }) },
      { name: 'c', run: async () => ({ status: 'ok' }) },
    ];
    const rec = recorder();
    const orchestrator = new ProvisionOrchestrator({
      stages,
      publish: rec.publish,
    });

    const summary = await orchestrator.run({
      tenantId: 't1',
      industry: 'x',
      tier: 'starter',
    });

    expect(summary.status).toBe('failed');
    expect(summary.failedStage).toBe('b');
    expect(summary.stages.map((s) => s.stage)).toEqual(['a', 'b']);
    expect(rec.events.at(-1)?.kind).toBe('failed');
    expect(rec.events.some((e) => e.kind === 'stage.failed' && e.stage === 'b'))
      .toBe(true);
  });

  it('catches thrown exceptions in stages and marks them failed', async () => {
    const stages: Stage[] = [
      { name: 'only', run: async () => {
        throw new Error('network blew up');
      } },
    ];
    const rec = recorder();
    const orchestrator = new ProvisionOrchestrator({
      stages,
      publish: rec.publish,
    });

    const summary = await orchestrator.run({
      tenantId: 't1',
      industry: 'x',
      tier: 'starter',
    });

    expect(summary.status).toBe('failed');
    expect(summary.stages[0].status).toBe('failed');
    expect(summary.stages[0].detail).toBe('network blew up');
    const failedEvent = rec.events.find((e) => e.kind === 'stage.failed');
    expect(failedEvent?.error).toBe('network blew up');
  });

  it('does not emit complete when any stage fails', async () => {
    const stages: Stage[] = [
      { name: 'fail', run: async () => ({ status: 'failed', detail: 'no' }) },
    ];
    const rec = recorder();
    const orchestrator = new ProvisionOrchestrator({
      stages,
      publish: rec.publish,
    });

    await orchestrator.run({ tenantId: 't', industry: 'x', tier: 'starter' });

    expect(rec.events.find((e) => e.kind === 'complete')).toBeUndefined();
  });
});

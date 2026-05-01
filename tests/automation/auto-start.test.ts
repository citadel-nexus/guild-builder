import { describe, expect, it } from 'vitest';

import { maybeStartResearchSignalPipe } from '../../src/automation/auto-start.js';

describe('maybeStartResearchSignalPipe', () => {
  it('does nothing when RESEARCH_SIGNAL_PIPE is not on', async () => {
    const result = await maybeStartResearchSignalPipe({});
    expect(result.started).toBe(false);
    expect(result.reason).toBe('RESEARCH_SIGNAL_PIPE != on');
  });

  it('reports missing NATS_URL when enabled', async () => {
    const result = await maybeStartResearchSignalPipe({
      RESEARCH_SIGNAL_PIPE: 'on',
    });
    expect(result.started).toBe(false);
    expect(result.reason).toMatch(/NATS_URL/);
  });

  it('reports missing inbound subject when enabled', async () => {
    const result = await maybeStartResearchSignalPipe({
      RESEARCH_SIGNAL_PIPE: 'on',
      NATS_URL: 'nats://localhost:4222',
    });
    expect(result.started).toBe(false);
    expect(result.reason).toMatch(/RESEARCH_PIPE_INBOUND_SUBJECT/);
  });

  it('reports missing outbound prefix when enabled', async () => {
    const result = await maybeStartResearchSignalPipe({
      RESEARCH_SIGNAL_PIPE: 'on',
      NATS_URL: 'nats://localhost:4222',
      RESEARCH_PIPE_INBOUND_SUBJECT: 'citadel.builder.analytics.signal',
    });
    expect(result.started).toBe(false);
    expect(result.reason).toMatch(/RESEARCH_PIPE_OUTBOUND_PREFIX/);
  });
});
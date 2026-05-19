import { describe, expect, it } from 'vitest';

import { PerplexityClient } from '../../../src/agents/nexus-tamagotchi/web-enrichment.js';

describe('PerplexityClient', () => {
  it('stays unavailable without endpoint and key', () => {
    const client = new PerplexityClient({
      env: {},
    });
    expect(client.isAvailable()).toBe(false);
    expect(client.shouldUsePerplexity('what is current status')).toBe(false);
  });

  it('uses trigger heuristics when configured', () => {
    const client = new PerplexityClient({
      apiKey: 'test-key',
      endpoint: 'http://localhost/test',
    });
    expect(client.isAvailable()).toBe(true);
    expect(client.shouldUsePerplexity('latest api docs for node')).toBe(true);
    expect(client.shouldUsePerplexity('hello world')).toBe(false);
  });
});
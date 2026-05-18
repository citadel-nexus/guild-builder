import { describe, expect, it } from 'vitest';

import { ReflexEngine } from '../../../src/agents/nexus-tamagotchi/reflex-engine.js';

describe('ReflexEngine', () => {
  it('triggers deterministic responses for known patterns', () => {
    const engine = new ReflexEngine('Nexus');
    const result = engine.tryReflex('hello there');
    expect(result.triggered).toBe(true);
    expect(result.response).toContain('Nexus');
  });

  it('returns non-triggered results for unknown input', () => {
    const engine = new ReflexEngine();
    const result = engine.tryReflex('this is a non-matching input');
    expect(result.triggered).toBe(false);
    expect(result.xpAwarded).toBe(0);
  });
});
import { describe, expect, it } from 'vitest';

import {
  CouncilPipelineVerdict,
  EmotionalState,
  GameRank,
  GovernanceDecision,
  MemoryObject,
  MemoryType,
  NexusAgentVitals,
} from '../../../src/agents/nexus-tamagotchi/models.js';

describe('nexus tamagotchi models', () => {
  it('computes deterministic memory fingerprints from text content', () => {
    const memory = new MemoryObject({
      inputText: 'alpha',
      outputText: 'beta',
      memoryType: MemoryType.DIALOGUE,
    });

    const first = memory.computeFingerprint();
    const second = memory.computeFingerprint();
    expect(first).toBe(second);
    expect(first.length).toBe(64);
  });

  it('creates vitals with expected defaults', () => {
    const vitals = new NexusAgentVitals();
    expect(vitals.emotionalState).toBe(EmotionalState.CURIOUS);
    expect(vitals.gameRank).toBe(GameRank.INITIATE);
    expect(vitals.energyLevel).toBeGreaterThan(0);
  });

  it('computes governance hash chain values', () => {
    const decision = new GovernanceDecision({
      decisionType: 'deployment',
      verdict: CouncilPipelineVerdict.REVIEW,
    });
    const hash = decision.computeHash('seed');
    expect(hash.length).toBe(64);
  });
});
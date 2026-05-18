import { describe, expect, it } from 'vitest';

import { SimpleDiagnostics } from '../../../src/agents/nexus-tamagotchi/diagnostics.js';
import {
  MemoryObject,
  MemoryType,
  NexusAgentVitals,
} from '../../../src/agents/nexus-tamagotchi/models.js';

describe('SimpleDiagnostics', () => {
  it('calculates coherence from memory trust scores', () => {
    const diagnostics = new SimpleDiagnostics();
    const memories = [
      new MemoryObject({ memoryType: MemoryType.DIALOGUE, trustScore: 0.4 }),
      new MemoryObject({ memoryType: MemoryType.KNOWLEDGE, trustScore: 0.8 }),
    ];
    expect(diagnostics.analyzeCoherence(memories)).toBeCloseTo(0.6, 5);
  });

  it('generates recommendations based on vitals', () => {
    const diagnostics = new SimpleDiagnostics();
    const vitals = new NexusAgentVitals({
      energyLevel: 0.2,
      learningProgress: 0.2,
      memoryCount: 5,
      growthStage: 1,
    });
    const recommendations = diagnostics.getRecommendations(vitals);
    expect(recommendations.length).toBeGreaterThan(0);
  });
});
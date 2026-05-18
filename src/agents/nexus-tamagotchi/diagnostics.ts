import type { MemoryObject, NexusAgentVitals } from './models.js';

export class SimpleDiagnostics {
  analyzeCoherence(memories: MemoryObject[]): number {
    if (memories.length === 0) {
      return 0;
    }
    const trustScores = memories.map((memory) => memory.trustScore);
    const sum = trustScores.reduce((total, score) => total + score, 0);
    return sum / trustScores.length;
  }

  analyzeGrowth(memoryCount: number, reflectionCount: number): number {
    const base = Math.min(memoryCount / 100, 1) * 0.4;
    const reflection = Math.min(reflectionCount / 20, 1) * 0.4;
    const engagement = Math.min(reflectionCount / 5, 1) * 0.2;
    return base + reflection + engagement;
  }

  getRecommendations(vitals: NexusAgentVitals): string[] {
    const recommendations: string[] = [];

    if (vitals.energyLevel < 0.3) {
      recommendations.push('Energy is low; reduce workload or schedule recovery.');
    }

    if (vitals.learningProgress < 0.3) {
      recommendations.push('Learning progress is low; diversify interaction topics.');
    }

    if (vitals.memoryCount < 10) {
      recommendations.push('Continue building foundational memory through varied interactions.');
    }

    if (vitals.growthStage < 3 && vitals.memoryCount > 20) {
      recommendations.push('Trigger reflection cycle to accelerate growth stage progression.');
    }

    return recommendations;
  }
}
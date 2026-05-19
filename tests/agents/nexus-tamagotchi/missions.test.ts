import { describe, expect, it } from 'vitest';

import { BrotherhoodSystem } from '../../../src/agents/nexus-tamagotchi/brotherhood.js';
import { MissionEngine } from '../../../src/agents/nexus-tamagotchi/missions.js';

describe('MissionEngine', () => {
  it('initializes mission templates and completes matching missions', () => {
    const brotherhood = new BrotherhoodSystem('agent-missions');
    const missions = new MissionEngine(brotherhood);

    expect(missions.getActiveMissions().length).toBeGreaterThan(0);
    const rewards = missions.updateProgress('interactions', 10);
    expect(rewards.length).toBeGreaterThan(0);
    expect(missions.getCompletedCount()).toBeGreaterThan(0);
  });

  it('returns undefined for unknown mission completion', () => {
    const brotherhood = new BrotherhoodSystem('agent-missions-2');
    const missions = new MissionEngine(brotherhood);
    expect(missions.completeMission('missing')).toBeUndefined();
  });
});
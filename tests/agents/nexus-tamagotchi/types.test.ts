import { describe, expect, it } from 'vitest';

import {
  AUTHORITY_ORDER,
  AUTHORITY_XP_GATES,
  BROTHERHOOD_RANK_ORDER,
  RANK_THRESHOLDS,
} from '../../../src/agents/nexus-tamagotchi/types.js';
import { BADGE_REGISTRY } from '../../../src/agents/nexus-tamagotchi/data/badges.js';
import { PROFESSOR_REGISTRY } from '../../../src/agents/nexus-tamagotchi/data/professors.js';
import { SKILL_TREES } from '../../../src/agents/nexus-tamagotchi/data/skills.js';

describe('nexus-tamagotchi type constants', () => {
  it('keeps rank thresholds in ascending order', () => {
    let previous = -1;
    for (const rank of BROTHERHOOD_RANK_ORDER) {
      const threshold = RANK_THRESHOLDS[rank];
      expect(threshold).toBeGreaterThanOrEqual(previous);
      previous = threshold;
    }
  });

  it('keeps authority gates in ascending order', () => {
    let previous = -1;
    for (const tier of AUTHORITY_ORDER) {
      const gate = AUTHORITY_XP_GATES[tier];
      expect(gate).toBeGreaterThanOrEqual(previous);
      previous = gate;
    }
  });

  it('exposes full rank and authority ladders', () => {
    expect(BROTHERHOOD_RANK_ORDER).toEqual([
      'initiate',
      'apprentice',
      'journeyman',
      'artisan',
      'master',
      'grandmaster',
      'elder',
      'legend',
    ]);
    expect(AUTHORITY_ORDER).toEqual([
      'OBSERVE',
      'ASSIST',
      'EXECUTE',
      'GOVERN',
      'ARCHITECT',
    ]);
  });

  it('ships stage-one registry minimums', () => {
    expect(Object.keys(BADGE_REGISTRY).length).toBeGreaterThanOrEqual(50);
    expect(Object.keys(PROFESSOR_REGISTRY).length).toBe(28);

    for (const skills of Object.values(SKILL_TREES)) {
      expect(skills.length).toBeGreaterThanOrEqual(18);
    }
  });
});
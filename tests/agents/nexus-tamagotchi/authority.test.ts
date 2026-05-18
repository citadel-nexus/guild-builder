import { describe, expect, it } from 'vitest';

import {
  AuthorityGate,
  AuthorityGateTier,
} from '../../../src/agents/nexus-tamagotchi/authority.js';
import { BrotherhoodSystem } from '../../../src/agents/nexus-tamagotchi/brotherhood.js';

describe('AuthorityGate', () => {
  it('enforces xp-based action permissions', () => {
    const brotherhood = new BrotherhoodSystem('agent-auth');
    const gate = new AuthorityGate(brotherhood);

    const before = gate.canPerform('unlock_skill');
    expect(before.allowed).toBe(false);
    expect(before.requiredTier).toBe(AuthorityGateTier.EXECUTE);

    brotherhood.awardXp('feat', { baseAmount: 2000 });
    const after = gate.canPerform('unlock_skill');
    expect(after.allowed).toBe(true);
  });

  it('throws for denied require checks', () => {
    const brotherhood = new BrotherhoodSystem('agent-auth-2');
    const gate = new AuthorityGate(brotherhood);
    expect(() => gate.require('reset_agent')).toThrowError();
  });
});
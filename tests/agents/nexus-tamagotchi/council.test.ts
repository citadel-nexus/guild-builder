import { describe, expect, it } from 'vitest';

import { ConstitutionalCouncil } from '../../../src/agents/nexus-tamagotchi/council.js';

describe('ConstitutionalCouncil', () => {
  it('approves valid actions through S03 in the public stub pipeline', () => {
    const council = new ConstitutionalCouncil();
    const decision = council.submitDecision('run-mission-sync', {
      actor: 'operator',
      authority: 'EXECUTE',
    });

    expect(decision.stage).toBe('S03');
    expect(decision.verdict).toBe('approved');
    expect(decision.hashChain.length).toBeGreaterThan(0);
    expect(council.getChainHead()).toBe(decision.hashChain);
  });

  it('denies empty actions at S00', () => {
    const council = new ConstitutionalCouncil();
    const decision = council.submitDecision('   ', {
      actor: 'operator',
      authority: 'EXECUTE',
    });

    expect(decision.stage).toBe('S00');
    expect(decision.verdict).toBe('denied');
  });

  it('requests review at S01 when authority is too low', () => {
    const council = new ConstitutionalCouncil();
    const decision = council.submitDecision('run-safe-check', {
      actor: 'observer',
      authority: 'OBSERVE',
    });

    expect(decision.stage).toBe('S01');
    expect(decision.verdict).toBe('review');
  });

  it('denies policy-blocked actions at S02', () => {
    const council = new ConstitutionalCouncil();
    const decision = council.submitDecision('deploy-change', {
      actor: 'operator',
      authority: 'EXECUTE',
      policyBlock: true,
    });

    expect(decision.stage).toBe('S02');
    expect(decision.verdict).toBe('denied');
    expect(council.getAuditTrail().length).toBeGreaterThan(0);
  });
});
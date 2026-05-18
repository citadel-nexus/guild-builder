import { describe, expect, it } from 'vitest';

import {
  GuardianAuditTrail,
  createAuditEntry,
  getChainHead,
  verifyChain,
} from '../../../src/agents/nexus-tamagotchi/audit.js';

describe('guardian audit trail', () => {
  it('creates valid chained entries', () => {
    const first = createAuditEntry(
      'event.one',
      'tester',
      'first detail',
      '',
      '2026-05-18T00:00:00.000Z',
    );
    const second = createAuditEntry(
      'event.two',
      'tester',
      'second detail',
      first.hash,
      '2026-05-18T00:00:01.000Z',
    );
    const third = createAuditEntry(
      'event.three',
      'tester',
      'third detail',
      second.hash,
      '2026-05-18T00:00:02.000Z',
    );

    const chain = [first, second, third];
    expect(verifyChain(chain)).toBe(true);
    expect(getChainHead(chain)).toBe(third.hash);
  });

  it('detects tampering in the hash chain', () => {
    const trail = new GuardianAuditTrail();
    const one = trail.append('event.one', 'tester', 'detail-one');
    const two = trail.append('event.two', 'tester', 'detail-two');

    const tampered = [
      one,
      {
        ...two,
        detail: 'detail-two-tampered',
      },
    ];

    expect(verifyChain(tampered)).toBe(false);
  });

  it('reports an empty chain head as empty string', () => {
    expect(getChainHead([])).toBe('');
  });
});
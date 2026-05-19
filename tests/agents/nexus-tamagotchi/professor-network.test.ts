import { describe, expect, it } from 'vitest';

import { ProfessorNetwork } from '../../../src/agents/nexus-tamagotchi/professor-network.js';

describe('ProfessorNetwork', () => {
  it('routes questions to matching domains', () => {
    const network = new ProfessorNetwork();
    const domain = network.routeToProfessor('Need infrastructure and deploy guidance');
    expect(domain).toBeDefined();
  });

  it('answers questions and tracks query history', () => {
    const network = new ProfessorNetwork();
    const response = network.askProfessor('How should we optimize CI pipeline latency?');
    expect(response.professor).not.toBe('Unknown');
    expect(response.confidence).toBeGreaterThan(0);
    expect(network.queryHistory.length).toBe(1);
  });

  it('publishes and searches findings', () => {
    const network = new ProfessorNetwork();
    const finding = network.publishFinding(
      'systems_engineering',
      'Integration Pattern',
      'Use staged contracts with explicit checkpoints.',
      ['integration', 'governance'],
    );

    expect(finding.id.length).toBeGreaterThan(0);
    expect(network.getFindingsByProfessor('systems_engineering').length).toBe(1);
    expect(network.searchKnowledgeGraph('checkpoints').length).toBe(1);
    expect(network.getTopProfessors(1).length).toBe(1);
  });
});
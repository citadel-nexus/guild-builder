import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STAGE_NAMES,
  defaultStageRegistry,
  makeStubStage,
} from '../../src/provision/index.js';

describe('default stage registry', () => {
  it('matches the stage order in dispatch §F.1', () => {
    expect([...DEFAULT_STAGE_NAMES]).toEqual([
      'calcom',
      'mautic',
      'twenty',
      'customer_io',
      'email_bank',
      'tenant_agent',
      'tenant_mcp',
      'cockpit_ui',
      'workflow_mesh',
    ]);
  });

  it('produces one stub Stage per default stage name', () => {
    const stages = defaultStageRegistry();
    expect(stages).toHaveLength(DEFAULT_STAGE_NAMES.length);
    expect(stages.map((s) => s.name)).toEqual([...DEFAULT_STAGE_NAMES]);
  });

  it('stub stages return status: stub with tenant context echoed back', async () => {
    const [first] = defaultStageRegistry();
    const result = await first.run({
      tenantId: 'bcx',
      industry: 'cosmetology',
      tier: 'growth',
    });
    expect(result.status).toBe('stub');
    expect(result.data).toEqual({
      tenantId: 'bcx',
      industry: 'cosmetology',
      tier: 'growth',
    });
    expect(result.detail).toContain('bcx');
  });

  it('makeStubStage builds a stub with the requested name', async () => {
    const custom = makeStubStage('vendor_x');
    expect(custom.name).toBe('vendor_x');
    const result = await custom.run({
      tenantId: 't',
      industry: 'i',
      tier: 'starter',
    });
    expect(result.status).toBe('stub');
    expect(result.detail).toContain('vendor_x');
  });
});

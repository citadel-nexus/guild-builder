import { describe, expect, it } from 'vitest';

import { maybeStartProvisionBridge } from '../../src/provision/auto-start.js';

describe('maybeStartProvisionBridge', () => {
  it('does nothing when PROVISION_ORCHESTRATOR is not set', async () => {
    const result = await maybeStartProvisionBridge({});
    expect(result.started).toBe(false);
    expect(result.reason).toBe('PROVISION_ORCHESTRATOR != on');
  });

  it('does nothing when PROVISION_ORCHESTRATOR is off', async () => {
    const result = await maybeStartProvisionBridge({
      PROVISION_ORCHESTRATOR: 'off',
    });
    expect(result.started).toBe(false);
  });

  it('reports a configuration error when NATS_URL is missing', async () => {
    const result = await maybeStartProvisionBridge({
      PROVISION_ORCHESTRATOR: 'on',
    });
    expect(result.started).toBe(false);
    expect(result.reason).toMatch(/NATS_URL/);
  });

  it('reports a configuration error when inbound subject is missing', async () => {
    const result = await maybeStartProvisionBridge({
      PROVISION_ORCHESTRATOR: 'on',
      NATS_URL: 'nats://localhost:4222',
    });
    expect(result.started).toBe(false);
    expect(result.reason).toMatch(/PROVISION_INBOUND_SUBJECT/);
  });

  it('reports a configuration error when outbound prefix is missing', async () => {
    const result = await maybeStartProvisionBridge({
      PROVISION_ORCHESTRATOR: 'on',
      NATS_URL: 'nats://localhost:4222',
      PROVISION_INBOUND_SUBJECT: 'walkin.tenant.provisioned',
    });
    expect(result.started).toBe(false);
    expect(result.reason).toMatch(/PROVISION_OUTBOUND_PREFIX/);
  });
});

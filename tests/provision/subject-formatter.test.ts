import { describe, expect, it } from 'vitest';

import {
  defaultSubjectFormatter,
  type ProvisionEvent,
} from '../../src/provision/index.js';

const ts = '2026-04-30T00:00:00.000Z';
const tenantId = 'bcx';
const prefix = 'citadel.tb';

function event(partial: Partial<ProvisionEvent>): ProvisionEvent {
  return {
    kind: 'started',
    tenantId,
    timestamp: ts,
    ...partial,
  } as ProvisionEvent;
}

describe('defaultSubjectFormatter', () => {
  it('matches dispatch §F.1 patterns', () => {
    expect(defaultSubjectFormatter(event({ kind: 'started' }), prefix)).toBe(
      'citadel.tb.bcx.provision.started',
    );
    expect(defaultSubjectFormatter(event({ kind: 'complete' }), prefix)).toBe(
      'citadel.tb.bcx.provision.complete',
    );
    expect(defaultSubjectFormatter(event({ kind: 'failed' }), prefix)).toBe(
      'citadel.tb.bcx.provision.failed',
    );
  });

  it('encodes per-stage lifecycle subjects with the stage name', () => {
    expect(
      defaultSubjectFormatter(
        event({ kind: 'stage.started', stage: 'calcom' }),
        prefix,
      ),
    ).toBe('citadel.tb.bcx.provision.calcom.started');
    expect(
      defaultSubjectFormatter(
        event({ kind: 'stage.done', stage: 'mautic' }),
        prefix,
      ),
    ).toBe('citadel.tb.bcx.provision.mautic.done');
    expect(
      defaultSubjectFormatter(
        event({ kind: 'stage.failed', stage: 'tenant_mcp' }),
        prefix,
      ),
    ).toBe('citadel.tb.bcx.provision.tenant_mcp.failed');
  });

  it('honors a caller-supplied prefix without mutating it', () => {
    expect(
      defaultSubjectFormatter(event({ kind: 'started' }), 'my.custom.prefix'),
    ).toBe('my.custom.prefix.bcx.provision.started');
  });
});

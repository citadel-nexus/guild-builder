import { describe, expect, it } from 'vitest';

import { SecurityWatcher } from '../../../../src/agents/datadog-bridge/watchers/security-watcher.js';
import { buildDatadogBridgeSubjects } from '../../../../src/agents/datadog-bridge/subjects.js';

describe('SecurityWatcher', () => {
  it('publishes new security signals, findings, and posture summaries', async () => {
    const published: Array<{ subject: string; payload: unknown }> = [];
    let signalCalls = 0;
    let findingCalls = 0;

    const watcher = new SecurityWatcher({
      client: {
        searchSecuritySignals: async () => {
          signalCalls += 1;
          return {
            signals: [
              {
                id: 'sig-1',
                severity: 'high',
                rule: 'blocked request',
                attributes: { service: 'api-service' },
              },
            ],
          };
        },
        getSecurityFindings: async () => {
          findingCalls += 1;
          return {
            findings: [
              {
                id: 'finding-1',
                findingType: 'vulnerability',
                severity: 'critical',
                resource: 'api-service',
                remediation: 'upgrade package',
                attributes: { cve: 'CVE-2026-0001' },
              },
            ],
          };
        },
      },
      publish: (subject, payload) => {
        published.push({ subject, payload });
      },
      subjects: buildDatadogBridgeSubjects('citadel.builder.datadog'),
      pollIntervalMs: 60_000,
      postureIntervalMs: 300_000,
      now: () => new Date('2026-05-18T00:00:00.000Z'),
      logger: { warn: () => {}, error: () => {} },
    });

    await watcher.start();
    await watcher.runOnce();
    await watcher.stop();

    expect(signalCalls).toBeGreaterThan(0);
    expect(findingCalls).toBeGreaterThan(0);

    const signalEvents = published.filter(
      (entry) => entry.subject === 'citadel.builder.datadog.security.signal',
    );
    const findingEvents = published.filter(
      (entry) => entry.subject === 'citadel.builder.datadog.security.finding',
    );
    const postureEvents = published.filter(
      (entry) => entry.subject === 'citadel.builder.datadog.security.posture',
    );

    expect(signalEvents).toHaveLength(1);
    expect(findingEvents).toHaveLength(1);
    expect(postureEvents).toHaveLength(1);
    expect(watcher.getPollCount()).toBe(2);
  });
});
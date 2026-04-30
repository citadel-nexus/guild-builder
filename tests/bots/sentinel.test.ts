import { describe, expect, it } from 'vitest';

import {
  fromGenericPayload,
  fromNemesisAudit,
  fromSuricataEve,
  fromWazuhAlert,
  severityWordToStatus,
  suricataSeverityToStatus,
  translate,
  wazuhLevelToStatus,
} from '../../src/bots/sentinel.js';

describe('severity → status mapping', () => {
  it('wazuh level mapping', () => {
    expect(wazuhLevelToStatus(0)).toBe('idle');
    expect(wazuhLevelToStatus(3)).toBe('idle');
    expect(wazuhLevelToStatus(4)).toBe('active');
    expect(wazuhLevelToStatus(7)).toBe('active');
    expect(wazuhLevelToStatus(8)).toBe('error');
    expect(wazuhLevelToStatus(15)).toBe('error');
    expect(wazuhLevelToStatus(undefined)).toBe('active');
  });

  it('suricata severity mapping (1=high, 3=low)', () => {
    expect(suricataSeverityToStatus(1)).toBe('error');
    expect(suricataSeverityToStatus(2)).toBe('error');
    expect(suricataSeverityToStatus(3)).toBe('active');
    expect(suricataSeverityToStatus(undefined)).toBe('active');
  });

  it('severity word mapping', () => {
    expect(severityWordToStatus('critical')).toBe('error');
    expect(severityWordToStatus('high')).toBe('error');
    expect(severityWordToStatus('medium')).toBe('active');
    expect(severityWordToStatus('low')).toBe('idle');
    expect(severityWordToStatus('info')).toBe('idle');
    expect(severityWordToStatus('offline')).toBe('offline');
    expect(severityWordToStatus('something_else')).toBe('active');
    expect(severityWordToStatus(undefined)).toBe('active');
  });
});

describe('fromWazuhAlert', () => {
  it('translates a canonical Wazuh alert', () => {
    const event = fromWazuhAlert({
      rule: {
        id: '5710',
        level: 10,
        description: 'sshd: Attempt to login using a non-existent user',
        mitre: { id: ['T1110'], tactic: 'TA0006' },
      },
      agent: { name: 'vps-01', id: '002', ip: '10.0.0.1' },
      timestamp: '2026-04-30T18:00:00.000Z',
    });
    expect(event).not.toBeNull();
    expect(event?.bot_id).toBe('wazuh-vps-01');
    expect(event?.bot_name).toBe('Wazuh · vps-01');
    expect(event?.bot_kind).toBe('sentinel');
    expect(event?.status).toBe('error');
    expect(event?.action).toContain('non-existent user');
    expect(event?.subject).toBe('sentinel.wazuh.vps-01.rule.5710');
    expect(event?.payload?.rule_id).toBe('5710');
    expect(event?.payload?.mitre_tactic).toBe('TA0006');
  });

  it('handles missing rule and agent gracefully', () => {
    const event = fromWazuhAlert({});
    expect(event).not.toBeNull();
    expect(event?.bot_id).toBe('wazuh-unknown');
    expect(event?.status).toBe('active');
  });

  it('returns null on non-object input', () => {
    expect(fromWazuhAlert(null)).toBeNull();
    expect(fromWazuhAlert('alert')).toBeNull();
    expect(fromWazuhAlert([])).toBeNull();
  });
});

describe('fromSuricataEve', () => {
  it('translates an alert event', () => {
    const event = fromSuricataEve({
      timestamp: '2026-04-30T18:00:00Z',
      event_type: 'alert',
      src_ip: '203.0.113.5',
      src_port: 51234,
      dest_ip: '10.0.0.1',
      dest_port: 22,
      alert: {
        signature: 'ET SCAN potential SSH brute-force',
        category: 'Attempted User Privilege Gain',
        severity: 1,
      },
    });
    expect(event).not.toBeNull();
    expect(event?.bot_id).toBe('suricata-203-0-113-5');
    expect(event?.bot_kind).toBe('sentinel');
    expect(event?.status).toBe('error');
    expect(event?.action).toContain('SSH brute-force');
    expect(event?.payload?.dest_ip).toBe('10.0.0.1');
    expect(event?.payload?.dest_port).toBe(22);
  });

  it('drops non-alert event types', () => {
    expect(fromSuricataEve({ event_type: 'flow' })).toBeNull();
    expect(fromSuricataEve({ event_type: 'dns', src_ip: 'x' })).toBeNull();
  });

  it('returns null when alert object is missing', () => {
    expect(fromSuricataEve({ event_type: 'alert', src_ip: 'x' })).toBeNull();
  });
});

describe('fromNemesisAudit', () => {
  it('translates a canonical audit summary', () => {
    const event = fromNemesisAudit({
      audit_type: 'intrusion_detection',
      severity: 'high',
      affected_host: 'vps-01',
      rule_triggered: 'ssh_brute_force',
      findings_count: 3,
      remediation_suggested: true,
      duration_ms: 4200,
    });
    expect(event).not.toBeNull();
    expect(event?.bot_id).toBe('nemesis-vps-01');
    expect(event?.bot_kind).toBe('sentinel');
    expect(event?.status).toBe('error');
    expect(event?.action).toBe('ssh_brute_force');
    expect(event?.subject).toBe('sentinel.nemesis.vps-01.intrusion_detection');
    expect(event?.payload?.findings_count).toBe(3);
    expect(event?.payload?.remediation_suggested).toBe(true);
  });

  it('falls back to defaults when fields missing', () => {
    const event = fromNemesisAudit({});
    expect(event).not.toBeNull();
    expect(event?.bot_id).toBe('nemesis-nemesis');
    expect(event?.action).toBe('audit');
    expect(event?.status).toBe('active');
  });
});

describe('fromGenericPayload', () => {
  it('coerces unrecognised kind to sentinel', () => {
    const event = fromGenericPayload({
      bot_id: 'cf-worker',
      bot_name: 'Cloudflare Worker',
      bot_kind: 'edge',
      status: 'high',
      action: 'waf_block',
    });
    expect(event?.bot_kind).toBe('sentinel');
    expect(event?.status).toBe('error');
  });

  it('preserves recognised bot kinds', () => {
    const event = fromGenericPayload({ bot_id: 'x', bot_kind: 'workflow' });
    expect(event?.bot_kind).toBe('workflow');
  });

  it('rejects payloads without a bot_id', () => {
    expect(fromGenericPayload({ action: 'x' })).toBeNull();
  });
});

describe('translate', () => {
  it('routes to the correct translator per source', () => {
    expect(translate('wazuh', { rule: { level: 5 }, agent: { name: 'h' } })?.bot_kind).toBe(
      'sentinel',
    );
    expect(translate('suricata', { event_type: 'alert', src_ip: 'x', alert: {} })).not.toBeNull();
    expect(translate('nemesis', { audit_type: 'x', affected_host: 'h' })).not.toBeNull();
    expect(translate('generic', { bot_id: 'x' })).not.toBeNull();
  });
});

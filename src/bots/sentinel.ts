/**
 * Sentinel ingestion — webhook translators for security signals.
 *
 * Maps vendor-specific alert shapes into the common BotEvent input
 * shape so Wazuh active-response, Suricata EVE alerts, and Nemesis
 * audit summaries all surface as `sentinel`-kind bots on the same
 * tracker UI as the agents and seats.
 *
 * Supported sources:
 *   - Wazuh    — alert JSON ({ rule, agent, timestamp, ... })
 *   - Suricata — EVE JSON line ({ event_type, alert, src_ip, ... })
 *   - Nemesis  — audit summary ({ audit_type, severity, host, ... })
 *   - generic  — any object that already matches the BotEvent input
 *
 * No vendor SDK is required — these translators read plain JSON. The
 * shapes are documented in:
 *   - https://documentation.wazuh.com/current/user-manual/ruleset/alert-format.html
 *   - https://docs.suricata.io/en/latest/output/eve/eve-json-format.html
 *   - docs/bot-tracker.md (Nemesis section)
 */

import type { BotKind, BotStatus, GeoPoint } from './types.js';

export type ParsedSentinelEvent = {
  bot_id: string;
  bot_name: string;
  bot_kind: BotKind;
  action: string;
  status: BotStatus;
  subject: string;
  geo?: GeoPoint;
  payload?: Record<string, unknown>;
};

export type SentinelSource = 'wazuh' | 'suricata' | 'nemesis' | 'generic';

const ID_SAFE = /[^a-z0-9_-]+/gi;

function safeId(value: string): string {
  return value.toLowerCase().replace(ID_SAFE, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asGeo(value: unknown): GeoPoint | undefined {
  const obj = asObject(value);
  if (!obj) return undefined;
  const lat = asNumber(obj.lat);
  const lon = asNumber(obj.lon);
  if (lat === undefined || lon === undefined) return undefined;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
  return { lat, lon };
}

/** Wazuh rule levels (0–15) collapsed into the BotStatus axis. */
export function wazuhLevelToStatus(level: number | undefined): BotStatus {
  if (level === undefined) return 'active';
  if (level >= 8) return 'error';
  if (level >= 4) return 'active';
  return 'idle';
}

/** Suricata alert severity (1=high, 2=medium, 3=low) collapsed. */
export function suricataSeverityToStatus(severity: number | undefined): BotStatus {
  if (severity === undefined) return 'active';
  if (severity <= 1) return 'error';
  if (severity === 2) return 'error';
  return 'active';
}

/** Generic severity word → BotStatus. */
export function severityWordToStatus(severity: string | undefined): BotStatus {
  if (!severity) return 'active';
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'high':
    case 'error':
    case 'fatal':
      return 'error';
    case 'medium':
    case 'warning':
    case 'warn':
    case 'active':
      return 'active';
    case 'low':
    case 'info':
    case 'idle':
      return 'idle';
    case 'offline':
      return 'offline';
    default:
      return 'active';
  }
}

/**
 * Wazuh alert payload — typical shape:
 *   {
 *     "rule":      { "id": "5710", "level": 8, "description": "...",
 *                    "mitre": { "id": ["T1110"], "tactic": ["TA0006"] } },
 *     "agent":     { "name": "vps-01", "id": "002", "ip": "10.0.0.1" },
 *     "timestamp": "2026-04-30T18:00:00.000Z",
 *     "data":      { ... }
 *   }
 */
export function fromWazuhAlert(input: unknown): ParsedSentinelEvent | null {
  const alert = asObject(input);
  if (!alert) return null;

  const rule = asObject(alert.rule) ?? {};
  const agent = asObject(alert.agent) ?? {};

  const agentName = asString(agent.name) ?? asString(agent.id) ?? 'unknown';
  const ruleId = asString(rule.id) ?? 'unknown';
  const ruleDesc = asString(rule.description) ?? `rule:${ruleId}`;
  const level = asNumber(rule.level);

  const mitre = asObject(rule.mitre);
  const mitreTactic = mitre ? asString(mitre.tactic) : undefined;

  return {
    bot_id: `wazuh-${safeId(agentName)}`,
    bot_name: `Wazuh · ${agentName}`,
    bot_kind: 'sentinel',
    action: ruleDesc,
    status: wazuhLevelToStatus(level),
    subject: `sentinel.wazuh.${safeId(agentName)}.rule.${safeId(ruleId)}`,
    payload: {
      source: 'wazuh',
      rule_id: ruleId,
      rule_level: level,
      rule_description: ruleDesc,
      mitre_tactic: mitreTactic,
      agent_name: agentName,
      agent_ip: asString(agent.ip),
    },
  };
}

/**
 * Suricata EVE JSON event — typical shape:
 *   {
 *     "timestamp": "...",
 *     "event_type": "alert" | "dns" | "http" | "tls" | "flow",
 *     "src_ip": "...", "src_port": ...,
 *     "dest_ip": "...", "dest_port": ...,
 *     "alert": { "signature": "...", "category": "...", "severity": 2 }
 *   }
 *
 * Only `event_type === "alert"` events become BotEvents. Flow / DNS /
 * HTTP records carry no operator-actionable signal on their own.
 */
export function fromSuricataEve(input: unknown): ParsedSentinelEvent | null {
  const eve = asObject(input);
  if (!eve) return null;

  const eventType = asString(eve.event_type);
  if (eventType !== 'alert') return null;

  const alert = asObject(eve.alert);
  if (!alert) return null;

  const signature = asString(alert.signature) ?? 'unknown alert';
  const category = asString(alert.category) ?? 'uncategorised';
  const severity = asNumber(alert.severity);
  const srcIp = asString(eve.src_ip) ?? 'unknown';
  const destIp = asString(eve.dest_ip);

  return {
    bot_id: `suricata-${safeId(srcIp)}`,
    bot_name: `Suricata · ${srcIp}`,
    bot_kind: 'sentinel',
    action: signature,
    status: suricataSeverityToStatus(severity),
    subject: `sentinel.suricata.${safeId(srcIp)}.${safeId(category)}`,
    payload: {
      source: 'suricata',
      signature,
      category,
      severity,
      src_ip: srcIp,
      dest_ip: destIp,
      src_port: asNumber(eve.src_port),
      dest_port: asNumber(eve.dest_port),
    },
  };
}

/**
 * Nemesis audit summary — operator-defined shape:
 *   {
 *     "audit_type":   "intrusion_detection" | "auth_check" | "drift_check",
 *     "severity":     "critical" | "high" | "medium" | "low",
 *     "affected_host": "vps-01",
 *     "rule_triggered": "ssh_brute_force",
 *     "findings_count": 3,
 *     "remediation_suggested": true,
 *     "duration_ms":   4200
 *   }
 */
export function fromNemesisAudit(input: unknown): ParsedSentinelEvent | null {
  const audit = asObject(input);
  if (!audit) return null;

  const auditType = asString(audit.audit_type) ?? 'audit';
  const severity = asString(audit.severity);
  const host = asString(audit.affected_host) ?? asString(audit.host) ?? 'nemesis';
  const rule = asString(audit.rule_triggered) ?? auditType;

  return {
    bot_id: `nemesis-${safeId(host)}`,
    bot_name: `Nemesis · ${host}`,
    bot_kind: 'sentinel',
    action: rule,
    status: severityWordToStatus(severity),
    subject: `sentinel.nemesis.${safeId(host)}.${safeId(auditType)}`,
    geo: asGeo(audit.geo),
    payload: {
      source: 'nemesis',
      audit_type: auditType,
      severity,
      affected_host: host,
      rule_triggered: rule,
      findings_count: asNumber(audit.findings_count),
      remediation_suggested: audit.remediation_suggested === true,
      duration_ms: asNumber(audit.duration_ms),
    },
  };
}

/**
 * Generic ingest — accept any payload that already matches the
 * `bot_id` / `action` / `status` / `bot_kind` shape. This is the
 * fallback for ad-hoc integrations (n8n workflows, custom honeypots,
 * Cloudflare Workers POSTing structured events).
 */
export function fromGenericPayload(input: unknown): ParsedSentinelEvent | null {
  const obj = asObject(input);
  if (!obj) return null;

  const botId = asString(obj.bot_id);
  if (!botId) return null;

  const botKind = asString(obj.bot_kind);
  const status = asString(obj.status);
  const action = asString(obj.action) ?? 'event';
  const subject = asString(obj.subject) ?? `sentinel.generic.${safeId(botId)}.${safeId(action)}`;

  return {
    bot_id: botId,
    bot_name: asString(obj.bot_name) ?? botId,
    bot_kind:
      botKind === 'agent' ||
      botKind === 'seat' ||
      botKind === 'workflow' ||
      botKind === 'webhook' ||
      botKind === 'sentinel'
        ? botKind
        : 'sentinel',
    action,
    status: severityWordToStatus(status),
    subject,
    geo: asGeo(obj.geo),
    payload: asObject(obj.payload) ?? undefined,
  };
}

export function translate(
  source: SentinelSource,
  payload: unknown,
): ParsedSentinelEvent | null {
  switch (source) {
    case 'wazuh':
      return fromWazuhAlert(payload);
    case 'suricata':
      return fromSuricataEve(payload);
    case 'nemesis':
      return fromNemesisAudit(payload);
    case 'generic':
      return fromGenericPayload(payload);
  }
}

import type { DatadogBridgeSubjects } from './types.js';

function normalizePrefix(prefix: string): string {
  return prefix.endsWith('.') ? prefix.slice(0, -1) : prefix;
}

function joinSubject(prefix: string, suffix: string): string {
  return `${normalizePrefix(prefix)}.${suffix}`;
}

export function buildDatadogBridgeSubjects(
  prefix: string,
): DatadogBridgeSubjects {
  return {
    monitorAlert: joinSubject(prefix, 'monitor.alert'),
    monitorWarn: joinSubject(prefix, 'monitor.warn'),
    monitorOk: joinSubject(prefix, 'monitor.ok'),
    monitorNodata: joinSubject(prefix, 'monitor.nodata'),
    heartbeat: joinSubject(prefix, 'heartbeat'),
    securitySignal: joinSubject(prefix, 'security.signal'),
    securityFinding: joinSubject(prefix, 'security.finding'),
    securityPosture: joinSubject(prefix, 'security.posture'),
    llmTrace: joinSubject(prefix, 'llm.trace'),
    llmError: joinSubject(prefix, 'llm.error'),
    llmCost: joinSubject(prefix, 'llm.cost'),
    llmLatency: joinSubject(prefix, 'llm.latency'),
    commandWildcard: joinSubject(prefix, 'command.>'),
    automationMute: joinSubject(prefix, 'automation.mute'),
    automationCreateMonitor: joinSubject(prefix, 'automation.create-monitor'),
    automationSnapshot: joinSubject(prefix, 'automation.snapshot'),
    automationDowntime: joinSubject(prefix, 'automation.downtime'),
    automationResultPrefix: joinSubject(prefix, 'automation.result'),
    integrationPosthogEvent: joinSubject(prefix, 'integration.posthog.event'),
    integrationCustomerIoWebhook: joinSubject(
      prefix,
      'integration.customerio.webhook',
    ),
    integrationGitLabPipeline: joinSubject(prefix, 'integration.gitlab.pipeline'),
    integrationStripePayment: joinSubject(prefix, 'integration.stripe.payment'),
  };
}
import type { DatadogBridgeBootstrapConfig } from './types.js';

function isEnabled(value: string | undefined): boolean {
  return (value ?? '').toLowerCase() === 'on';
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

export function resolveDatadogBridgeConfig(
  env: NodeJS.ProcessEnv = process.env,
): DatadogBridgeBootstrapConfig {
  return {
    bridgeEnabled: isEnabled(env.DATADOG_BRIDGE),
    apiKey: env.DD_API_KEY ?? '',
    appKey: env.DD_APP_KEY ?? '',
    site: env.DD_SITE ?? 'us5.datadoghq.com',
    natsUrl: env.NATS_URL ?? '',
    natsToken: env.NATS_TOKEN,
    subjectPrefix: env.DATADOG_NATS_PREFIX ?? 'citadel.builder.datadog',
    pollIntervalMs: parseNumber(env.DATADOG_POLL_INTERVAL_MS, 60_000),
    securityEnabled: isEnabled(env.DATADOG_SECURITY_ENABLED),
    llmEnabled: isEnabled(env.DATADOG_LLM_ENABLED),
    automationEnabled: isEnabled(env.DATADOG_AUTOMATION_ENABLED),
    integrationsEnabled: isEnabled(env.DATADOG_INTEGRATIONS_ENABLED),
    debug: (env.DATADOG_BRIDGE_DEBUG ?? '').toLowerCase() === 'true',
    llmLatencyThresholdMs: parseNumber(
      env.DATADOG_LLM_LATENCY_THRESHOLD_MS,
      5_000,
    ),
    llmErrorRateThreshold: parseNumber(
      env.DATADOG_LLM_ERROR_RATE_THRESHOLD,
      0.05,
    ),
    llmThroughputDropRatio: parseNumber(
      env.DATADOG_LLM_THROUGHPUT_DROP_RATIO,
      0.4,
    ),
    llmPromptTokenCostUsd: parseNumber(
      env.DATADOG_LLM_PROMPT_TOKEN_COST_USD,
      0,
    ),
    llmCompletionTokenCostUsd: parseNumber(
      env.DATADOG_LLM_COMPLETION_TOKEN_COST_USD,
      0,
    ),
    llmModel: env.DATADOG_LLM_MODEL,
    llmApplication: env.DATADOG_LLM_APPLICATION,
    governanceEnabled: isEnabled(env.DATADOG_GOVERNANCE_ENABLED),
    governanceSourceUrl: env.GOVERNANCE_SOURCE_URL ?? '',
    governancePollIntervalMs: parseNumber(env.GOVERNANCE_POLL_INTERVAL_MS, 3_600_000),
    nimBaseUrl:
      env.NVIDIA_NIM_BASE_URL ?? 'http://localhost:8000/v1/chat/completions',
    nimModel: env.NVIDIA_NIM_MODEL ?? 'meta/llama-3.1-8b-instruct',
    nimApiKey: env.NVIDIA_NIM_API_KEY ?? '',
    nimMaxTokens: parseNumber(env.NVIDIA_NIM_MAX_TOKENS, 4_096),
    nimTemperature: parseNumber(env.NVIDIA_NIM_TEMPERATURE, 0.1),
  };
}

export function validateDatadogBridgeConfig(
  config: DatadogBridgeBootstrapConfig,
): string | null {
  if (!config.bridgeEnabled) {
    return 'DATADOG_BRIDGE != on';
  }
  if (!config.natsUrl) {
    return 'NATS_URL is required';
  }
  if (!config.apiKey) {
    return 'DD_API_KEY is required';
  }
  if (!config.appKey) {
    return 'DD_APP_KEY is required';
  }
  if (!config.subjectPrefix) {
    return 'DATADOG_NATS_PREFIX is required';
  }
  if (config.governanceEnabled && !config.governanceSourceUrl) {
    return 'GOVERNANCE_SOURCE_URL is required when DATADOG_GOVERNANCE_ENABLED=on';
  }
  return null;
}

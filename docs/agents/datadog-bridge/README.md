# Datadog Observability Bridge — Builder Guild Agent

## Overview

The Datadog Bridge is a NATS-connected agent that provides bidirectional communication
between the Citadel Nexus event bus and Datadog observability endpoints. It acts as a
credentialed proxy so services can integrate with Datadog through NATS without direct API credentials.

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    NATS Event Bus                        │
│  ${DATADOG_NATS_PREFIX}.*                               │
├─────────┬───────────┬───────────┬───────────┬──────────┤
│ monitor │ security  │ llm       │ automation│ integr.  │
│ watcher │ watcher   │ observer  │ engine    │ bridge   │
└────┬────┴─────┬─────┴─────┬─────┴─────┬─────┴────┬─────┘
     │          │           │           │          │
     ▼          ▼           ▼           ▼          ▼
┌─────────────────────────────────────────────────────────┐
│                   Datadog API (DD_SITE)                 │
│ /api/v1/monitor  /api/v2/security  /api/v1/query        │
│ /api/v1/events   /api/v2/logs      /api/v1/series       │
└─────────────────────────────────────────────────────────┘
```

## Modules

### Monitor Watcher (`monitor-watcher.ts`)

The monitor watcher is the baseline monitor-state streamer for monitor transitions.

**NATS subjects published**

- `${prefix}.monitor.alert`
- `${prefix}.monitor.warn`
- `${prefix}.monitor.ok`
- `${prefix}.monitor.nodata`
- `${prefix}.heartbeat`

### Security Watcher (`watchers/security-watcher.ts`)

Polls Datadog security signals and findings and publishes normalized events.

**NATS subjects published**

- `${prefix}.security.signal` — new security signal
- `${prefix}.security.finding` — new finding
- `${prefix}.security.posture` — periodic posture summary

### LLM Observer (`watchers/llm-observer.ts`)

Polls Nvidia NIM / vLLM metrics via Datadog and emits telemetry events for latency,
errors, throughput, and estimated token cost.

**NATS subjects published**

- `${prefix}.llm.trace`
- `${prefix}.llm.error`
- `${prefix}.llm.cost`
- `${prefix}.llm.latency`

### Automation Engine (`automation-engine.ts`)

Consumes NATS automation commands and executes Datadog API actions.

**NATS subjects consumed**

- `${prefix}.automation.mute`
- `${prefix}.automation.create-monitor`
- `${prefix}.automation.snapshot`
- `${prefix}.automation.downtime`

### Integration Bridge (`integrations/integration-bridge.ts`)

Consumes integration subjects and forwards normalized payloads into Datadog.

**Supported adapters**

- PostHog → Datadog events (`integrations/posthog.ts`)
- Customer.io → Datadog logs (`integrations/customerio.ts`)
- GitLab → Datadog CI + custom metrics (`integrations/gitlab.ts`)
- Stripe → Datadog custom metrics (`integrations/stripe.ts`)

## Configuration

| Env Var | Required | Default | Description |
|---------|----------|---------|-------------|
| `DATADOG_BRIDGE` | No | `off` | Set to `on` to enable startup |
| `DD_API_KEY` | Yes (when enabled) | — | Datadog API key |
| `DD_APP_KEY` | Yes (when enabled) | — | Datadog Application key |
| `DD_SITE` | No | `us5.datadoghq.com` | Datadog API site |
| `DATADOG_NATS_PREFIX` | No | `citadel.builder.datadog` | NATS subject prefix |
| `DATADOG_POLL_INTERVAL_MS` | No | `60000` | Poll interval |
| `DATADOG_SECURITY_ENABLED` | No | `off` | Enable security watcher |
| `DATADOG_LLM_ENABLED` | No | `off` | Enable LLM observer |
| `DATADOG_AUTOMATION_ENABLED` | No | `off` | Enable automation engine |
| `DATADOG_INTEGRATIONS_ENABLED` | No | `off` | Enable integration bridge |
| `DATADOG_BRIDGE_DEBUG` | No | `false` | Verbose debug logging |

## Extending the Agent

### Adding a watcher

1. Create `src/agents/datadog-bridge/watchers/<watcher>.ts`
2. Implement the `Watcher` interface from `types.ts`
3. Register in `auto-start.ts` behind a feature flag
4. Add subject mappings in `subjects.ts`
5. Add tests in `tests/agents/datadog-bridge/watchers/`
6. Update this documentation

### Adding an automation command

1. Extend command payload types in `types.ts`
2. Add validation + handler in `automation-engine.ts`
3. Add client methods in `client.ts` when needed
4. Add test coverage in `tests/agents/datadog-bridge/automation-engine.test.ts`
5. Update subject catalog docs

### Adding an integration adapter

1. Create `src/agents/datadog-bridge/integrations/<adapter>.ts`
2. Return an `Integration` object from the file
3. Register in `createDefaultIntegrations`
4. Add inbound subject mapping in `subjects.ts`
5. Add tests in `tests/agents/datadog-bridge/integrations/`

## Subject Catalog

All subjects are composed from `${DATADOG_NATS_PREFIX}` (default: `citadel.builder.datadog`).

### Published (bridge → NATS)

| Subject | Payload |
|---------|---------|
| `*.monitor.alert` | `DatadogEvent` |
| `*.monitor.warn` | `DatadogEvent` |
| `*.monitor.ok` | `DatadogEvent` |
| `*.monitor.nodata` | `DatadogEvent` |
| `*.security.signal` | `SecuritySignal` |
| `*.security.finding` | `SecurityFinding` |
| `*.security.posture` | `PostureSummary` |
| `*.llm.trace` | `LlmTraceEvent` |
| `*.llm.error` | `LlmTraceEvent` |
| `*.llm.cost` | `CostEvent` |
| `*.llm.latency` | `LlmTraceEvent` |
| `*.heartbeat` | `HeartbeatEvent` |

### Consumed (NATS → bridge)

| Subject | Payload |
|---------|---------|
| `*.command.>` | `DatadogCommand` |
| `*.automation.mute` | `MuteCommand` |
| `*.automation.create-monitor` | `CreateMonitorCommand` |
| `*.automation.snapshot` | `SnapshotCommand` |
| `*.automation.downtime` | `DowntimeCommand` |
| `*.integration.posthog.event` | `PostHogInboundEvent` |
| `*.integration.customerio.webhook` | `CustomerIoWebhook` |
| `*.integration.gitlab.pipeline` | `GitLabPipelineEvent` |
| `*.integration.stripe.payment` | `StripePaymentEvent` |

## Upgrade Guide

### Runtime compatibility

- Node.js >= 18 (built-in `fetch`)
- NATS >= 2.10
- Datadog API v1 + v2

### Breaking change policy

- Subject contracts are public. Breaking changes require a versioned suffix (`.v2`).
- `DatadogEvent` and derived payloads are additive-only.
- New flags default to safe-off behavior.
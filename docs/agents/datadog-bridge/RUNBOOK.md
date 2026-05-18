# Datadog Bridge Runbook

## Enable / disable features

Set `DATADOG_BRIDGE=on` to activate bridge startup, then toggle feature flags:

- `DATADOG_SECURITY_ENABLED=on`
- `DATADOG_LLM_ENABLED=on`
- `DATADOG_AUTOMATION_ENABLED=on`
- `DATADOG_INTEGRATIONS_ENABLED=on`

All flags default to `off` for safe startup.

## Verify bridge health

### 1) Process startup

Check service logs for:

- `datadog bridge started`
- no `datadog bridge failed to start` line

### 2) Heartbeat subject

Subscribe to `${DATADOG_NATS_PREFIX}.heartbeat` and verify periodic events with:

- `agent = datadog-bridge`
- watcher list
- incrementing `pollCount`

### 3) Feature-specific signals

- Security: `${prefix}.security.signal`, `${prefix}.security.posture`
- LLM: `${prefix}.llm.trace`, `${prefix}.llm.error`, `${prefix}.llm.cost`
- Automation: `${prefix}.automation.result.*`

## Debug mode

Set:

```bash
DATADOG_BRIDGE_DEBUG=true
```

Then restart the process. Debug mode is intended for local or short-lived troubleshooting sessions.

## Common failure modes

### Missing credentials

Symptom:

- startup skipped with `DD_API_KEY is required` or `DD_APP_KEY is required`

Fix:

- add env vars to runtime secret store and redeploy

### NATS connection failure

Symptom:

- startup error when connecting to `NATS_URL`

Fix:

- verify NATS URL/token and network path
- confirm broker accepts the service identity

### Security watcher not emitting

Symptom:

- no `*.security.*` traffic

Fix:

- ensure `DATADOG_SECURITY_ENABLED=on`
- verify poll interval is not excessively large
- check Datadog key scopes for security APIs

### LLM observer emits only cost/trace with zero values

Symptom:

- LLM events are present but all metric values are zero

Fix:

- validate metric names in Datadog for your NIM/vLLM deployment
- adjust query filters in `llm-observer.ts` if environment-specific tags are required

### Automation commands fail validation

Symptom:

- `*.automation.result.<requestId>` payload has `ok=false`

Fix:

- inspect `error` field for missing required payload keys
- validate payload shape against `types.ts`

## Docker Compose snippet

```yaml
services:
  guild-builder:
    environment:
      DATADOG_BRIDGE: "on"
      DD_API_KEY: "${DD_API_KEY}"
      DD_APP_KEY: "${DD_APP_KEY}"
      DD_SITE: "us5.datadoghq.com"
      DATADOG_NATS_PREFIX: "citadel.builder.datadog"
      DATADOG_POLL_INTERVAL_MS: "60000"
      DATADOG_SECURITY_ENABLED: "on"
      DATADOG_LLM_ENABLED: "on"
      DATADOG_AUTOMATION_ENABLED: "on"
      DATADOG_INTEGRATIONS_ENABLED: "on"
```

## Monitoring the monitor

Create a Datadog monitor for heartbeat freshness:

- Metric/log source: events ingested from `${prefix}.heartbeat`
- Alert condition: no heartbeat for 2 poll intervals
- Suggested threshold: `> 120s` when poll interval is `60s`

Route this alert to your normal on-call path so bridge outages are detected quickly.
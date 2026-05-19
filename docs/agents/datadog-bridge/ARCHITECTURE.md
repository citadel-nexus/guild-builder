# Datadog Bridge Architecture

## Purpose

The Datadog Bridge provides a single NATS-native control and telemetry plane for Datadog.
It centralizes Datadog credentials in one process and exposes a stable event contract to the rest
of the Builder Guild stack.

## Polling vs webhook

The bridge uses polling for Datadog-side data ingestion.

### Why polling

- No inbound firewall exceptions are required.
- Startup does not depend on registering callback URLs.
- The bridge remains transport-only and can run in isolated environments.
- Failure modes are deterministic: poll, compare, publish, repeat.

### Tradeoffs

- Polling introduces bounded staleness (`DATADOG_POLL_INTERVAL_MS`).
- API quota management is required.

## State diffing model

### Security watcher

- Maintains in-memory `seenSignalIds` and `seenFindingIds`.
- Each poll emits only IDs that were not seen before.
- Posture summaries are emitted on a separate interval (`postureIntervalMs`, default 5 minutes).

### LLM observer

- Stores the previous poll snapshot in memory.
- Compares current success/error/latency to previous values.
- Emits anomaly events for:
  - latency threshold exceeded
  - error-rate threshold exceeded
  - throughput drop ratio exceeded

## NATS request/reply and command routing

Automation commands are consumed from explicit command subjects:

- `${prefix}.automation.mute`
- `${prefix}.automation.create-monitor`
- `${prefix}.automation.snapshot`
- `${prefix}.automation.downtime`

Result routing:

1. If payload includes `replyTo`, publish result there.
2. Otherwise publish to `${prefix}.automation.result.<requestId>`.
3. If NATS message has a reply handler, respond with the same result payload.

## Error handling and retries

### Watchers

- Poll loops are wrapped in `try/catch`.
- Errors are logged and counted.
- A failed poll does not stop the interval loop.

### Automation + integration

- Per-message failure isolation.
- Invalid payloads generate failure results (automation) or logged errors (integrations).
- Subscription loops stay alive after handler errors.

## Security model

- `DD_API_KEY` and `DD_APP_KEY` are read from process environment only.
- API keys never appear in NATS payloads.
- Other agents interact with Datadog only through NATS subjects.
- Datadog host is derived from `DD_SITE`; no fixed tenant URLs are embedded.

## Rate limiting posture

The bridge minimizes API pressure through:

- configurable poll interval (`DATADOG_POLL_INTERVAL_MS`)
- in-memory dedupe for security records
- aggregated metric queries per poll cycle

If rate-limited responses appear, increase poll interval first, then split watcher scope by subject prefix.

## Memory model

The bridge is intentionally mostly stateless.

### In-memory state

- seen IDs for security signals/findings
- previous LLM snapshot for anomaly detection
- poll/error counters per watcher
- watcher running state

### Not persisted

- no disk state
- no external cache
- no replay offsets outside process lifetime

On restart, dedupe state resets and recent records may be re-emitted once.
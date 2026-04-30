# Bot tracker

Live visualization surface for autonomous agents working inside the
guild system. Inspired by `cf-ai-bot-globe` (Cloudflare's globe view of
AI bot crawls), but scoped to the bots that act on Citadel infrastructure
(Bits AI, USO_MCP, Bits Codex, the BITS-CODEGEN seat, IDE coding agents,
GitHub Action workflow bots).

## Routes

| Route             | Description                                                    |
|-------------------|----------------------------------------------------------------|
| `GET /bots`       | HTML dashboard — rotating wireframe globe + live event feed.   |
| `GET /bots/snapshot` | JSON snapshot of known bots + recent events.                |
| `GET /bots/stream`   | Server-Sent Events stream — `snapshot` then `event` frames. |

The dashboard is a single self-contained page (no CDN, no extra
dependencies). The viz is vanilla `<canvas>` 2D — bots are dotted onto
a slowly-rotating wireframe sphere, and each new event triggers a
short-lived ring pulse on the originating bot.

## NATS contract

By default the listener subscribes to `${NATS_PREFIX}.bot.>` (e.g.
`citadel.builder.bot.>`). Override with `BOT_TRACKER_SUBJECTS` to a
comma-separated list when you want to fold in pre-existing event
taxonomies (for example `citadel.bits.>`).

The canonical payload shape is:

```json
{
  "bot_id":   "bits-ai",
  "bot_name": "Bits AI",
  "bot_kind": "agent",
  "action":   "dispatch_received",
  "status":   "active",
  "geo":      { "lat": 30.27, "lon": -97.74 },
  "payload":  { "dispatch_id": "USO-001" }
}
```

Every field except `bot_id` is optional. When the subject follows the
`<prefix>.bot.<bot_id>.<verb>` canon, even `bot_id` and `action` may be
inferred from the subject and the body may be empty.

`bot_kind` is one of `agent | seat | workflow | webhook | unknown`.
`status` is one of `idle | active | error | offline`. Invalid values
silently fall back to defaults — the listener is intentionally lenient
so a malformed publisher never poisons the registry.

Bots without a declared `geo` are placed at a deterministic
pseudo-random lat/lon derived from a hash of their `bot_id`, so the
dashboard stays stable across reloads.

## Quick test (no NATS required)

```bash
npm install
GUILD_PORT=8443 npm run dev
# in another terminal:
curl http://localhost:8443/bots/snapshot
open http://localhost:8443/bots
```

Without `NATS_URL` set, the listener is skipped — the routes still
serve the dashboard and an empty snapshot.

## Wiring real events

Any service can publish to the canonical subject:

```ts
nc.publish(
  'citadel.builder.bot.bits-ai.dispatch_received',
  sc.encode(JSON.stringify({
    bot_id:   'bits-ai',
    bot_name: 'Bits AI',
    bot_kind: 'agent',
    action:   'dispatch_received',
    status:   'active',
    geo:      { lat: 30.27, lon: -97.74 },
    payload:  { dispatch_id: 'USO-MIRROR-SEED-001' },
  })),
);
```

The dashboard updates in real time over SSE.

## Disabling

Set `BOT_TRACKER_DISABLED=1` to start the HTTP routes without
subscribing to NATS (useful for tests and dry-runs).

## Limitations and follow-ups

- **2D viz, not 3D.** Adding three.js or @react-three/fiber would add a
  runtime dependency and is out of scope under the current single-dep
  policy. The Canvas2D wireframe globe is a faithful proof of the data
  pipeline; a 3D upgrade is a follow-up SRS gated on operator approval.
- **In-memory only.** The registry does not persist across restarts.
  A future iteration can plumb the listener output into Supabase or
  the existing memory pipeline once the SRS for that surface lands.
- **No auth.** The dashboard is unauthenticated. If this repo ever
  serves outside `localhost`, gate `/bots*` behind whatever auth the
  rest of the guild client adopts.

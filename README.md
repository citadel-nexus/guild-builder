# Guild: Builder

> *"If it isn't built right, nothing else matters."*

The Builder Guild is Citadel's infrastructure and engineering core. DevOps,
Docker, CI/CD, scaffolding, and the systems that keep every other guild running.
Builders don't ship features — they ship the foundation that features stand on.

---

## Identity

| | |
|---|---|
| **Sigil** | The Hammer and Compass |
| **Vibe** | Relentless. Methodical. The satisfaction of a clean deploy at 2am. |
| **Color** | Steel Blue `#2A5FA5` |
| **NATS Prefix** | `citadel.builder.*` |
| **Port** | `8443` |
| **Parent Guild** | Builder (root) |

---

## Purpose

- Scaffold, maintain, and evolve all 8 guild repositories
- Own **Docker** build pipelines and GHCR image publishing
- Manage **GitHub Actions** CI/CD workflows across the org
- Operate the **CML (Citadel Master Loop)** task queue infrastructure
- Maintain the **guild-sdk** and **guild-template** shared libraries
- Run Cloudflare Enterprise configuration (WAF, DNS, cache rules)

---

## Domains of Operation

### Repo Management
All guild repos follow a standard template maintained by Builder:
```
guild-commerce / guild-intelligence / guild-research / guild-creator
guild-finance  / guild-entertainment / guild-writers
guild-sdk      / guild-template
```

### CML Infrastructure
The Citadel Master Loop runs on the Builder guild's NATS subjects:
```
citadel.builder.cml.task    — Incoming task from queue
citadel.builder.cml.result  — Task execution result
citadel.builder.cml.health  — Loop health heartbeat
```

### Cloudflare Setup Phases
| Phase | Scope |
|-------|-------|
| 1 | DNS + SSL |
| 2 | WAF + rate limiting |
| 3 | Cache rules + page rules |
| 4 | Workers + routing |

---

## Services & Integrations

| Service | Role |
|---------|------|
| **GitHub Actions** | CI: lint → test → build → docker push |
| **GHCR** | `ghcr.io/citadel-nexus/guild-*:latest` |
| **Cloudflare** | DNS, WAF, CDN for all guild services |
| **Datadog** | Infra monitors — NATS lag, error rates |
| **NATS** | `citadel.builder.*`, `cicd.pipeline.*` |
| **Supabase** | `guild_gitlab_projects`, `guild_assessments` |

---

## NATS Event Subjects

```
citadel.builder.deploy.started      — Docker build initiated
citadel.builder.deploy.complete     — Image pushed to GHCR
citadel.builder.scaffold.pushed     — Template push to guild repo
cicd.pipeline.failed                — CI failure (triggers governance)
citadel.builder.infra.health        — VPS + service health beat
```

---

## Mission System

Builder missions reward infrastructure reliability, successful deploys, and system quality.

| Mission | Description | XP | Unlock |
|---------|-------------|-----|--------|
| First Scaffold | Scaffold a new guild repo via guild_tools | 100 | Default |
| CI All Green | All 4 CI stages pass (lint → test → build → docker) | 150 | Default |
| Docker Published | Push a guild image to GHCR successfully | 200 | Default |
| CF Phase Complete | Complete a Cloudflare setup phase | 300 | Architect rank |
| Zero Downtime | Zero unplanned outages for 30 days | 500 | Architect rank |
| SDK Release | Cut a new guild-sdk version | 400 | Architect rank |
| CML Throughput | Process 100 CML tasks in a single sprint | 350 | Engineer rank |

**Daily missions (reset 00:00 UTC):**
- Emit a `citadel.builder.deploy.complete` event — 25 XP
- Pass a NATS health check — 25 XP

Builder guild CAPS scores are weighted toward **reliability** (P axis) and **execution** (A axis).
High CAPS unlocks autonomous deployment authority in the CML loop.

---

## Guild Expectations

**Members:**
- Monitor CI status daily — failures require a comment within 2 hours
- Maintain CAPS composite score ≥ 0.70 for deploy authority
- Complete Builder onboarding (CML + Docker primer) within 7 days of placement
- Engage in `#infra-ops` and `#deploy-log` lobby channels

**Contributors:**
- All infrastructure changes require a rollback plan documented in the PR
- Docker images must pass `docker scan` with no critical CVEs
- Cloudflare config changes must go through the `cf-setup` dry-run first
- Code review turnaround: 24 hours for infra-critical changes

**Guild Lead (Chief Architect):**
- Daily CML health check posted to `#announcements`
- Coordinate cross-guild deployments with affected guild leads
- Own the guild-sdk roadmap and semver releases

---

## Contributing

**Branch naming:**
```
feat/<srs-code>/<short-description>
fix/<srs-code>/<short-description>
infra/<srs-code>/<short-description>
```

**PR checklist:**
- [ ] SRS code referenced (e.g., `SRS: BLD-CML-005`)
- [ ] `npm test` passes + `docker build` verified locally
- [ ] Rollback procedure documented for infra changes
- [ ] `.env.example` updated if new env vars required
- [ ] NATS stream definitions updated if new subjects added

**Commit format:** `<type>(<srs-code>): <description>`
Example: `infra(BLD-CML-005): add NATS JetStream consumer for cml.task`

**SAKE compliance:** New automation modules require a `.sake` file stub.
See [guild-sdk](https://github.com/citadel-nexus/guild-sdk) for the format.

---

## Getting Started

```bash
npm install
cp .env.example .env
# Fill only the environment values you actually use for local development
npm run dev
```

Tested baseline:
- Node.js 18+
- npm 9+

Useful local checks:

```bash
npm run lint
npm test
npm run build
```

## Environment Variables

```
NATS_URL=nats://<your-nats-host>:4222
NATS_TOKEN=<optional-token>
SUPABASE_SERVICE_ROLE_KEY=<key>
GUILD_PORT=8443
GUILD_NAME=builder

# Tenant provisioning orchestrator (off by default)
PROVISION_ORCHESTRATOR=off
PROVISION_INBOUND_SUBJECT=
PROVISION_OUTBOUND_PREFIX=
```

---

## Tenant Provisioning Orchestrator (public spine)

`src/provision/` is the public spine of dispatch
**TENANT-PROVISION-FABRIC-001 §6**. It runs the per-tenant provisioning
pipeline as an ordered list of pluggable `Stage`s, with idempotency and
NATS event emission baked in. Vendor-specific stage bodies (Cal.com,
Mautic, Twenty, Customer.io, email-bank, tenant-agent, tenant-mcp,
cockpit-ui, workflow-mesh) live in CNWB on private GitLab — this repo
exposes the contract they bind to.

Public PRs are welcome against:
- The `Stage` interface and orchestrator behavior
- The `IdempotencyStore` contract and alternative implementations
- The `SubjectFormatter` and additional subject conventions
- New stub stages or test helpers

```ts
import {
  ProvisionOrchestrator,
  defaultStageRegistry,
  InMemoryIdempotencyStore,
  type Stage,
} from '@citadel-guilds/builder/provision';

const myStage: Stage = {
  name: 'calcom',
  run: async (ctx) => ({ status: 'ok', data: { orgId: '...' } }),
};

const orchestrator = new ProvisionOrchestrator({
  stages: [myStage, ...defaultStageRegistry().slice(1)],
  idempotency: new InMemoryIdempotencyStore(),
  publish: (event) => console.log(event.kind, event.tenantId, event.stage),
});

await orchestrator.run({ tenantId: 'bcx', industry: 'cosmetology', tier: 'growth' });
```

Activate the inbound/outbound NATS bridge at process start by setting
`PROVISION_ORCHESTRATOR=on` and providing the inbound subject + outbound
prefix from your operator subject canon — the spine never hardcodes
either.

## Builder → Research signal pipe

Use the optional research signal pipe to forward Builder telemetry events
into a Research guild namespace for experiment evaluation automation.

Set:
- `RESEARCH_SIGNAL_PIPE=on`
- `RESEARCH_PIPE_INBOUND_SUBJECT=<builder telemetry subject>`
- `RESEARCH_PIPE_OUTBOUND_PREFIX=<operator prefix>`
- Optional overrides: `RESEARCH_PIPE_SOURCE_GUILD`, `RESEARCH_PIPE_TARGET_GUILD`, `RESEARCH_PIPE_NAMESPACE`

The pipe subscribes to the configured inbound subject, enriches each payload
with forwarding metadata, and republishes under:
`<RESEARCH_PIPE_OUTBOUND_PREFIX>.<target_guild>.<namespace>.<event_type>`

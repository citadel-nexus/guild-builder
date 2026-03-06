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

## Getting Started

```bash
npm install
cp .env.example .env
# Fill GITHUB_TOKEN, CF_API_TOKEN, CF_ZONE_ID
npm run dev
```

## Environment Variables

```
NATS_URL=nats://147.93.43.117:4222
GITHUB_TOKEN=<ghp_...>
CF_API_TOKEN=<key>
CF_ZONE_ID=<id>
SUPABASE_SERVICE_ROLE_KEY=<key>
GUILD_PORT=8443
```

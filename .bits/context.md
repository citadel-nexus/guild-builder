# Citadel Nexus — Builder Guild · Standing Brief

> Refresh this file whenever a PR lands or a blocker shifts. Agents read
> it at session start to avoid cold-starting against stale assumptions.

## Repo scope (always)

This repo is the **public funnel** into CNWB. The source of truth for
Citadel Nexus application code lives at `gitlab.citadel-nexus.com/guilds/CNWB`.
This repo holds only what is safe to expose for community contribution:
the orchestrator spine, stage interface, and supporting test fixtures
for `TENANT-PROVISION-FABRIC-001` §6.

If a request requires writing vendor stage bodies, secrets, Vault wiring,
Council-gated material, or anything carrying tenant credentials, **stop**
and tell the operator — that work belongs on GitLab, not here.

## This week

- **Active SRS:** `SRS-PROVISION-ORCHESTRATOR-001` — complete, merged in
  PR #6 (`tenant-provision-orchestrator-types` → `main`).
- **Parent dispatch:** `TENANT-PROVISION-FABRIC-001` (§6 — orchestrator
  spine = this repo's surface).
- **Repo state:** spine + 9-stage stub registry + NATS bridge + auto-start
  + 7 vitest files all merged. CI gates `npm run lint` + `npm test`.
- **SRS-DATADOG-BRIDGE-001** — in progress (Datadog NATS bridge: monitor
  watcher, security, LLM observer, automation, integrations)
- **SRS-NEXUS-TAMAGOTCHI-001** — in progress (Stage 1: core types, progression,
  audit trail, council stub, 50+ badges, 28 professors, 6 skill trees)
- **Vault Client spine** — added to `src/agents/shared/` for runtime credential
  resolution from Supabase Vault
- **Auto-merge pipeline** — enabled for bot PRs (CI green → auto-squash-merge)

## In flight (NOT in this repo)

These belong in CNWB / private GitLab — flag them and stop if a request
tries to land them here:

- Per-vendor stage implementations: Cal.com, Mautic, Twenty, Customer.io,
  email-bank (Stalwart MTA + DKIM/SPF/DMARC), tenant-agent, tenant-mcp,
  cockpit-ui, workflow-mesh — all consume the Stage contract from
  `src/provision/types.ts` here, but their bodies live on GitLab
- A2A bridge between this GitHub repo and `gitlab.citadel-nexus.com/guilds/CNWB`
  — separate repo (`cnwb-mirror`), separate dispatch
- Any USO-MEMORY-SUBSTRATE work (memory-as-repo with bus-tap handler,
  Vault-sourced PAT, CK stamping) — CNWB-side, not here
- Any Cal.com / Mautic / Twenty / Customer.io / Stripe / Gumroad
  credential, URL, or org-id

## Recent corrections

- The full TENANT-PROVISION-FABRIC-001 dispatch is **not** single-PR scope
  for this repo. PR #6 lands the §6 spine. Sections §1–§5 and §7+ are
  CNWB-side.
- "AGENTS.md vs CLAUDE.md" — both must hold the same content. CLAUDE.md
  is not a pointer; some tools do not follow internal links.
- Subject formatter must keep dispatch §A.5/§F.1 default canon. Alternate
  formatters are *additions* (configuration-time overrides), never
  replacements of the default.

## Blockers

None inside this repo. Out-of-scope blockers (Council-gated master-token
mints for Cal.com EE, Lazarus MCP suspension windows, Supabase Vault
entries, Cloudflare DNS/DKIM autoprovisioning) all live on the CNWB side
and are not actionable from here.

## Sandbox limitations to remember

- The Bits / Claude Code sandbox does not have internet egress. `npm install`
  fails (`EAI_AGAIN`). Static audits are required when `tsc` / `vitest`
  cannot run locally; CI is the ground truth.
- Do **not** attempt to bypass with offline mirrors, vendored binaries,
  or `npm install --offline` against an empty cache. Trust CI.

## Convergence note (informational)

A separate work stream is consolidating context between this public repo,
CNWB on GitLab, and the per-IDE Claude sessions (Notion / IDE4). The
contract is the 5-file shared surface: `AGENTS.md` + `CLAUDE.md` +
`.bits/srs_registry.yml` + `.bits/context.md` + `.sake_ops/taskir/<srs>.yaml`.
This repo holds its slice. CNWB and `cnwb-mirror` will hold theirs.

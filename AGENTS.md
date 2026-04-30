# Citadel Nexus — Builder Guild · Agent Bootstrap

> **Read this file at session start.** It is the shared surface every agent
> (Anthropic Claude Code, Datadog Bits Dev, USO_MCP, public contributors)
> uses to operate inside this repository without a cold-start.

## Repo identity

- **Repo:** `github.com/citadel-nexus/guild-builder`
- **Role:** *public funnel* into CNWB. Sections of CNWB safe to expose for
  community contribution land here; this repo is **not** the source of
  truth for application code.
- **Source of truth (private):** `gitlab.citadel-nexus.com/guilds/CNWB`.
- **Guild:** Builder. NATS prefix `citadel.builder.*`. Default port 8443.

If a user request requires changes outside this repo (vendor provisioners,
Stalwart MTA, Cal.com EE wiring, secrets, Vault, Council-gated work,
CGRF-restricted paths), **stop and tell the user** — those belong on
GitLab, not here.

## Read before editing

Always inspect, in order:

1. `AGENTS.md` (this file) — operating rules
2. `.bits/srs_registry.yml` — every SRS code → file paths + status
3. `.bits/context.md` — what's in flight this week, blockers, corrections
4. `.sake_ops/taskir/<srs>.yaml` — task graph for the SRS you're touching
5. `README.md` + `CONTRIBUTING.md` — public-facing house rules
6. `.github/PULL_REQUEST_TEMPLATE.md` — required PR shape

## CGRF — hard NO (refuse and escalate)

Refuse to write code or docs that:

- Import from `@citadel-nexus/core` or any private CNWB package
- Hardcode NATS subjects (use injected publisher / formatter, env-driven prefix)
- Hardcode Supabase URLs or any vendor URL bound to a tenant
- Embed secrets, tokens, or anything matching `KP-*`, `glpat-*`, `sk_live_*`,
  `cfut_*`, or any `Authorization: Bearer …` literal
- Add a runtime dependency without operator approval (single-dep policy:
  this repo currently uses `nats` and only `nats`)
- Touch CGRF-protected paths from CNWB conventions if any are mirrored here
  (none today, but the protection is permanent)

If a request asks for any of the above, refuse the operation and surface
the refusal in your response so the operator can re-route it to CNWB.

## Coding conventions

- **TypeScript, strict, NodeNext, ES2022.** No `any`, no `as` casts unless
  the upstream type is genuinely opaque (document why with a comment).
- **Subjects come from configuration.** Never literal-string a NATS subject
  in production code. Tests may use literal subjects in fixtures.
- **No comments that explain what changed.** Comments describe behavior,
  not history.
- **SAKE stub for new modules.** Every new top-level `src/<module>/` ships
  with a `.sake` file describing inputs / outputs / SRS coverage.
- **Tests live in `tests/<module>/`.** Vitest, one file per concern.
- **Format / Lint** must pass: `npm run lint` (`tsc --noEmit`) and
  `npm test` (`vitest run`). The CI job at `.github/workflows/ci.yml`
  enforces this.

## NATS subject canon (this repo)

This repo emits and consumes only its own subject prefixes; it never
hardcodes others.

- `citadel.builder.*` — guild's own subject space (existing scaffold)
- `${PROVISION_OUTBOUND_PREFIX}.<tenant>.provision.<stage|started|complete|failed>.<outcome>`
  — composed at runtime by `src/provision/subject-formatter.ts` from the
  configured prefix; matches dispatch `TENANT-PROVISION-FABRIC-001` §A.5/§F.1

The inbound subject the provision orchestrator reacts to is **always**
read from `PROVISION_INBOUND_SUBJECT` — never literal in code.

## Active SRS in this repo

| SRS | Status | Surface |
|-----|--------|---------|
| `SRS-PROVISION-ORCHESTRATOR-001` | complete (PR #6) | `src/provision/` |

See `.bits/srs_registry.yml` for the full per-SRS file list, dependencies,
and dispatch references.

## Public contribution invariants

When a public PR lands against `src/provision/` or sibling spine modules,
verify:

- Stage interface contract is preserved (no breaking change to `Stage`,
  `StageResult`, `ProvisionEvent`)
- New stages provide a stub via `makeStubStage` or implement the full
  `Stage` interface — do **not** call vendor APIs from this repo
- `IdempotencyStore` implementations are pure (no I/O without an explicit
  config + injection point)
- Subject formatter changes preserve dispatch `TENANT-PROVISION-FABRIC-001`
  §A.5/§F.1 default canon; alternates are additions, not replacements

## VCC dispatch posture

Code-edit work on `src/` requires an active VCC dispatch row before merge.
For this repo, the parent dispatch is `TENANT-PROVISION-FABRIC-001`
(provisioning fabric, §6 = orchestrator spine = this repo's surface).
Pure docs / `.bits/` / `.sake_ops/` updates do **not** require a dispatch.

## When in doubt

- If you cannot determine whether a change belongs in this public repo or
  in CNWB, default to **not changing it here** and tell the user.
- If a tool call would require a credential or a vendor URL, default to
  **refusing** and ask the operator to route the work into CNWB.
- If the user pastes a multi-phase dispatch (e.g. `TENANT-PROVISION-FABRIC-001`
  in full), only act on the slice that fits this repo's surface.

## Cross-tool compatibility

This file is mirrored by `CLAUDE.md` for Anthropic Claude Code. Edit them
together. Datadog Bits Dev reads `AGENTS.md` automatically.

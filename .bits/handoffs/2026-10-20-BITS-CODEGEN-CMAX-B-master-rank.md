<!--
# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/handoffs/2026-10-20-BITS-CODEGEN-CMAX-B-master-rank.md
# Stage:       11_COMMIT
# SRS:         SRS-CN-BUILDER-INTEGRATION-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-BUILDER-INTEGRATION-001
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md
# EnumType:    Doc
# EnumEdges:   DEPENDS_ON .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md
# DAG Node:    none
# Intent:      Separate observed public capabilities from missing private authority, durable delegation and independent verification across all eight masters.
# ───────────────────────────────────────────────────────────────
-->

# Master-rank convergence handoff

From: BITS-CODEGEN. To: CMAX-B (platform bindings), IDE1 (existing CNWB workspace),
USO_MCP (dispatch admission), Forge (mission owner), Oracle (independent peer).
Requested SRS: SRS-CN-GUILD-MASTER-RANK-001. Priority: P0.
Local delivery: SRS-CN-BUILDER-INTEGRATION-001 / DISP-BUILDER-INTEGRATION-001.
Status: **PARTIAL** discovery; **HOLD** on master-owned execution and release.

The authenticated operator supplied the master-rank objective during consolidation
of Builder PRs #8, #9, #16 and #26. This handoff preserves that objective without
creating a second mission engine, an authority service, or replacement guildmasters.
It is a public review artifact, not a registered CSCC mission or VCC receipt.
No external dispatch or authority lease was created. The private CNWB repository
could not be attached: this coding session supports GitHub repositories only.
No GitLab MR number has been verified; the four identified inputs are GitHub PRs.

## Existing components and missing bindings

| Component inspected | Reusable surface | Binding required before master execution |
| --- | --- | --- |
| GOVERNANCE.md and .github/CODEOWNERS | Forge charter; confirmed Builder owner team and App identity | Validate actual App installation/repository permissions and team access; team membership is not App authorization |
| src/agents/datadog-bridge/integrations/gitlab.ts | Configured-subject GitLab pipeline events forwarded to Datadog | This is telemetry forwarding, not a GitLab runner or MR control client |
| src/agents/nexus-tamagotchi/integration-router.ts | Injected IntegrationPolicyMatrix and ledger interfaces | Existing optional policy hook fails open on absence/error; it must not serve as the master mutation boundary. Bind the existing external NNC/AAXP decision service with fail-closed enforcement in CNWB |
| src/agents/nexus-tamagotchi/authority.ts | Local XP-based progression checks | XP/rank must never grant provider permissions or stand in for NNC authority |
| src/agents/nexus-tamagotchi/missions.ts and ags-cognition-engine.ts | Public mission/packet models and local outcome analysis | Existing process-local queues and completion flags are not durable CSCC jobs, revocable leases, or VCC verification |
| src/provision/idempotency.ts | Injected IdempotencyStore contract | In-memory storage does not survive restart or guarantee atomic reservation across workers; bind existing durable admission/idempotency storage |
| Mira/AGS learning and GuardianAuditTrail | Local memory, bounded outcomes, detached evidence, trusted-head hash checks | Connect existing Tavern/NXC/College ingestion and authenticated receipts; local hashes are not CK signatures or independent verification |
| .github/workflows/provenance.yml | Signed artifact archive, source/workflow verification and tamper rejection | A build attestation proves build provenance, not mission authorization, deploy approval or TEVV success |
| CNWB workspace, NNC/AAXP, CSCC queues, VCC and recovery procedures | Not available in this repository | Locate their actual interfaces in CNWB before implementation; do not invent endpoints, permission names, schemas, or authority epochs |

## Available tool schemas and observed reads

The session exposed these read tools. Inputs below are actual tool schema fields,
not native Datadog permission names. No provider RBAC export or App scope inventory
was available, so **all provider permission mappings remain HOLD** pending validation.

| Abstract action requested | Available tool | Inputs used | Evidence and limit |
| --- | --- | --- | --- |
| incidents.read | mcp__datadog__search_datadog_incidents | query, max_tokens, telemetry.intent | VERIFIED Bits-session read; no matching active incident; no Forge delegation |
| monitors.read | mcp__datadog__search_datadog_monitors | query, include_tags, max_tokens, telemetry.intent | VERIFIED Bits-session read; current GitLab/runner monitor state returned; no write permission demonstrated |
| repositories.read / review inventory | Repository-scoped gh pr list and local source refs | state, limit, number/title/headRefName/headRefOid/url fields | VERIFIED for guild-builder only; no organization-admin, cross-repository or GitLab access implied |
| logs.query / apm.query / pipelines.read / merge_requests.create | No master binding exercised | None | HOLD until CNWB resolves exact tools, principal, native permissions, resource filters and evidence sinks |

Read evidence collected on 2026-10-20 UTC:

- 17:59:55.001: incident query `state_category:live AND (team:guild-builder OR title:*gitlab* OR title:*runner*)`
  returned zero matches. Tool round trip: 294 ms.
- 18:00:33.718: monitor query `title:gitlab OR title:runner` returned ten monitors,
  all reporting OK. Runner availability monitor 22729359 and GitLab availability
  monitor 22729354 were included. Tool round trip: 291 ms.
- Successful delegated operations: none. Failed delegated operations: none
  attempted. Two successful direct Bits read calls are recorded above.
- These are query results at collection time, not a time-series health guarantee,
  proof that all incidents were indexed, or an actual runner job completion check.
  No current failing mission was established; no repair was attempted.
- Raw monitor configuration, internal runbooks and credentials are omitted from
  this public handoff. Exact queries and monitor IDs permit an authorized seat to
  repeat the reads. Query timing is client-observed, not provider execution latency.
- Cloud resources purchased: none. Actual provider/model cost and total mission
  latency: **UNMEASURED**. No independent VCC result, mission lease, trace, or
  provider mutation receipt exists for this work.

## Per-guild readiness matrix

Master names and responsibilities come from the operator's directive. Except for
the stated Builder identities, native account IDs, charters and effective scopes
have not been verified. Proposed platform coverage is not connected access.

| Guild / existing master | Known identity or intended platform coverage | Verified available master capabilities / operations | Missing binding and required next action | Receipts / independent TEVV / cost and latency | State |
| --- | --- | --- | --- | --- | --- |
| Builder / Forge | GitLab @forge; GitHub @citadel-nexus/guild-builder; forge-builder-guildmaster App; Datadog guild-builder team, operator-confirmed | None as Forge; two direct Bits read calls above | Resolve charter version, App installation, native Datadog scopes, GitLab runner access, NNC lease and CSCC queue; admit reference mission | Local source/test artifacts only; TEVV HOLD; mission cost/latency UNMEASURED | PARTIAL |
| Intelligence / Oracle | Intended Datadog security, Sentinel, NXC, logs/traces | None exercised; successful/failed delegated calls: 0/0 | Resolve existing identities and authorize an independent investigating/verification role, separate from Forge's worker | No mission/artifact receipt; TEVV HOLD; cost/latency UNMEASURED | HOLD |
| Finance / Sterling | Intended Stripe, ledger and cost analysis | None exercised; successful/failed delegated calls: 0/0 | Bind existing charter and read/reconciliation scopes; retain spending and financial approval gates | No mission/artifact receipt; TEVV HOLD; cost/latency UNMEASURED | HOLD |
| Commerce / Alex | Intended Twenty, Mautic, catalog and PostHog | None exercised; successful/failed delegated calls: 0/0 | Resolve existing identity and approved fulfillment tools; gate checkout and service mutations | No mission/artifact receipt; TEVV HOLD; cost/latency UNMEASURED | HOLD |
| Research / Scholar | Intended NXC Corpus, PostHog Evals and College | None exercised; successful/failed delegated calls: 0/0 | Bind dataset/evaluation scopes and evidence provenance; Research signal pipe alone grants no access | No mission/artifact receipt; TEVV HOLD; cost/latency UNMEASURED | HOLD |
| Creator / Muse | Intended media pipeline, R2 and analytics | None exercised; successful/failed delegated calls: 0/0 | Resolve existing resource/bucket scopes, approved workers, spend and publication gates | No mission/artifact receipt; TEVV HOLD; cost/latency UNMEASURED | HOLD |
| Writers / Quill | Intended wiki, docs, GitLab and publishing | None exercised; successful/failed delegated calls: 0/0 | Resolve existing identities and draft/review/publication capabilities | No mission/artifact receipt; TEVV HOLD; cost/latency UNMEASURED | HOLD |
| Entertainment / Director Nexus | Intended Discord, LiveKit and BuildAndDo | None exercised; successful/failed delegated calls: 0/0 | Resolve channel/room/activity scopes and human revocation controls | No mission/artifact receipt; TEVV HOLD; cost/latency UNMEASURED | HOLD |

## Required CNWB implementation

1. Extend each existing guild registry entry with its master-rank profile and
   charter reference. Resolve canonical IDs from that registry; do not create new
   guildmaster accounts. Preserve the guildmasters parent and existing child teams.
2. Resolve each proposed action to an actual tool schema, installed principal,
   native provider permissions and resource selectors. Record schema/version
   digests and effective scope evidence. Missing mappings deny execution.
3. Use the existing NNC/AAXP broker for scoped, expiring authorization. The
   authority service supplies the epoch and revocation state. Revalidate at the
   worker boundary and before every retry; the planner cannot mint a lease,
   approve itself, add scopes, or turn a failed policy lookup into permission.
4. Use existing CSCC durable queues and idempotency reservations for delegation.
   Correlate mission, action, retry, tenant, master, delegated actor, trace, source
   commit, tool schema digest, lease/approval and evidence IDs in durable receipts.
   Preserve each contributor's identity across Bits and other workers.
5. Bind existing VCC/College verification. Completion requires an independently
   issued result over the actual artifact digest and source commit. Reject missing,
   stale, mismatched or self-issued receipts. Learning can suggest corrections;
   promotion of policy or privilege remains a separate human-controlled action.
6. Extend the existing CNWB guildmaster workspace with actual workers/tools,
   leases, queue state, denied actions, platform health, cost and deliverables.
   This repository's bot feed is an observation scaffold, not that control UI.
7. Preserve operator recovery: deny new admissions after emergency revocation,
   stop/reconcile pending work through the existing controls, and require a fresh
   authorized epoch/lease before resumption. Document the actual recovery procedure
   after inspecting CNWB, without adding a parallel revocation mechanism.

## Reference mission and release evidence

USO_MCP must first admit a real Forge-owned mission against an identified current
incident or an explicitly approved staging failure exercise. Use Oracle as the
independent peer, with VCC determining completion. If service is healthy, record
that observation; do not manufacture a live incident to satisfy the gate.

| Gate / test to execute in authorized staging | Required observed result | Current evidence |
| --- | --- | --- |
| Successful diagnosis → delegated change → build → VCC | Actual incident evidence, worker artifact/MR, new pipeline jobs starting and finishing, independent receipt bound to artifact/source | HOLD: no admitted mission, private GitLab binding or VCC verifier |
| Wrong principal, tenant, resource, capability or tool schema | Denial before provider invocation; auditable denial without exposing credentials | HOLD: must test actual NNC/provider adapter |
| Missing/expired approval or policy service outage | Fail closed; no mutation and no self-issued approval | HOLD: public optional policy hook is insufficient |
| Authority revoked after enqueue / before retry | Old queued work and stale epoch denied; human recovery issues a fresh lease | HOLD: external epoch/revocation service unavailable |
| Duplicate delivery, concurrent retries, worker crash/restart | Existing durable reservation prevents duplicate side effects; ambiguous outcomes reconciled with provider receipt | HOLD: local outcome deduplication is not execution idempotency |
| Artifact modified, truncated audit, wrong source digest or self-verification | Evidence rejected and mission remains incomplete | PARTIAL: local tamper/truncation tests pass; signed build tamper check runs in CI; independent mission verification unavailable |
| Learning replay, corrupt record, restart or caller mutation | Evidence counts stay bounded/accurate; malformed rows rejected; no policy/permission promotion | PARTIAL: native local learning regression tests pass; College promotion gate unbound |
| Budget exceeded, denied admin capability or production action | Existing broker denies unapproved spending/privilege/production mutations | HOLD: no external budget or provider policy test performed |

No release claim should change to VERIFIED solely because a profile is configured,
a tool is listed, a prompt was forwarded, a local completion flag is set, or this
handoff was written. Attach real receipts and measured cost/latency before promoting
Forge/Oracle, then repeat the same contract for the remaining six guildmasters.

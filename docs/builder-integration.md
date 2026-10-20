<!--
# ─── CGRF Header ───────────────────────────────────────────────
# File:        docs/builder-integration.md
# Stage:       06_PLAN
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
# Intent:      Explain source-review coverage, failure semantics, evidence limits, verification and rollback for the consolidated system.
# ───────────────────────────────────────────────────────────────
-->

# Builder operations, learning and audit integration

This follow-up consolidates the remaining work from four open PRs onto main after
PR #34. It preserves Forge's confirmed ownership and the signed archive workflow.
Source PRs remain open until maintainers decide how to close superseded reviews.

| Source PR | Frozen head | Integrated surface |
| --- | --- | --- |
| #8 | e0ff35c2274b81788fd784a36f5a94f06d4b6541 | Bot tracker, sentinel HTTP ingestion, SSE and tests |
| #9 | 66c95a0ec76fe87f8c50e0ff00af340d3cbb3fb7 | Opt-in Builder-to-Research signal pipe and tests |
| #16 | ce183cde28985d2db1af5e6a655f68a923674caa | Mira memory, AGS cognition, exports, docs and tests |
| #26 | cd4ddfd2957276ac43fdcd4239d234e3ecf1a90e | Opportunity-terms capability and experimental manifest |

Most of #16's foundation is already on main. Only its remaining engines, metadata,
and overlap repairs are brought forward. Datadog, provisioning and Tamagotchi
startup remain wired; duplicate startup/type fragments are repaired, preserving
main's boundary-aware intent/reflex behavior and explicit export disambiguation.

Frozen source heads and per-path dispositions are recorded in
`.bits/out/DISP-BUILDER-INTEGRATION-001/source-prs.json`. The source counts are
21 paths for #8, 7 for #9, 135 for #16 and 2 for #26; 119 of #16's paths were
already present on the integration base. These counts describe source coverage,
not the number of files changed by this follow-up.

The operator's master-rank directive is carried forward in
`.bits/handoffs/2026-10-20-BITS-CODEGEN-CMAX-B-master-rank.md`, including the
eight-guild readiness matrix, available read tools, observed query results and
required negative tests for external authority and durable execution. Private
CNWB bindings and independent TEVV remain HOLD. The imported local mission,
policy, memory and bot-view scaffolds do not establish platform authority.

## Operational contract

- Bot ingestion enforces a configured BOT_TRACKER_INGEST_TOKEN. As in #8, leaving
  it unset permits anonymous ingestion; configure it before exposing the endpoint.
  Oversized bodies return HTTP 413 without buffering the entire request or recording
  an event. The route still serves valid requests afterward.
- Registry inputs, event listeners and snapshots receive detached data, so a UI
  consumer cannot rewrite another observer's event evidence. This is a bounded
  in-memory view, not a durable security-event store.
- Research forwarding rejects non-object payloads, logs publish/subscription
  failures, preserves correlation fields and allows explicit restart. Stop waits
  for consumption to settle and discards pending work. Core NATS is at-most-once;
  this change does not add durable retry or exactly-once delivery.
- Existing runtime switches remain configurable; the research pipe is off unless
  RESEARCH_SIGNAL_PIPE=on. No real NATS, vendor, or production connection is tested.

## Learning and audit contract

AGS outcomes are deduplicated by packet ID within the retained window. Repeated
feedback replaces the previous rating; non-finite ratings are rejected. Stats
reflect retained outcomes rather than mixing lifetime totals with a bounded
sample. Restart validates required and optional evidence fields, enforces retention,
and recomputes stats instead of trusting saved counters. Repeated persisted packet
IDs keep their last occurrence before retention is applied. Outcome saves replace the file atomically on the
same filesystem; this is not a multi-writer store or an fsync durability guarantee.

Outcome getters return copies, so callers cannot turn failure evidence into a
success. Mira's restart test retains valid earlier JSONL records when the final
record is incomplete; a corrupted trailing record is not silently treated as a
successful memory entry. The engines remain public local scaffolds; separate
storage instances are required for separate tenants. No production memory ingest
or automatic policy activation is added.

Local GuardianAuditTrail entries now hash an unambiguous JSON array of fields,
and callers receive detached records. verifyChain(entries, expectedHead) detects
truncation as well as edits when expectedHead comes from a separately trusted
checkpoint. Without that checkpoint, trailing truncation cannot be detected.
These are local SHA-256 links, not CK signatures or authenticated external stamps.
Previously exported pipe-delimited audit hashes require the prior verifier;
this change does not silently migrate or authenticate those historical exports.

The opportunity verifier handles common USD fee forms, retains exact evidence
quotes, recognizes conjugated rights phrases and gives assignment evidence
precedence over licensing. It rejects empty/non-string input. Supported phrases
are a limited extraction vocabulary: absence of a match does not mean free entry,
retained rights, or automatic admission. Human review remains necessary for
conflicting, negated, unusual or unsupported legal language/currencies.

## Repeatable checks

```bash
npm run lint
npm test
npm run build
npm run test:operations
python3 capabilities/opportunity_terms/terms_verifier.py --selftest
python3 -m mypy --strict capabilities/opportunity_terms/terms_verifier.py
```

Existing Vitest suites from the four sources are retained. The supplemental
native Node checks run against compiled dist output and exercise real local HTTP
handling plus injected NATS subscriptions. Python's standard-library unittest
covers fee/rights evidence. No new npm dependency is introduced. The native suite
uses .checks.mjs names so Vitest does not try to collect node:test suites.

If dependencies are unavailable, Node 24 can run the same supplemental tests with
`node --disable-warning=ExperimentalWarning tests/integration/sandbox-runner.mjs`.
It transforms TypeScript into a temporary directory and removes it after the
tests. This exercises runtime behavior without substituting for TypeScript
type-checking, the production build, or the existing Vitest suites.

Both CI build and provenance-build run the operational suite after compilation.
The signed archive includes the compiled TypeScript, Python capability, manifest,
package metadata, lockfile and license; Python bytecode caches are excluded.
Signing remains restricted to canonical main pushes in its isolated job.

## Review and rollback

Review the four source surfaces and their runtime enablement together. Revert this
integration PR through normal review to return to the post-#34 baseline. Runtime
consumers that exported new audit chains must retain the matching verifier;
private-stack deployment, GitHub settings, external memory and capability registry
admission remain separate operational actions.

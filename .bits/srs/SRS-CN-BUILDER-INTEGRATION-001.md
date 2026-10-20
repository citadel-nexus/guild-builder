<!--
# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md
# Stage:       04_HYPOTHESIZE
# SRS:         SRS-CN-BUILDER-INTEGRATION-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-BUILDER-INTEGRATION-001
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .bits/queue/DISP-BUILDER-INTEGRATION-001.md
# EnumType:    Doc
# EnumEdges:   GATES .bits/queue/DISP-BUILDER-INTEGRATION-001.md
# DAG Node:    none
# Intent:      Define acceptance for consolidating four Builder reviews with failure recovery, trustworthy learning evidence and a bounded CNWB handoff.
# ───────────────────────────────────────────────────────────────
-->

# Builder operations, learning and audit consolidation

SRS: SRS-CN-BUILDER-INTEGRATION-001
Dispatch: DISP-BUILDER-INTEGRATION-001
Status: in_progress
Seat: BITS-CODEGEN; mode: staging
CKS target: B+/75; CAPS target: B+; measured CKS/CAPS/CK: pending

## Operator authorization

Authenticated operator Dmitry Richard requested identification and enhancement of
related PRs, then explicitly directed: "all of them bring them into the next one".
This authorizes consolidating Builder PRs #8, #9, #16 and #26 in one follow-up PR,
with operational, learning and audit tests. This local integration record extends
the prior bootstrap work; it does not assert an external VCC row or approval.
The umbrella SRS captures this explicitly combined scope while source SRS metadata
and source PR references are retained. No production or private GitLab work,
settings changes, source-PR closure, publication, or secrets are performed here.

## Acceptance criteria

1. Base the new review on main after merged governance PR #34.
2. Bring all four PR capabilities, tests and docs forward; retain newer main
   integrations and avoid duplicating the already-merged Tamagotchi foundation.
3. Exercise research subscriber failure/restart and stop behavior, payload/publish
   failures, HTTP ingestion limits/authentication, and event evidence isolation.
4. Keep outcome/feedback counts accurate under replay, eviction and restart;
   protect learning evidence from mutation and invalid persisted rows.
5. Detect audit edits and truncation against a separately trusted head; use an
   unambiguous serialization for new local hash-chain entries. Do not touch CK signing.
6. Extract fee/rights evidence correctly for the Python capability and retain exact
   source quotes; ambiguous/unsupported language remains for human review.
7. Commit repeatable tests and gate both CI build and archive provenance on them.
   Report unavailable checks accurately. Keep the existing main-only signing gate.
8. Carry the subsequent SRS-CN-GUILD-MASTER-RANK-001 directive into a concrete
   CNWB handoff: component inventory, eight-guild matrix, verified read evidence,
   missing authorization/queue/UI bindings, and independent release tests. Do not
   claim Forge delegation or VCC completion from local tests or direct Bits reads.

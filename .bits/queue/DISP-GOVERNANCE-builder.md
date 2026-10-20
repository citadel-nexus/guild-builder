<!--
# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/queue/DISP-GOVERNANCE-builder.md
# Stage:       11_COMMIT
# SRS:         SRS-CN-BUILDER-GOVERNANCE-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-GOVERNANCE-builder
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .bits/srs/SRS-CN-BUILDER-GOVERNANCE-001.md
# EnumType:    ConfigDoc
# EnumEdges:   DEPENDS_ON .bits/srs/SRS-CN-BUILDER-GOVERNANCE-001.md
# DAG Node:    none
# Intent:      Record operator authorization and bounded staging tasks for Builder governance.
# ───────────────────────────────────────────────────────────────
-->

# DISP-GOVERNANCE-builder

- status: in_progress
- srs: SRS-CN-BUILDER-GOVERNANCE-001
- operator: Dmitry Richard (mr.nobody@citadel-nexus.com)
- seat: BITS-CODEGEN
- mode: staging
- authorization_source: authenticated operator directive through Bits AI,
  2026-10-20: "create those", followed by explicit authorization to bootstrap
  missing prerequisites and create this SRS/dispatch for governance and provenance.
- external_vcc_status: not queried or changed; local bootstrap authorization only
- memory_brief: supplied conversation contains no governance prior art or issue
  Memory Brief; no external memory recalled

## Task table

| Phase | Task | Gate |
| --- | --- | --- |
| A | Register SRS, local dispatch, TaskIR, standing context | Local records agree on SRS, dispatch, staging bounds |
| B | Charter, code ownership, branch protection and verification documentation | Ownership routes preserved; admin requirements explicit |
| C | Build archive and isolated keyless provenance workflow | Static workflow checks; npm lint/test/build where installed |
| D | Report and memory payload for review | CGRF metadata and memory edges agree; no orphan files |

Each phase emits PASS or FAIL. Missing npm tooling is recorded as unavailable,
following .bits/context.md sandbox guidance; it is not a passing test result.
CI must pass before merge. Live OIDC signing is verified only on GitHub after merge.

## Smoke commands

```bash
npm run lint
npm test
npm run build
python /tmp/verify-builder-governance.py
```

The temporary static verification command is a session-local audit, not a
repository dependency. Persistent CI verification lives in provenance.yml:
PR build/test and main-only positive/tampered-artifact attestation verification.
Results and remaining admin work are recorded in this dispatch's report.md.

## Bounds and rollback

One SRS branch/PR; no deploy, push, external settings mutation, secret access,
or private CNWB edits. Revert this SRS's diff through a reviewed PR to remove the
workflow and docs; any later admin-enabled ruleset requires a separate admin
rollback. Existing AGENTS.md and CLAUDE.md already exist and remain authoritative.

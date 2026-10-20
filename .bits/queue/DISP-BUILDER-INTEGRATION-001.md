<!--
# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/queue/DISP-BUILDER-INTEGRATION-001.md
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
# Intent:      Record the operator authorization, bounded staging phases and required verification for the consolidated review.
# ───────────────────────────────────────────────────────────────
-->

# DISP-BUILDER-INTEGRATION-001

- status: in_progress
- srs: SRS-CN-BUILDER-INTEGRATION-001
- operator: Dmitry Richard (mr.nobody@citadel-nexus.com)
- seat: BITS-CODEGEN; mode: staging
- authorization_source: authenticated operator's current directive, "all of them
  bring them into the next one", following the request for operations, learning,
  and audit tests across the four identified Builder PRs.
- external_vcc_status: not queried or changed; local operator-directed record
- memory_brief: PR #34 is merged; #8, #9, #16 and #26 are the requested inputs;
  no GitLab MR was identified and this session supports GitHub only

## Task table

| Phase | Work | Gate |
| --- | --- | --- |
| A | Freeze four source PR heads and compare with current main | All source capabilities accounted for |
| B | Integrate source changes and repair overlapping startup/type fragments | Existing integrations preserved; syntax checks |
| C | Harden failure paths, learning evidence and local audit | Regression failures reproduced then passing |
| D | Wire retained tests into CI/provenance and record evidence | Report, metadata and artifact contract validated |
| E | Discover public master-rank reuse and hand off private bindings | Eight-guild matrix distinguishes direct Bits reads from delegated execution; no unverified completion claims |

## Smoke commands

```bash
npm run lint
npm test
npm run build
npm run test:operations
python3 capabilities/opportunity_terms/terms_verifier.py --selftest
python3 -m mypy --strict capabilities/opportunity_terms/terms_verifier.py
```

The sandbox can exercise the same native integration tests against locally
Node-transformed TypeScript via BUILDER_DIST_ROOT; that does not replace tsc or
Vitest. No network installation is attempted. See docs/builder-integration.md
and this dispatch's report for results and limitations.

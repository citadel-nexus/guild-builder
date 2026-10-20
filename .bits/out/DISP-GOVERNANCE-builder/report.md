<!--
# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/out/DISP-GOVERNANCE-builder/report.md
# Stage:       11_COMMIT
# SRS:         SRS-CN-BUILDER-GOVERNANCE-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-GOVERNANCE-builder
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     .bits/srs/SRS-CN-BUILDER-GOVERNANCE-001.md
# EnumType:    Doc
# EnumEdges:   DEPENDS_ON .bits/srs/SRS-CN-BUILDER-GOVERNANCE-001.md
# DAG Node:    none
# Intent:      Preserve reviewable evidence and outstanding admin gates for the staging bootstrap.
# ───────────────────────────────────────────────────────────────
-->

# Governance bootstrap report

## §1 SUMMARY

- Status: PARTIAL — implementation prepared; npm/live signing and admin activation pending
- Dispatch: DISP-GOVERNANCE-builder; Seat: BITS-CODEGEN; mode: staging
- SRS: SRS-CN-BUILDER-GOVERNANCE-001
- Branch: bits/SRS-CN-BUILDER-GOVERNANCE-001-provenance
- Tasks: 4/4 staging deliverables prepared; external activation outstanding
- Smoke: 8/11 local checks passed; 3 unavailable (npm lint, test, build)
- CKS Gate: B+/75 target; CKS: pending; CAPS: pending; CK: pending
- Commits: one focused session change; resolve its SHA with `git log -1 --format=%H`

## §2 TASK RESULTS

| Task | Status | Output | Verify | CKET |
| --- | --- | --- | --- | --- |
| A — authorization | PASS | Local SRS, registry, dispatch, TaskIR, standing brief | `python /tmp/verify-builder-governance.py GovernanceChecks.test_bootstrap_records` | 04_HYPOTHESIZE / 11_COMMIT |
| B — governance | PARTIAL | Charter, team-based Forge ownership route, admin runbook; individual GitHub mapping unconfirmed | `python /tmp/verify-builder-governance.py GovernanceChecks.test_ownership_and_admin_documentation` | 06_PLAN |
| C — provenance | PARTIAL | PR build and isolated main-only signer; local static/mock validation passed | `python /tmp/verify-builder-governance.py` plus npm commands below | 11_COMMIT |
| D — review evidence | PASS | This report and connected memory payload | `python /tmp/verify-builder-governance.py GovernanceChecks.test_cgrf_and_memory_integrity` | 11_COMMIT |

The `/tmp/verify-builder-governance.py` commands are session-local audits, not
committed tools or CI checks. The archive test uses fixture build output and the
verification-control-flow test mocks `gh`; neither proves compilation or signing.
The committed workflow supplies real build/sign/verify checks on GitHub.

## §3 SMOKE TEST RESULTS

Run `python /tmp/verify-builder-governance.py` for checks 1–8 (expected: PASS).

1. Bootstrap IDs, registry paths and staging authorization: PASS.
2. Signing gate matrix (main push versus PR, fork, tag, topic, manual events): PASS.
3. Least permissions, same-run artifact handoff, pinned actions, build gate ordering: PASS.
4. Bash syntax and verification flags supported by installed GitHub CLI: PASS.
5. Archive contents and rejection of missing build output (fixtures): PASS.
6. Verification control flow: intact archive accepted, tampering rejected; simulated
   verifier accepting all inputs or rejecting all inputs fails the job: PASS.
7. Existing owner routes, SDK ownership, and admin requirements: PASS.
8. CGRF metadata, registry coverage, memory summary and connected edges: PASS.
9. `npm run lint`: UNAVAILABLE — exit 127, `tsc: not found`.
10. `npm test`: UNAVAILABLE — exit 127, `vitest: not found`.
11. `npm run build`: UNAVAILABLE — exit 127, `tsc: not found`.

Root cause for 9–11: dependencies are absent. No network installation was attempted,
per the repository sandbox guidance. No application fix applies. CI runs `npm ci`
then all three commands; those checks must pass before merge. No new runtime
modules or pytest/mypy coverage obligations apply to this TypeScript repo's
configuration/docs change. No live OIDC/Sigstore operation, GitHub setting change,
registry publishing, production action, or deployment was performed. Action refs
are SHA-pinned; remote action contents were not fetched in this sandbox.

## §4 MEMORY INGEST

- Type A count: 11; Type B count: 11; Type C count: 3
- IOO compliance: true; DKG orphans: 0
- Payload: `.bits/out/DISP-GOVERNANCE-builder/memory.json`
- Metadata records prepared review artifacts; no external memory ingest or CK stamping.

## §5 CKET FILING

- 06_PLAN: GOVERNANCE.md, .github/CODEOWNERS
- 04_HYPOTHESIZE: .bits/srs/SRS-CN-BUILDER-GOVERNANCE-001.md
- 11_COMMIT: workflow, registry/context, queue, TaskIR, report, memory and JSON sidecar
- 13_SAVE: none
- Stages are classifications in the existing repository layout; GitHub discovery
  paths are preserved. CGRF headers cover new text files; JSON uses its sidecar.
- REFLEX check: deferred to private post-merge infrastructure; not run here.

## §6 GOVERNANCE

- Entity: Citadel Nexus Inc. (Delaware C-Corp)
- License posture: existing package manifest declares MIT; no relicensing in this SRS
- Hard-NO scan: changed-file scope only; no prohibited paths modified
- Secret scan: changed-file scan only; no credential values introduced
- Stripe mode: not applicable — no checkout or payment code touched
- SRS authorization: operator-directed local bootstrap, not an external VCC claim

## §7 NEXT ACTIONS

- Require GitHub CI lint/test/build and the first main-push signing/verification run.
- Admin: confirm Forge's GitHub identity/team membership and visible write-enabled
  CODEOWNERS teams; activate the documented default-branch protection ruleset and
  permitted Actions/OIDC/attestation policy. Existing signing config is preserved.
- Maintainer: obtain Forge approval, independent review, and apply labels:
  bits:codegen, srs:srs-cn-builder-governance-001,
  dispatch:disp-governance-builder, verified:static-only, verified:manual-review.
- Handoffs requested: none; external changes are an admin follow-up, not executed.
- Suggested next dispatch: operator to assign if npm/GHCR provenance is desired.
- Bugs filed: none; no issue reference was supplied and no provider writes performed.
- PR publication: operator uses the coding agent Create or Update PR button.

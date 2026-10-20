<!--
# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/srs/SRS-CN-BUILDER-GOVERNANCE-001.md
# Stage:       04_HYPOTHESIZE
# SRS:         SRS-CN-BUILDER-GOVERNANCE-001
# CAPS:        pending
# CK:          pending
# Dispatch:    DISP-GOVERNANCE-builder
# Seat:        BITS-CODEGEN
# Owner:       Citadel Nexus Inc.
# Created:     2026-10-20
# Depends:     none
# EnumType:    Doc
# EnumEdges:   PRODUCES SRS-CN-BUILDER-GOVERNANCE-001
# DAG Node:    none
# Intent:      Define the authorized public Builder Guild ownership and build provenance contract.
# ───────────────────────────────────────────────────────────────
-->

# Builder Guild ownership governance and signed build provenance

- SRS: SRS-CN-BUILDER-GOVERNANCE-001
- Dispatch: DISP-GOVERNANCE-builder
- Status: in_progress
- Seat: BITS-CODEGEN; mode: staging
- CKS gate target: B+/75; CAPS minimum target: B+; measured scores: pending

## Authorization and boundaries

Authenticated operator Dmitry Richard (mr.nobody@citadel-nexus.com) authorized
"create those" through Bits AI on 2026-10-20 and explicitly directed creation
of this local SRS, registry entry, and dispatch. This is a local bootstrap
record, not evidence of a row created or verified in the external VCC database.
No blueprint or external authorization record is fabricated.

Scope is public repository governance, CODEOWNERS, default-branch protection
requirements, and CI build provenance with verification instructions. One branch
and PR cover this SRS. No production action, deployment, main push, GitHub
settings changes, secrets, runtime modules, or private-stack work are authorized.
Use existing root/.github/.bits/.sake_ops locations; CGRF stages classify these
files according to the repo's existing layout. Do not move GitHub discovery files
under physical CKET directories.

## Acceptance criteria

1. Name Forge (GitLab @forge) as Builder Guild guildmaster, with scope covering
   infrastructure, CI/CD, GitLab, site availability, and NATS; record Datadog
   team handle guild-builder separately from GitHub identity. Operator-confirmed
   GitHub code owner is @citadel-nexus/guild-builder; forge-builder-guildmaster is
   Forge's automation app and expected ruleset actor, not a CODEOWNERS entry.
2. Define decisions, approval rules, delegation, and escalation to the
   guildmasters group. Preserve SDK review ownership.
3. Document an admin-enforced default-branch ruleset requiring code-owner review,
   verified signed commits, and the actual PR build check contexts. Explain that
   repository files alone do not activate GitHub protection.
4. Build and test PR artifacts without signing authority. Sign only canonical
   main-push artifacts using GitHub OIDC/Sigstore and SLSA v1 provenance. Isolate
   signing from package installation and build execution. Fail on missing files.
5. Verify archive digest, source commit/ref, repository, workflow identity, and
   signature; reject tampering. Do not claim a certified SLSA build level.
6. Document admin setup, artifact scope/retention, verification, and rollback.
   Run available static checks and npm lint/test/build; record unavailable tools
   honestly and leave live signing verification to GitHub Actions.

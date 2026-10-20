<!--
# ─── CGRF Header ───────────────────────────────────────────────
# File:        GOVERNANCE.md
# Stage:       06_PLAN
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
# Intent:      Make Builder ownership, approval authority, and artifact trust independently reviewable.
# ───────────────────────────────────────────────────────────────
-->

# Builder Guild governance

## Charter and accountable owner

Builder Guild owns infrastructure, CI/CD, GitLab, site availability, and NATS.
The guildmaster is **Forge (GitLab @forge)**. The Datadog team handle is
**guild-builder**. These identities are not interchangeable with GitHub accounts.
Citadel Nexus Inc. owns this public repository; private-stack implementation and
production operations remain in the private CNWB repository.

GitHub reviews route through the existing **@citadel-nexus/guild-builder-leads**
team in `.github/CODEOWNERS`, representing Forge and authorized delegates. An
admin must confirm Forge's GitHub identity, team membership, team visibility,
and explicit write access before treating this route as guildmaster enforcement.
Do not assume GitHub @forge is the same person as GitLab @forge.
The SDK team retains interface review ownership alongside Builder leads.

## Decisions, approval, and escalation

- Propose changes in an SRS-scoped PR with motivation, validation, and rollback.
  A non-author code owner reviews before merge; resolve review threads and pass
  required checks. Authors cannot approve their own changes.
- Forge is accountable for the guild roadmap and decisions within its scope.
  Builder leads may approve routine work delegated by Forge. Record delegation
  and decisions in the PR so the accountable reviewer is visible.
- Changes to ownership, this charter, workflow permissions, signing identity,
  or branch protection require Forge's explicit approval. SDK interface changes
  also request SDK review. CODEOWNERS accepts approval from either listed team;
  it cannot enforce both approvals or identify Forge inside a team. Maintainers
  must check these additional charter requirements before merge.
- Escalate cross-guild impact, contested decisions, conflicts of interest, or
  unavailable guildmaster approval to the **guildmasters group**, with the PR,
  impact, alternatives, and requested decision. Record its decision and named
  delegate in the PR; do not invent a GitHub group handle.
- Urgency does not waive reviews or signing. Follow the incident process and
  escalate to the guildmasters group for an accountable decision. Private
  operations and production access require separate authorization.

## Default-branch protection: admin action required

This repository has no settings-app configuration mechanism. This document is
an admin runbook, not an automatically applied ruleset. In GitHub **Settings →
Rules → Rulesets**, create an **Active** branch ruleset targeting the default
branch (`main` today; use the default-branch selector). Configure:

| Requirement | Setting |
| --- | --- |
| Reviewed changes | Require a pull request; at least 1 approval; require review from Code Owners |
| Current approval | Dismiss stale approvals; require approval of the most recent reviewable push by someone other than its pusher |
| Discussion resolved | Require conversation resolution |
| Signed history | Require signed commits (GitHub Verified signatures) |
| Passing PR checks | Require `build` from `CI — guild-builder` and `provenance-build` from `Build provenance — guild-builder`; select the GitHub Actions source |
| Current base | Require branches to be up to date before merging |
| Protected history | Block force pushes and deletion; apply to administrators with no routine bypass actors |

Wait for a PR to emit both check contexts before selecting them. `build` is the
existing CI job ID; `provenance-build` is the new explicit job name. Do not require
`provenance-attest`, Docker publishing, release jobs, or scheduled security scans
as PR checks: those do not run on every PR. Signed commits and artifact signatures
are separate controls. Contributors must configure their own GitHub-recognized
signing; no signing keys or personal tokens belong in this repository. An admin
must verify the chosen merge method produces commits satisfying the signed-commit
rule, including the bootstrap PR.

Also confirm the code-owner team is visible with explicit write access and that
GitHub reports no CODEOWNERS errors. Configure Actions policy to allow the pinned
official checkout, setup-node, upload/download-artifact, and attest-build-provenance
actions. Permit `id-token: write` and `attestations: write` for the signing job.
The workflow requests these permissions explicitly; organization policy must allow
them. Keep default workflow permissions read-only. Public GitHub repositories can
use artifact attestations; if visibility changes, check plan/organization support.
No admin settings are changed by this PR.

## Signed build provenance

`.github/workflows/provenance.yml` builds on PRs targeting `main` and pushes to
`main`. It runs `npm ci`, lint, tests, and TypeScript compilation on a GitHub-hosted
runner, then creates `builder-<commit>.tar.gz` containing `dist/`, package metadata,
the lockfile, and LICENSE. It installs no runtime dependencies in the archive;
consumers must install them separately if running the compiled service.

A separate job downloads that exact archive from the same run and signs its
SHA-256 subject using `actions/attest-build-provenance`. Only a push to `main` in
`citadel-nexus/guild-builder` can enter that job. PRs (including forks) receive no
OIDC/signing permissions. The signing job does not check out source, install
packages, extract the archive, or execute build output. It uses short-lived GitHub
OIDC identity and Sigstore keyless signing; no persistent signing secret is used.
The resulting signed SLSA v1 statement binds the artifact digest to the repository,
source revision, and workflow. This is artifact signing through an attestation,
not a separate detached signature or a claim of certified SLSA build-level compliance.

After signing, the job verifies the exact archive and confirms a modified copy
fails verification. GitHub stores the attestation; the workflow also uploads its
Sigstore bundle as `builder-provenance-<commit>`. The archive artifact is named
`builder-build-<commit>`. Both downloads have 30-day retention (subject to org
limits); consumers needing longer retention must retain the original archive and
bundle. PR artifacts are unsigned. Treat an archive as trusted only after its
signing job succeeds and verification below passes.

This workflow does not deploy, publish packages, or change existing release and
container publishing. Its signature covers only the archive's bytes, not existing
npm packages or GHCR images. Signing those distributions needs a follow-up SRS.

## Verify before use

Use a current GitHub CLI supporting `gh attestation verify`. Choose the expected
full commit SHA independently from reviewed `main` history, and select a successful
**push** run of this workflow for that SHA. Do not derive trust from a downloaded
filename or from an untrusted artifact's own provenance claims.

```bash
REPO=citadel-nexus/guild-builder
COMMIT=<expected-full-main-commit-sha>
RUN_ID=<successful-main-push-run-id>
gh run view "$RUN_ID" --repo "$REPO" \
  --json event,headSha,conclusion,workflowName
# Confirm event=push, headSha=$COMMIT, conclusion=success, and the provenance workflow.
gh run download "$RUN_ID" --repo "$REPO" \
  --name "builder-build-$COMMIT" --dir ./builder-download

gh attestation verify "./builder-download/builder-$COMMIT.tar.gz" \
  --repo "$REPO" \
  --signer-workflow "$REPO/.github/workflows/provenance.yml" \
  --source-ref refs/heads/main --source-digest "$COMMIT" \
  --predicate-type https://slsa.dev/provenance/v1 \
  --deny-self-hosted-runners
```

Verification must exit zero before extracting or executing anything. It validates
the signature and digest, expected repository, workflow, source ref and commit,
and predicate type; a checksum alone does not authenticate the producer. A missing
attestation, wrong signer/revision, or modified archive must fail closed.

To verify using the retained bundle instead of querying GitHub for attestations:

```bash
gh run download "$RUN_ID" --repo "$REPO" \
  --name "builder-provenance-$COMMIT" --dir ./builder-bundle
gh attestation verify "./builder-download/builder-$COMMIT.tar.gz" \
  --bundle ./builder-bundle/provenance.sigstore.json \
  --repo "$REPO" \
  --signer-workflow "$REPO/.github/workflows/provenance.yml" \
  --source-ref refs/heads/main --source-digest "$COMMIT" \
  --predicate-type https://slsa.dev/provenance/v1 \
  --deny-self-hosted-runners
```

Bundle verification may still retrieve Sigstore trust material; fully offline
verification requires separately provisioned trusted roots. Keep the bundle and
original archive together. Repacking or modifying the archive changes its digest.

## Rollback and maintenance

Revert the governance/provenance PR through normal review to remove the workflow.
Previously issued attestations still exist; a Git revert is not revocation. If a
build is compromised, stop consumption and escalate to Forge and the guildmasters
group with the affected commit and artifact digest. An admin separately owns any
ruleset change or attestation lifecycle action. When renaming the default branch,
update workflow triggers, signing gates, verification policy, and ruleset checks.

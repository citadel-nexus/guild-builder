<!--
# ─── CGRF Header ───────────────────────────────────────────────
# File:        .bits/out/DISP-BUILDER-INTEGRATION-001/report.md
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
# Intent:      Distinguish demonstrated integration behavior from unavailable CI gates and unbound master-control release evidence.
# ───────────────────────────────────────────────────────────────
-->

# Builder integration review report

## §1 SUMMARY

- Status: PARTIAL. Implementation and public handoff are prepared; mandatory npm
  verification and the independent master-control release gates remain open.
- Dispatch: DISP-BUILDER-INTEGRATION-001. Seat: BITS-CODEGEN. Mode: staging.
- SRS: SRS-CN-BUILDER-INTEGRATION-001. Branch: bits/SRS-CN-BUILDER-INTEGRATION-001-ops-learning-audit.
- Base: be3140681f5c0f1b15e4a36847891ab3bca50067, main after merged governance PR #34.
- Tasks: 3/5 PASS, 2/5 PARTIAL pending CI. Smoke: 5/8 gates PASS, 3/8 unavailable
  because required executables are absent (62.5%, below the 80% dispatch target).
- CKS gate: B+/75; CKS: pending. CAPS: pending. CK: pending.
- Commits at implementation snapshot: 1 (aae464002d0f4f20dbdf8bc96bbb6ef46c8f2b7e). This report and its memory
  payload are a separate evidence record; resolve the full final review history
  with `git log --oneline be3140681f5c0f1b15e4a36847891ab3bca50067..HEAD`.

## §2 TASK RESULTS

| Task | Status | Result / files | Verify | Logical CKET |
| --- | --- | --- | --- | --- |
| A — cover all source reviews | PASS | Four pinned heads; every source path imported, reconciled or already on base; source-prs.json | Run the source/metadata audit below; compare refs with `git rev-parse origin/pr-8 origin/pr-9 origin/pr-16 origin/pr-26` after fetching the named reviews | 11_COMMIT |
| B — combine public capabilities | PARTIAL | Bot tracking, research forwarding, Mira/AGS and terms extraction coexist; newer startup and matching preserved | `node --disable-warning=ExperimentalWarning tests/integration/sandbox-runner.mjs`; `npm run lint`; `npm run build` | 11_COMMIT |
| C — operations, learning and audit regressions | PASS | Tests exercise real localhost HTTP, injected subscription failure, replay/restart evidence, immutable views, trusted-head truncation and exact quotes | Native suite and Python unittest commands below | 11_COMMIT |
| D — gate and record signed delivery | PARTIAL | Both build workflows gate on operations; archive includes Python capability; main-only isolated signing remains; CI execution is pending | `npm run build` then `npm run test:operations`; workflow inspection and archive verification in GOVERNANCE.md | 11_COMMIT |
| E — master-rank discovery and handoff | PASS for handoff; execution HOLD | Eight existing masters retained in .bits/handoffs/2026-10-20-BITS-CODEGEN-CMAX-B-master-rank.md; real Bits read results separated from missing authority/delegation/TEVV | Inspect the handoff matrix and repeat its exact queries through the named read tools with an authorized seat | 11_COMMIT |

The complete file inventory is the SRS registry entry and Type A records. The
source inventory records 21 paths from #8, 7 from #9, 135 from #16 and 2 from #26;
119 of #16's paths were already on the integration base. Source reviews remain
open. No GitLab MR was identified because private GitLab cannot attach here.

## §3 SMOKE TEST RESULTS

Checks below were run on 2026-10-20 at 18:13:58 UTC against the files recorded in
the implementation snapshot. Node: 24.13.0; Python: 3.12.13. CI uses Node 20 and
its normal TypeScript build. The native runner transforms source into a temporary
ES module tree and cleans it up; it does not perform TypeScript type checking.

| Command / check | Expected | Actual | Result |
| --- | --- | --- | --- |
| `node --disable-warning=ExperimentalWarning tests/integration/sandbox-runner.mjs` | Every native regression passes | 14/14; includes malformed persisted fields and duplicate retention ordering | PASS |
| `python -m unittest discover -s tests/capabilities -p 'test_*.py'` | Every terms regression passes | 7/7 | PASS |
| `python capabilities/opportunity_terms/terms_verifier.py --selftest` | All capability examples pass | 5/5 assertions | PASS |
| `python -m mypy --strict capabilities/opportunity_terms/terms_verifier.py` | No typing errors | No issues in one source file | PASS |
| `npm run lint` | tsc exits 0 | Exit 127: tsc not found | UNAVAILABLE |
| `npm test` | Vitest exits 0 | Exit 127: vitest not found | UNAVAILABLE |
| `npm run build` | Production compilation exits 0 | Exit 127: tsc not found | UNAVAILABLE |
| Source/metadata/workflow inspection | All source paths accounted for; valid YAML, CGRF metadata and signing boundaries | 62 implementation paths passed; final evidence records are checked by the audit below | PASS |

TypeScript, Vitest, pytest and coverage tooling are absent; no network installation
was attempted. CI must install the lockfile dependencies and run lint, tests,
build and test:operations before merge. The 80% new-code coverage gate is
UNMEASURED, not waived or reported as passed. Live NATS, provider mutation,
artifact signing and independent VCC verification were not executed locally.

Targeted failures and corrections:

- The original fee/rights self-test passed 3/5, with 11 failing Python regression
  subcases. Corrected fee matching, conjugations, evidence quotes, negation and
  assignment precedence now pass the seven tests and five original assertions.
- The initial native suite had nine failures and one pass. Subscription recovery,
  HTTP 413 response handling, retained-evidence isolation, replay accounting and
  restart validation now pass; the final expanded suite is 14/14.
- The two final persistence regressions initially failed 0/2: malformed optional
  fields were accepted and duplicate rows retained the wrong position. Validation
  and last-occurrence ordering now pass both cases within the 14-test suite.
- Parsing source #8's SAKE contract failed on a partially quoted scalar. The
  complete value is now quoted and the YAML parse passes.
- The three npm command failures are environment limitations, not passing checks.
  Required remedy: run the declared CI checks with installed dependencies. No
  attempt was made to substitute a syntax transform for those results.

Run this audit on this review snapshot to check file intent/line metadata, exact
CGRF-to-memory edges, IOO fields, graph connectivity and source coverage. It is
not a continuously updated statement about later revisions of these files.

```bash
python3 - <<'AUDIT'
import json, re
from pathlib import Path
root = Path('.')
folder = root / '.bits/out/DISP-BUILDER-INTEGRATION-001'
data = json.loads((folder / 'memory.json').read_text())
a = [v for v in data['vectors'] if v['type'] == 'A']
b = [v for v in data['vectors'] if v['type'] == 'B']
c = [v for v in data['vectors'] if v['type'] == 'C']
assert {v['type'] for v in data['vectors']} == {'A', 'B', 'C'}
assert len({v['file_path'] for v in a}) == len(a)
assert [data['summary'][f'type_{t}_count'] for t in 'abc'] == list(map(len, (a, b, c)))
actual_edges = {(v['source'], v['edge_type'], v['target']) for v in b}
expected_edges = set()
for item in a:
    path = root / item['file_path']
    assert len(path.read_text().splitlines()) == item['lines'], path
    assert all(item[k] not in (None, '') for k in ('intent_statement', 'objective_id', 'outcome', 'supersedes'))
    assert item['caps_grade'] == item['ck_stamp'] == 'pending'
    if path.suffix == '.json':
        text = Path(str(path) + '.cgrf.yaml').read_text()
        intent = re.search(r'^intent: (.+)$', text, re.M).group(1)
        pairs = re.findall(r'  - edge_type: (\w+)\n    target: (.+)', text)
    else:
        text = path.read_text()
        intent = re.search(r'(?:#|//) Intent: +(.+)', text).group(1)
        raw_edges = re.search(r'(?:#|//) EnumEdges: +(.+)', text).group(1)
        pairs = [edge.strip().split(' ', 1) for edge in raw_edges.split(';')]
    assert intent == item['intent_statement'], path
    expected_edges.update((str(path), verb, target) for verb, target in pairs)
    assert any(item['file_path'] in (edge['source'], edge['target']) for edge in b), path
assert expected_edges == actual_edges
assert data['summary']['dkg_orphans'] == 0 and data['summary']['ioo_compliance']
sources = json.loads((folder / 'source-prs.json').read_text())['sources']
assert {s['pr'] for s in sources} == {8, 9, 16, 26}
for source in sources:
    files = [p for group in source['dispositions'].values() for p in group]
    assert len(files) == len(set(files)) == source['source_path_count']
    assert all((root / p).is_file() for p in files)
print(f'PASS: {len(a)} file records, {len(b)} matching edges, {len(c)} real validation events; four source reviews covered')
AUDIT
```

YAML parsing was additionally checked with the sandbox's PyYAML installation.
The provenance workflow retains push/main/canonical-repository restrictions,
job-only signing permissions, pinned actions, an isolated signing runner and the
signed-archive/tampered-archive verification steps. No hosted signing run for this
unpublished change is claimed.

## §4 MEMORY INGEST

- Payload: .bits/out/DISP-BUILDER-INTEGRATION-001/memory.json.
- Type A: 65 file metadata records. Type B: 81 declared edges.
  Type C: 5 real validation events with command evidence and source snapshot.
- IOO compliance: true. DKG orphans: 0. Header/edge correspondence is checked by
  the runnable audit above. JSON records use sibling CGRF metadata files.
- This payload is prepared for the existing post-merge ingest flow; no Memory
  MCP call, CKS grading, CK signing or external dispatch completion was performed.

## §5 CKET FILING

Established public-repository paths are retained as requested. These are logical
CGRF stages, not a relocation into private CKET directories:

- 04_HYPOTHESIZE: 1 spec at .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md.
- 06_PLAN: 5 contributor, governance and integration documents at native paths.
- 11_COMMIT: 58 public source/test/configuration/dispatch/handoff/evidence files.
- 13_SAVE: 1 memory payload at .bits/out/DISP-BUILDER-INTEGRATION-001/memory.json.
- CGRF: 44/44 new files covered, including JSON sidecars; all 65 touched paths have
  corresponding memory intent and graph edges. CAPS and CK remain pending.
- REFLEX: private validator not run; deferred to the authorized post-merge path.

## §6 GOVERNANCE

- Entity for authored metadata: Citadel Nexus Inc. (Delaware C-Corp).
- License posture: existing repository LICENSE/package declare MIT; no license
  change is included and no BUSL or commercial grant is asserted.
- Hard-NO path scan: no protected/private path or notify workflow was modified.
- Changed-file credential-prefix scan: no credential-like values found. No private
  package imports, tenant-specific Supabase URLs or new runtime dependencies added.
- NATS subjects remain configuration-driven; fixtures and documentation name
  example subjects. No NATS or CSCC event was emitted by this session.
- Stripe mode: not applicable; no checkout, live-payment or Stripe logic changed.
- Existing configured committer/signing behavior was retained. No main-branch
  write, push, settings change, deployment, source-PR closure or cloud purchase.
- GitHub admin follow-up from #34 remains: activate the default-branch ruleset,
  require code-owner review, signed commits and build/provenance-build checks,
  and allow the pinned attestation actions/permissions. Verify owner-team
  visibility/write access. Expected automation App: forge-builder-guildmaster.
  GitHub Actions remains the status-check source; no App bypass is implied.

## §7 NEXT ACTIONS

- Blockers: required npm/coverage evidence; private GitLab attachment and actual
  CNWB identities, provider scopes, NNC/AAXP authorization, durable queues and VCC
  bindings. A local completion flag or build attestation is not independent TEVV.
- Handoffs: CMAX-B/IDE1/USO_MCP with Forge and Oracle, via
  .bits/handoffs/2026-10-20-BITS-CODEGEN-CMAX-B-master-rank.md. Direct Bits reads
  found no matching active incident and ten returned monitors reporting OK; that
  is not a Forge-owned corrective mission. Mission cost/latency remain UNMEASURED.
- Suggested next dispatch: USO-issued CNWB execution for
  SRS-CN-GUILD-MASTER-RANK-001, beginning with Forge and Oracle and the actual
  authority, retry/revocation, attribution and independent-artifact tests in the handoff.
- Maintainer: run required CI, obtain a Builder review, create the next consolidated
  PR, then decide how to close superseded reviews. Required labels on open:
  bits:codegen, srs:srs-cn-builder-integration-001,
  dispatch:disp-builder-integration-001, verified:manual-review.
  Do not use verified:tests-pass while required checks are unavailable.
- Bugs filed externally: none; no external issue or PR comments were posted.
  The existing router's optional/fail-open policy behavior is an explicit CNWB
  adoption blocker in the handoff, not proof of enforceable provider authorization.
- Rollback: revert the consolidated review through normal review to the post-#34
  baseline. Retain the verifier matching exported audit hashes: new JSON-array
  hash inputs are incompatible with historical pipe-delimited exports. Anonymous
  ingestion remains possible without a configured token; forwarding is at-most-once
  and local memory stores are not multi-tenant durable services.

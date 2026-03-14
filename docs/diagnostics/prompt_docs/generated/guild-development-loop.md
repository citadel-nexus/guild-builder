# Guild Development Loop Prompt Docs

- Guild: `builder`
- System: `citadel-ide-extension`
- Source branch: `main`
- GitHub repo: `citadel-nexus/guild-builder`
- Notion parent page: `unassigned`

Documents the control-plane code blocks that route community GitHub work into the protected GitLab review lane, assign seat-specific briefs, publish prompt docs, and prevent duplicate seat execution on the command bus.

## Blocks

### Seat Command Claim Lock

Block ID: `seat-claim-lock`

Prevents two seat commanders from executing the same command transmission when both the broadcast and per-seat NATS subjects deliver the same tx_id.

Code paths:
- `services/subseat/seat_commander.py`

Explanation:
- The commander now attempts a conditional Supabase patch from status=open to status=claimed before running docker exec.
- If the patch returns no row, the consumer treats the command as already claimed and exits without executing it.
- This keeps the command bus compatible with both subject patterns while eliminating duplicate execution.

Inputs:
- citadel.seat.command or citadel.seat.<seat>.command payload with tx_id, to_seat, from_seat, command

Outputs:
- Single command execution
- Single result row published back onto the bus
- Original transmission advanced to acked

Tests:
- `tests/unit/test_seat_commander_command_bus.py`

Notes:
- This is a safety gate for live Megamind seat iteration.

### Signed GitHub Community Intake

Block ID: `github-community-intake`

Accepts GitHub issue and pull request webhooks, verifies the HMAC signature, maps the repo back to a guild, derives the protected GitLab review branch name, and emits seat-specific acceptance criteria.

Code paths:
- `src/api/routes/ide_routes.py`

Explanation:
- Only signed GitHub events are accepted through X-Hub-Signature-256 validation.
- Each public guild repo is resolved back to a canonical guild slug before seat assignment or review-link generation happens.
- The branch name is deterministic so repeated updates land in the same protected review lane for the same GitHub object.
- The intake now emits seat_missions with objective, acceptance criteria, context, and suggested commands.

Inputs:
- GitHub webhook headers
- GitHub issue or pull_request event payload

Outputs:
- Deterministic dev/community branch name
- Guild-scoped review links
- Seat assignments for mission execution

Tests:
- `tests/unit/test_guild_dev_loop_routes.py`

### GitLab Review Intake Artifact

Block ID: `gitlab-review-artifact`

Writes a machine-readable intake artifact into the protected review branch so seats, reviewers, and later automation all have the same source packet, then mirrors the explanation layer into GitHub docs and a Notion-ready payload.

Code paths:
- `src/api/routes/ide_routes.py`
- `tools/guild_tools/prompt_docs.py`

Explanation:
- The intake artifact lives under community_intake/<guild>/<event>-<number>.json in the protected branch.
- Prompt documentation for the same system is generated into docs/diagnostics/prompt_docs/generated so GitHub review and Notion sync can derive from the same manifest.
- This gives the guild diagnostics surface a concrete artifact to verify rather than just checking environment variables.

Inputs:
- GitHub source metadata
- GitLab project path and branch
- Prompt-doc manifest data

Outputs:
- Protected branch intake JSON
- GitHub-facing markdown prompt docs
- Notion-ready JSON payload for sync

Tests:
- `tests/unit/test_guild_dev_loop_routes.py`
- `tests/unit/test_prompt_docs_ops.py`

Notes:
- Live Notion publishing is gated on NOTION_PARENT_PAGE_ID plus a Notion token.

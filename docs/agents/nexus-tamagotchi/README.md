# Nexus Tamagotchi Agent (Stage 1 Foundation)

## What this agent is

Nexus Tamagotchi is a gamified, governance-aware agent surface for Builder Guild development workflows. It combines:

- progression mechanics (XP, TP, ranks, badges, skills),
- constitutional governance checkpoints (S00-S03),
- a professor-domain advisory network,
- reflex patterns for deterministic responses,
- immutable audit-chain primitives.

Stage 1 is intentionally foundation-only: data contracts, registries, and public-safe stubs. Private CNWB execution logic remains outside this repository.

## Why it exists

The public `guild-builder` repository needs a safe, extensible contract for agent development that:

1. keeps core semantics visible to contributors,
2. avoids private CNWB implementation leakage,
3. supports staged upgrades without breaking downstream consumers.

This module provides that contract under `src/agents/nexus-tamagotchi/`.

## Stage 1 scope

Implemented:

- Core type system (`types.ts`)
- Badge registry (`data/badges.ts`)
- 28-professor registry (`data/professors.ts`)
- 6-skill-tree registry (`data/skills.ts`)
- Reflex pattern library (`data/reflexes.ts`)
- MCP progression sheet + tool registry (`progression.ts`)
- Citadel integration router foundation (`integration-router.ts`)
- SRS declarations + operational validator (`srs.ts`)
- SHA-256 guardian audit chain (`audit.ts`)
- Constitutional council stub pipeline (`council.ts`)
- Domain model layer (`models.ts`)
- Memory and cognitive domain primitives (`memory.ts`)
- Gamification and brotherhood progression engines (`gamification.ts`, `brotherhood.ts`)
- Authority gating runtime (`authority.ts`)
- Reflex runtime engine (`reflex-engine.ts`)
- Engagement promotion messaging (`engagement.ts`)
- Function reward map (`function-rewards.ts`)
- Mission and quest lifecycle engines (`missions.ts`, `quests.ts`)
- Outcome-weighted XP scoring (`outcome-xp.ts`)
- Leaderboard and insight engines (`leaderboard.ts`, `insight.ts`)
- Runtime skill unlock system (`skill-tree-system.ts`)
- Badge unlock runtime and condition checks (`badge-system.ts`)
- Multi-channel broadcast coordinator + integration wrappers (`multi-channel-broadcast.ts`)
- Skill tracking persistence and analytics (`skill-tracker.ts`)
- Lingo profile analysis and rendering surfaces (`lingo.ts`)
- Cognitive/preflight status registries and formatters (`cognitive-systems.ts`)
- Agent template factory contracts (`agent-factory.ts`)
- Auto-installation environment scaffolding (`auto-installation.ts`)
- Secure key vault contract (`secure-key-vault.ts`)
- Web enrichment client contract (`web-enrichment.ts`)
- Auto-start entrypoint (`maybeStartNexusTamagotchi`)

Deferred to future stages:

- live Mira-compatible memory orchestration,
- deep cognitive architecture runtime loops,
- full NATS command/event bus behavior,
- external integration implementations.

## Gamification economy model

### XP and TP

- **XP** drives Brotherhood rank and authority upgrades.
- **TP** is a spendable progression currency for skill unlocks.
- Stage 1 provides types + registries; reward execution logic is added in later stages.

### Brotherhood ranks

`initiate -> apprentice -> journeyman -> artisan -> master -> grandmaster -> elder -> legend`

Thresholds are defined in `RANK_THRESHOLDS`.

### Authority tiers

`OBSERVE -> ASSIST -> EXECUTE -> GOVERN -> ARCHITECT`

XP gate thresholds are defined in `AUTHORITY_XP_GATES`.

### Badges

`BADGE_REGISTRY` groups 50+ badges across:

- interaction
- memory
- governance
- integration
- knowledge
- economy
- autonomy
- social
- meta
- special

Each badge defines unlock condition text plus XP/TP reward metadata.

### Skills

`SKILL_REGISTRY` and `SKILL_TREES` model 6 trees:

- memory
- cognition
- autonomy
- governance
- economy
- integration

Each skill includes tier, TP cost, prerequisites, and numeric effects.

### Quests and missions

`missions.ts` and `quests.ts` provide executable lifecycle foundations:

- template-backed mission/quest generation
- progress updates by metric key
- completion checks and reward emission payloads
- XP handoff through `BrotherhoodSystem`

## Professor network (28 domains)

`PROFESSOR_REGISTRY` defines one professor for each domain:

- security, infrastructure, frontend, backend, data, ml, devops, architecture
- testing, performance, networking, cloud, database, mobile, blockchain
- ai_ethics, ux, accessibility, i18n, compliance
- finance, marketing, sales, support, hr, legal, operations, strategy

Each professor has:

- expertise tags
- personality profile
- catchphrase
- trust score

## Constitutional council pipeline (S00-S03)

`ConstitutionalCouncil.submitDecision(action, context)` runs a public-safe stub pipeline:

1. **S00** syntax check
2. **S01** authority check
3. **S02** policy check
4. **S03** final approval/escalation

Every decision is appended to the guardian audit chain with SHA-256 linkage.

## Authority gating

`authority.ts` introduces an XP-gated authorization runtime:

- tiers: `OBSERVE -> ASSIST -> EXECUTE -> GOVERN -> META`
- action policy map for common operations
- explicit allow/deny reasoning and history
- hard `require(action)` guard for enforcement call sites

## Guardian audit trail

`audit.ts` provides:

- `createAuditEntry(event, actor, detail, prevHash)`
- `verifyChain(entries)`
- `getChainHead(entries)`
- `GuardianAuditTrail` class wrapper

Hashing uses `node:crypto` SHA-256 and validates chain integrity end-to-end.

## Reflex engine foundation

`REFLEX_PATTERNS` defines deterministic trigger-response rules, while `reflex-engine.ts` provides runtime trigger handling. Each reflex includes:

- pattern (regex string)
- category
- priority
- required authority tier
- XP award on trigger

## Runtime progression surfaces

Stage 1 now includes public-safe runtime engines that mirror source semantics without private vendor logic:

- `BrotherhoodSystem` (XP/TP/rank progression)
- `FunctionRewardsMap` (function-level rewards + cooldowns)
- `MissionEngine` and `QuestSystem` (engagement loops)
- `OutcomeXPEngine` (signal-weighted reward multiplier)
- `LeaderboardSystem` (ranking snapshot and sync contract)
- `InsightEngine` (pattern and suggestion generation)
- `SkillTreeSystem` (unlock gating and tree progress)
- `BadgeSystem` (condition-based badge unlock and XP award)
- `MultiChannelBroadcaster` (Discord/Slack/Notion/Linear/GitLab wrappers)
- `SkillTracker` (tracked skill usage persistence and mastery stats)
- `LingoAdapter` (user language profiling and topic/slang trends)
- `CognitiveSystemsRegistry` (extended system availability + preflight summaries)
- `ZayaraEngagementEngine` (promotion messaging)

All external service behavior remains routed through public stubs.

## Secure key-vault and web enrichment

`secure-key-vault.ts` provides encrypted-at-rest local key handling for public development flows:

- encrypted key persistence
- masked key display
- required-service checks
- validation status tracking

`web-enrichment.ts` exposes a configurable fetch-based enrichment client. Endpoint and credentials are environment-driven (`NEXUS_WEB_ENRICHMENT_ENDPOINT`, `NEXUS_WEB_ENRICHMENT_API_KEY`) and never hardcoded.

## MCP progression sheet

`MCPProgressionSheet` exposes:

- capability registry (`CAPABILITIES`)
- tool registry (`TOOL_REGISTRY`)
- completion summary
- overall progress summary (`getOverallProgress`)
- category completion breakdown
- authority-filtered tool discovery
- cognitive frame capture (`captureCognitiveFrame`)
- MCP manifest export (`exportMcpManifest`)

This keeps Stage 1 aligned with larger multi-stage build-out tracking.

## Citadel integration router foundation

`CitadelIntegrationRouter` provides a public-safe integration gateway contract:

- token discovery from environment
- per-service availability checks
- per-service rate limit buckets
- policy gate hook support (`setPolicyContext`)
- uniform async route contract (`route`)
- stats reporting (`getStats`)

Stage 1.6 implementation intentionally keeps dispatch behavior stubbed and does not call private or tenant-bound endpoints.

## SRS declarations and operational validator

`srs.ts` provides:

- grouped SRS requirement registries
- combined `SRS_REGISTRY`
- `validateSrsCoverage(implementedCodes)`
- `getSrsSummary()`
- `OperationalSRSValidator` with executable requirement checks and compliance formatting

This mirrors the declarative + operational compliance pattern from the source Python system while remaining public-repo safe.

## NATS subject catalog

Subjects are configuration-derived and never hardcoded as full literals.

Configuration:

- `NEXUS_NATS_PREFIX` (default: `citadel.builder.nexus`)
- `NEXUS_AGENT_ID` (default: `nexus-001`)

Canonical event pattern for future stages:

`<NEXUS_NATS_PREFIX>.<NEXUS_AGENT_ID>.<agent-event-kind>`

Where `agent-event-kind` comes from `AgentEventKind` in `types.ts`.

Stage 1 only validates and stores this subject namespace in runtime config.

## Extending the module

### Add a badge

1. Add a new `Badge` entry in `data/badges.ts`.
2. Ensure `id` is unique and category is valid.
3. Add tests for any behavior relying on the badge id.

### Add a professor

1. Add a `Professor` entry in `data/professors.ts`.
2. Use an existing `ProfessorDomain` value or extend the union in `types.ts`.
3. Keep expertise tags concise and structured.

### Add skills

1. Extend `TREE_SEEDS` in `data/skills.ts`.
2. Keep prerequisite chains valid.
3. Confirm `SKILL_TREES` output remains complete for all six trees.

### Add reflex patterns

1. Append to `REFLEX_PATTERNS` in `data/reflexes.ts`.
2. Use authority minimums consistent with risk.
3. Validate pattern specificity to avoid broad accidental matches.

## Progression capability map

Core capability categories tracked in Stage 1:

- foundation
- gamification
- governance
- knowledge
- automation
- integrations
- distribution

Use `MCPProgressionSheet.getCategoryBreakdown()` and `getCompletionSummary()` for status reporting.

## Upgrade guide for future stages

### Stage 2

- Implement gamification runtime engines (XP/TP award + anti-farm logic)
- Add mission/quest execution service
- Emit event stream payloads on configured NATS subjects

### Stage 3

- Add memory orchestration runtime (Mira abstraction in public-safe form)
- Wire context rehydration interfaces
- Expand reflex execution loop

### Stage 4

- Add cognitive orchestration and insight generation services
- Add integration adapters using built-in `fetch` (still no private credentials)
- Add richer telemetry contracts for Datadog/PostHog handoff

### Stage N

- Keep public contracts stable
- move private execution detail to CNWB GitLab
- preserve strict CGRF constraints (no private imports, no secrets, no hardcoded tenant vendor endpoints)
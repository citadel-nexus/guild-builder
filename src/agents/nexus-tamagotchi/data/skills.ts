import type { Skill, SkillTier, SkillTreeId } from '../types.js';

type SkillSeed = {
  key: string;
  name: string;
  description: string;
};

const TREE_ORDER: SkillTreeId[] = [
  'memory',
  'cognition',
  'autonomy',
  'governance',
  'economy',
  'integration',
];

const TREE_SEEDS: Record<SkillTreeId, SkillSeed[]> = {
  memory: [
    {
      key: 'cache_awakening',
      name: 'Cache Awakening',
      description: 'Initialize short-term memory capture for incoming context.',
    },
    {
      key: 'short_term_buffer',
      name: 'Short-Term Buffer',
      description: 'Expand immediate working context for active interactions.',
    },
    {
      key: 'context_threads',
      name: 'Context Threads',
      description: 'Track multiple related topics without dropping continuity.',
    },
    {
      key: 'recall_anchors',
      name: 'Recall Anchors',
      description: 'Create anchor points that improve later retrieval quality.',
    },
    {
      key: 'semantic_indexing',
      name: 'Semantic Indexing',
      description: 'Index memory by meaning to improve search relevance.',
    },
    {
      key: 'temporal_linking',
      name: 'Temporal Linking',
      description: 'Link memories by sequence to preserve event chronology.',
    },
    {
      key: 'retention_gatekeeping',
      name: 'Retention Gatekeeping',
      description: 'Filter low-value memory writes before persistence.',
    },
    {
      key: 'consolidation_cycles',
      name: 'Consolidation Cycles',
      description: 'Promote important short-term records into long-term memory.',
    },
    {
      key: 'vector_rehydration',
      name: 'Vector Rehydration',
      description: 'Rehydrate compressed memory chunks into usable context.',
    },
    {
      key: 'episodic_layering',
      name: 'Episodic Layering',
      description: 'Store related events as structured episodes.',
    },
    {
      key: 'domain_memory_maps',
      name: 'Domain Memory Maps',
      description: 'Partition memory strategies by specialist domain.',
    },
    {
      key: 'contradiction_tracking',
      name: 'Contradiction Tracking',
      description: 'Detect conflicting memory claims and flag them for review.',
    },
    {
      key: 'adaptive_forgetting',
      name: 'Adaptive Forgetting',
      description: 'Decay stale memory while preserving high-signal context.',
    },
    {
      key: 'compression_protocols',
      name: 'Compression Protocols',
      description: 'Compress long context histories without losing key facts.',
    },
    {
      key: 'memory_sanctum',
      name: 'Memory Sanctum',
      description: 'Protect strategic memory paths with stricter retention rules.',
    },
    {
      key: 'long_horizon_recall',
      name: 'Long Horizon Recall',
      description: 'Retrieve accurate context from deep historical windows.',
    },
    {
      key: 'archival_fusion',
      name: 'Archival Fusion',
      description: 'Blend episodic, semantic, and strategic memory sources.',
    },
    {
      key: 'sovereign_memory',
      name: 'Sovereign Memory',
      description: 'Operate full-spectrum memory orchestration autonomously.',
    },
  ],
  cognition: [
    {
      key: 'intent_parsing',
      name: 'Intent Parsing',
      description: 'Extract core user intent from raw language input.',
    },
    {
      key: 'query_refinement',
      name: 'Query Refinement',
      description: 'Rewrite vague prompts into structured problem frames.',
    },
    {
      key: 'response_skeleton',
      name: 'Response Skeleton',
      description: 'Draft response structures before detail expansion.',
    },
    {
      key: 'relevance_scoring',
      name: 'Relevance Scoring',
      description: 'Rank candidate responses against current context.',
    },
    {
      key: 'multi_hypothesis_routing',
      name: 'Multi-Hypothesis Routing',
      description: 'Evaluate multiple answer paths before selecting one.',
    },
    {
      key: 'professor_dispatch',
      name: 'Professor Dispatch',
      description: 'Route requests to high-fit professor domains.',
    },
    {
      key: 'conflict_resolution',
      name: 'Conflict Resolution',
      description: 'Resolve competing signals from memory and live inputs.',
    },
    {
      key: 'synthesis_pipeline',
      name: 'Synthesis Pipeline',
      description: 'Fuse specialist outputs into a coherent recommendation.',
    },
    {
      key: 'pattern_extraction',
      name: 'Pattern Extraction',
      description: 'Identify repeated structures in interactions and outcomes.',
    },
    {
      key: 'anomaly_interpretation',
      name: 'Anomaly Interpretation',
      description: 'Classify unusual behavior and infer likely causes.',
    },
    {
      key: 'scenario_modeling',
      name: 'Scenario Modeling',
      description: 'Generate plausible paths from uncertain starting states.',
    },
    {
      key: 'decision_fractals',
      name: 'Decision Fractals',
      description: 'Break large choices into recursively manageable units.',
    },
    {
      key: 'discourse_planning',
      name: 'Discourse Planning',
      description: 'Plan multi-turn conversations with objective continuity.',
    },
    {
      key: 'strategic_abstraction',
      name: 'Strategic Abstraction',
      description: 'Distill tactical details into strategic summaries.',
    },
    {
      key: 'cognitive_cortex',
      name: 'Cognitive Cortex',
      description: 'Coordinate cognition modules through a shared control layer.',
    },
    {
      key: 'metareasoning',
      name: 'Metareasoning',
      description: 'Evaluate confidence and quality of internal reasoning.',
    },
    {
      key: 'insight_crystallization',
      name: 'Insight Crystallization',
      description: 'Convert analysis into clear, high-confidence guidance.',
    },
    {
      key: 'nexus_thinking',
      name: 'Nexus Thinking',
      description: 'Run cross-domain cognition with strategic consistency.',
    },
  ],
  autonomy: [
    {
      key: 'reflex_triggers',
      name: 'Reflex Triggers',
      description: 'Detect trigger patterns that can run without LLM calls.',
    },
    {
      key: 'safety_guards',
      name: 'Safety Guards',
      description: 'Gate autonomous actions behind safety checks.',
    },
    {
      key: 'mission_scheduler',
      name: 'Mission Scheduler',
      description: 'Queue and prioritize autonomous mission execution.',
    },
    {
      key: 'loop_heartbeat',
      name: 'Loop Heartbeat',
      description: 'Maintain regular autonomous loop timing.',
    },
    {
      key: 'policy_constrained_actions',
      name: 'Policy-Constrained Actions',
      description: 'Enforce policy envelopes during autonomous execution.',
    },
    {
      key: 'adaptive_prioritization',
      name: 'Adaptive Prioritization',
      description: 'Re-prioritize tasks based on dynamic context.',
    },
    {
      key: 'self_repair_routines',
      name: 'Self-Repair Routines',
      description: 'Recover from recoverable faults without manual intervention.',
    },
    {
      key: 'confidence_thresholding',
      name: 'Confidence Thresholding',
      description: 'Abort or escalate actions below confidence thresholds.',
    },
    {
      key: 'autonomous_handoffs',
      name: 'Autonomous Handoffs',
      description: 'Hand off tasks to integrations when conditions are met.',
    },
    {
      key: 'outcome_feedback',
      name: 'Outcome Feedback',
      description: 'Feed outcome quality into future autonomy decisions.',
    },
    {
      key: 'parameter_tuning',
      name: 'Parameter Tuning',
      description: 'Tune control parameters from observed behavior.',
    },
    {
      key: 'behavior_patchwork',
      name: 'Behavior Patchwork',
      description: 'Apply behavior patches without full model restarts.',
    },
    {
      key: 'multi_loop_coordination',
      name: 'Multi-Loop Coordination',
      description: 'Coordinate interaction, reflex, and economy loops.',
    },
    {
      key: 'resilience_recovery',
      name: 'Resilience Recovery',
      description: 'Resume autonomous operation after degraded states.',
    },
    {
      key: 'council_driven_autonomy',
      name: 'Council-Driven Autonomy',
      description: 'Bind autonomous action approvals to governance decisions.',
    },
    {
      key: 'operator_shadow_mode',
      name: 'Operator Shadow Mode',
      description: 'Preview autonomous plans before full execution.',
    },
    {
      key: 'proactive_execution',
      name: 'Proactive Execution',
      description: 'Act on forecasted needs before explicit user prompts.',
    },
    {
      key: 'sovereign_autonomy',
      name: 'Sovereign Autonomy',
      description: 'Operate full autonomous flows inside governance constraints.',
    },
  ],
  governance: [
    {
      key: 'authority_baseline',
      name: 'Authority Baseline',
      description: 'Initialize authority tiers and permission boundaries.',
    },
    {
      key: 'council_intake',
      name: 'Council Intake',
      description: 'Capture and normalize decision submissions.',
    },
    {
      key: 'syntax_validation',
      name: 'Syntax Validation',
      description: 'Reject malformed decision actions at stage S00.',
    },
    {
      key: 'audit_hashing',
      name: 'Audit Hashing',
      description: 'Record immutable chain hashes for governance events.',
    },
    {
      key: 'authority_gates',
      name: 'Authority Gates',
      description: 'Apply XP-gated authority checks during decision flow.',
    },
    {
      key: 'policy_matrix',
      name: 'Policy Matrix',
      description: 'Evaluate decisions against policy constraints.',
    },
    {
      key: 'escalation_paths',
      name: 'Escalation Paths',
      description: 'Route unresolved decisions to escalation states.',
    },
    {
      key: 'decision_ledger',
      name: 'Decision Ledger',
      description: 'Persist stage-by-stage council verdict histories.',
    },
    {
      key: 'constitutional_guardrails',
      name: 'Constitutional Guardrails',
      description: 'Enforce constitutional boundaries across all actions.',
    },
    {
      key: 'compliance_signals',
      name: 'Compliance Signals',
      description: 'Emit compliance evidence for downstream tooling.',
    },
    {
      key: 'transparency_reports',
      name: 'Transparency Reports',
      description: 'Generate explainable governance summaries.',
    },
    {
      key: 'reversible_actions',
      name: 'Reversible Actions',
      description: 'Require rollback paths for high-impact decisions.',
    },
    {
      key: 'quorum_models',
      name: 'Quorum Models',
      description: 'Model approvals using quorum-style semantics.',
    },
    {
      key: 'risk_weighting',
      name: 'Risk Weighting',
      description: 'Adjust verdict strictness based on risk profile.',
    },
    {
      key: 'governance_mesh',
      name: 'Governance Mesh',
      description: 'Coordinate governance checks across subsystems.',
    },
    {
      key: 'delegated_controls',
      name: 'Delegated Controls',
      description: 'Allow constrained delegation under audit visibility.',
    },
    {
      key: 'immutable_covenant',
      name: 'Immutable Covenant',
      description: 'Protect non-bypassable invariants in runtime governance.',
    },
    {
      key: 'constitutional_sovereignty',
      name: 'Constitutional Sovereignty',
      description: 'Finalize full constitutional governance coverage.',
    },
  ],
  economy: [
    {
      key: 'xp_baseline',
      name: 'XP Baseline',
      description: 'Initialize experience-point accrual.',
    },
    {
      key: 'tp_wallet',
      name: 'TP Wallet',
      description: 'Track and spend tavern points.',
    },
    {
      key: 'reward_attribution',
      name: 'Reward Attribution',
      description: 'Link rewards to the actions that generated them.',
    },
    {
      key: 'anti_farm_filters',
      name: 'Anti-Farm Filters',
      description: 'Suppress abusive reward farming patterns.',
    },
    {
      key: 'streak_multipliers',
      name: 'Streak Multipliers',
      description: 'Apply multiplier effects to sustained activity streaks.',
    },
    {
      key: 'mission_payouts',
      name: 'Mission Payouts',
      description: 'Grant mission completion payouts using weighted outcomes.',
    },
    {
      key: 'quest_bounties',
      name: 'Quest Bounties',
      description: 'Issue daily, weekly, and epic quest rewards.',
    },
    {
      key: 'badge_rewards',
      name: 'Badge Rewards',
      description: 'Attach XP and TP rewards to badge unlocks.',
    },
    {
      key: 'rank_progression',
      name: 'Rank Progression',
      description: 'Upgrade ranks based on XP thresholds.',
    },
    {
      key: 'skill_investments',
      name: 'Skill Investments',
      description: 'Spend TP to unlock skill tree upgrades.',
    },
    {
      key: 'economy_balancing',
      name: 'Economy Balancing',
      description: 'Balance reward curves across progression loops.',
    },
    {
      key: 'sink_mechanics',
      name: 'Sink Mechanics',
      description: 'Introduce TP sinks to control resource inflation.',
    },
    {
      key: 'dynamic_multipliers',
      name: 'Dynamic Multipliers',
      description: 'Adjust rewards from contextual outcome quality.',
    },
    {
      key: 'inflation_controls',
      name: 'Inflation Controls',
      description: 'Protect long-term value of XP and TP currencies.',
    },
    {
      key: 'prestige_cycles',
      name: 'Prestige Cycles',
      description: 'Enable high-rank prestige loops with bounded resets.',
    },
    {
      key: 'seasonal_rewards',
      name: 'Seasonal Rewards',
      description: 'Introduce cycle-based incentives and leaderboard resets.',
    },
    {
      key: 'guild_economy_link',
      name: 'Guild Economy Link',
      description: 'Share progression mechanics across guild contexts.',
    },
    {
      key: 'sovereign_economy',
      name: 'Sovereign Economy',
      description: 'Run the full economy with self-balancing protections.',
    },
  ],
  integration: [
    {
      key: 'bus_connectivity',
      name: 'Bus Connectivity',
      description: 'Initialize event bus connectivity for integration flows.',
    },
    {
      key: 'event_envelopes',
      name: 'Event Envelopes',
      description: 'Standardize event payload envelope structures.',
    },
    {
      key: 'webhook_bridging',
      name: 'Webhook Bridging',
      description: 'Translate webhook events into internal commands.',
    },
    {
      key: 'channel_broadcast',
      name: 'Channel Broadcast',
      description: 'Broadcast updates across configured communication channels.',
    },
    {
      key: 'service_health_pings',
      name: 'Service Health Pings',
      description: 'Track health checks across integration endpoints.',
    },
    {
      key: 'retry_orchestration',
      name: 'Retry Orchestration',
      description: 'Apply retry policies for transient integration failures.',
    },
    {
      key: 'backoff_strategies',
      name: 'Backoff Strategies',
      description: 'Control retry pace using bounded backoff.',
    },
    {
      key: 'idempotent_handoffs',
      name: 'Idempotent Handoffs',
      description: 'Prevent duplicate side effects in external systems.',
    },
    {
      key: 'observability_hooks',
      name: 'Observability Hooks',
      description: 'Attach telemetry hooks to every integration handoff.',
    },
    {
      key: 'integration_policies',
      name: 'Integration Policies',
      description: 'Apply policy checks before external system actions.',
    },
    {
      key: 'schema_contracts',
      name: 'Schema Contracts',
      description: 'Validate integration payload schemas before dispatch.',
    },
    {
      key: 'drift_detection',
      name: 'Drift Detection',
      description: 'Detect contract drift between systems.',
    },
    {
      key: 'failover_paths',
      name: 'Failover Paths',
      description: 'Route around unavailable integrations safely.',
    },
    {
      key: 'federation_sync',
      name: 'Federation Sync',
      description: 'Maintain sync consistency across federated services.',
    },
    {
      key: 'multi_tenant_routing',
      name: 'Multi-Tenant Routing',
      description: 'Route integration events per tenant boundaries.',
    },
    {
      key: 'cross_platform_coordination',
      name: 'Cross-Platform Coordination',
      description: 'Coordinate workflows that span multiple external platforms.',
    },
    {
      key: 'protocol_translation',
      name: 'Protocol Translation',
      description: 'Translate between protocol shapes while preserving intent.',
    },
    {
      key: 'sovereign_integration',
      name: 'Sovereign Integration',
      description: 'Run high-reliability integration fabric across all channels.',
    },
  ],
};

function tierForIndex(index: number): SkillTier {
  if (index <= 3) {
    return 1;
  }
  if (index <= 7) {
    return 2;
  }
  if (index <= 11) {
    return 3;
  }
  if (index <= 14) {
    return 4;
  }
  return 5;
}

function costForTier(tier: SkillTier, index: number): number {
  const base = tier * 20;
  return base + index * 5;
}

function buildSkill(
  tree: SkillTreeId,
  seed: SkillSeed,
  index: number,
  treeSeeds: SkillSeed[],
): Skill {
  const tier = tierForIndex(index);
  const prerequisites: string[] = [];

  if (index > 0) {
    prerequisites.push(`${tree}.${treeSeeds[index - 1].key}`);
  }
  if (index > 2 && index % 3 === 0) {
    prerequisites.push(`${tree}.${treeSeeds[index - 3].key}`);
  }

  return {
    id: `${tree}.${seed.key}`,
    name: seed.name,
    description: seed.description,
    tree,
    tier,
    tpCost: costForTier(tier, index),
    prerequisites,
    effects: {
      [`${tree}_efficiency`]: 2 + tier,
      [`${tree}_capacity`]: 1 + Math.floor(index / 2),
      [`${tree}_mastery`]: tier,
    },
  };
}

const skillRegistry: Record<string, Skill> = {};
const skillTrees: Record<SkillTreeId, string[]> = {
  memory: [],
  cognition: [],
  autonomy: [],
  governance: [],
  economy: [],
  integration: [],
};

for (const tree of TREE_ORDER) {
  const seeds = TREE_SEEDS[tree];
  for (let index = 0; index < seeds.length; index += 1) {
    const skill = buildSkill(tree, seeds[index], index, seeds);
    skillRegistry[skill.id] = skill;
    skillTrees[tree].push(skill.id);
  }
}

export const SKILL_REGISTRY: Record<string, Skill> = skillRegistry;
export const SKILL_TREES: Record<SkillTreeId, string[]> = skillTrees;
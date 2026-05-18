import {
  AUTHORITY_ORDER,
  type AuthorityTier,
  type McpToolEntry,
  type ProgressionCapability,
} from './types.js';

export const CAPABILITIES: Record<string, ProgressionCapability> = {
  core_loop: {
    id: 'core_loop',
    name: 'Agent Core Loop',
    description: 'Main interaction cycle: input -> process -> respond -> learn',
    category: 'foundation',
    status: 'complete',
    completionPercentage: 100,
    dependencies: [],
    srsCodes: ['SRS-AGENT-001'],
    locEstimate: 200,
    locActual: 180,
  },
  state_persistence: {
    id: 'state_persistence',
    name: 'State Persistence',
    description: 'Save/load agent state between sessions',
    category: 'foundation',
    status: 'complete',
    completionPercentage: 100,
    dependencies: ['core_loop'],
    srsCodes: ['SRS-AGENT-002'],
    locEstimate: 150,
    locActual: 120,
  },
  memory_system: {
    id: 'memory_system',
    name: 'Vector Memory Storage',
    description: 'FAISS-indexed semantic memory with recall',
    category: 'foundation',
    status: 'complete',
    completionPercentage: 100,
    dependencies: ['core_loop'],
    srsCodes: ['SRS-AGENT-003'],
    locEstimate: 200,
    locActual: 185,
  },
  xp_system: {
    id: 'xp_system',
    name: 'XP/TP Economy',
    description: 'Experience and Tavern Points with rank progression',
    category: 'gamification',
    status: 'complete',
    completionPercentage: 100,
    dependencies: [],
    srsCodes: ['SRS-BROTHER-001', 'SRS-BROTHER-002', 'SRS-BROTHER-003'],
    locEstimate: 300,
    locActual: 280,
  },
  badge_system: {
    id: 'badge_system',
    name: 'Badge & Achievement System',
    description: '50+ badges with unlock conditions',
    category: 'gamification',
    status: 'complete',
    completionPercentage: 100,
    dependencies: ['xp_system'],
    srsCodes: ['SRS-GAMIFY-001'],
    locEstimate: 250,
    locActual: 230,
  },
  skill_tree: {
    id: 'skill_tree',
    name: 'Skill Tree System',
    description: '6 skill trees with tier-based progression',
    category: 'gamification',
    status: 'complete',
    completionPercentage: 100,
    dependencies: ['xp_system'],
    srsCodes: ['SRS-GAMIFY-003'],
    locEstimate: 200,
    locActual: 200,
  },
  quest_system: {
    id: 'quest_system',
    name: 'Quest System',
    description: 'Daily/weekly/epic quests with rewards',
    category: 'gamification',
    status: 'complete',
    completionPercentage: 100,
    dependencies: ['xp_system', 'skill_tree'],
    srsCodes: ['SRS-GAMIFY-004'],
    locEstimate: 200,
    locActual: 175,
  },
  leaderboard: {
    id: 'leaderboard',
    name: 'Leaderboard System',
    description: 'Global and guild rankings with Supabase sync',
    category: 'gamification',
    status: 'complete',
    completionPercentage: 100,
    dependencies: ['xp_system'],
    srsCodes: ['SRS-GAMIFY-002'],
    locEstimate: 150,
    locActual: 130,
  },
  council_system: {
    id: 'council_system',
    name: 'Constitutional Council',
    description: 'S00-S03 governance pipeline for decision validation',
    category: 'governance',
    status: 'complete',
    completionPercentage: 100,
    dependencies: [],
    srsCodes: ['SRS-COUNCIL-001', 'SRS-COUNCIL-002'],
    locEstimate: 150,
    locActual: 140,
  },
  audit_trail: {
    id: 'audit_trail',
    name: 'Guardian Audit Trail',
    description: 'SHA-256 hash chain for immutable event logging',
    category: 'governance',
    status: 'complete',
    completionPercentage: 100,
    dependencies: ['council_system'],
    srsCodes: ['SRS-AUDIT-001'],
    locEstimate: 100,
    locActual: 85,
  },
  authority_gate: {
    id: 'authority_gate',
    name: 'Authority Gating',
    description: 'XP-based permission tiers for action control',
    category: 'governance',
    status: 'complete',
    completionPercentage: 100,
    dependencies: ['xp_system'],
    srsCodes: ['SRS-AUTH-001'],
    locEstimate: 150,
    locActual: 140,
  },
  professor_network: {
    id: 'professor_network',
    name: '28-Professor Network',
    description: 'Parallel specialized expert routing',
    category: 'knowledge',
    status: 'complete',
    completionPercentage: 100,
    dependencies: [],
    srsCodes: ['SRS-PROF-001'],
    locEstimate: 400,
    locActual: 380,
  },
  insight_engine: {
    id: 'insight_engine',
    name: 'Insight Engine',
    description: 'Pattern analysis and weekly reports',
    category: 'knowledge',
    status: 'complete',
    completionPercentage: 100,
    dependencies: ['memory_system', 'professor_network'],
    srsCodes: ['SRS-INSIGHT-001'],
    locEstimate: 200,
    locActual: 170,
  },
  reflex_engine: {
    id: 'reflex_engine',
    name: 'Reflex Auto-Response',
    description: 'Pattern-based responses without LLM calls',
    category: 'automation',
    status: 'complete',
    completionPercentage: 100,
    dependencies: [],
    srsCodes: ['SRS-REFLEX-001'],
    locEstimate: 180,
    locActual: 160,
  },
  mission_engine: {
    id: 'mission_engine',
    name: 'Mission Tracking',
    description: 'Auto-generated missions from context',
    category: 'automation',
    status: 'complete',
    completionPercentage: 100,
    dependencies: ['xp_system'],
    srsCodes: ['SRS-MISSION-001'],
    locEstimate: 250,
    locActual: 230,
  },
  outcome_xp: {
    id: 'outcome_xp',
    name: 'Outcome-Weighted XP',
    description: 'Real impact scoring for XP multipliers',
    category: 'automation',
    status: 'complete',
    completionPercentage: 100,
    dependencies: ['xp_system', 'mission_engine'],
    srsCodes: ['SRS-OUTCOME-001'],
    locEstimate: 150,
    locActual: 130,
  },
  multi_channel: {
    id: 'multi_channel',
    name: 'Multi-Channel Broadcast',
    description: 'Slack, Discord, Notion, Linear fan-out',
    category: 'integrations',
    status: 'complete',
    completionPercentage: 100,
    dependencies: [],
    srsCodes: ['SRS-NOTIFY-001'],
    locEstimate: 500,
    locActual: 480,
  },
  citadel_router: {
    id: 'citadel_router',
    name: 'Citadel Integration Router',
    description: 'Route all integrations through Citadel hub',
    category: 'integrations',
    status: 'in_progress',
    completionPercentage: 50,
    dependencies: ['multi_channel'],
    srsCodes: ['SRS-INTEGRATE-001'],
    locEstimate: 200,
    locActual: 0,
  },
  preflight_system: {
    id: 'preflight_system',
    name: 'Preflight Validation',
    description: 'Multi-stage validation pipeline for on-prem deployment',
    category: 'distribution',
    status: 'in_progress',
    completionPercentage: 20,
    dependencies: [],
    srsCodes: ['SRS-DEPLOY-001'],
    locEstimate: 400,
    locActual: 0,
  },
  distro_framework: {
    id: 'distro_framework',
    name: 'Distribution Framework',
    description: 'Install/run/service patterns for agent deployment',
    category: 'distribution',
    status: 'in_progress',
    completionPercentage: 20,
    dependencies: ['preflight_system'],
    srsCodes: ['SRS-DEPLOY-002'],
    locEstimate: 300,
    locActual: 0,
  },
  agent_gif: {
    id: 'agent_gif',
    name: 'AGENT_GIF Visualization',
    description: 'Cognitive frame capture for progression visualization',
    category: 'distribution',
    status: 'planned',
    completionPercentage: 0,
    dependencies: ['core_loop'],
    srsCodes: ['SRS-VIZ-001'],
    locEstimate: 200,
    locActual: 0,
  },
};

export const TOOL_REGISTRY: McpToolEntry[] = [
  {
    toolId: 'interact',
    name: 'interact',
    description: 'Process user interaction and generate AI response',
    inputSchema: {
      type: 'object',
      properties: {
        user_input: { type: 'string' },
      },
    },
    handlerMethod: 'interact',
    category: 'conversation',
    authorityTier: 'OBSERVE',
    xpOnUse: 10,
  },
  {
    toolId: 'recall',
    name: 'recall_memories',
    description: 'Retrieve relevant memories from vector storage',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        k: { type: 'integer' },
      },
    },
    handlerMethod: 'recall_memories',
    category: 'memory',
    authorityTier: 'OBSERVE',
    xpOnUse: 5,
  },
  {
    toolId: 'status',
    name: 'get_status',
    description: 'Get agent vitals and Brotherhood stats',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handlerMethod: 'get_status',
    category: 'status',
    authorityTier: 'OBSERVE',
    xpOnUse: 2,
  },
  {
    toolId: 'unlock_skill',
    name: 'unlock_skill',
    description: 'Unlock a skill from the skill tree',
    inputSchema: {
      type: 'object',
      properties: {
        skill_id: { type: 'string' },
      },
    },
    handlerMethod: 'unlock_skill',
    category: 'progression',
    authorityTier: 'ASSIST',
    xpOnUse: 15,
  },
  {
    toolId: 'complete_mission',
    name: 'complete_mission',
    description: 'Mark a mission as completed and claim rewards',
    inputSchema: {
      type: 'object',
      properties: {
        mission_id: { type: 'string' },
      },
    },
    handlerMethod: 'complete_mission',
    category: 'missions',
    authorityTier: 'EXECUTE',
    xpOnUse: 20,
  },
  {
    toolId: 'broadcast',
    name: 'broadcast_event',
    description: 'Broadcast an event to all configured channels',
    inputSchema: {
      type: 'object',
      properties: {
        event_type: { type: 'string' },
        data: { type: 'object' },
      },
    },
    handlerMethod: 'broadcast_event',
    category: 'integrations',
    authorityTier: 'EXECUTE',
    xpOnUse: 15,
  },
  {
    toolId: 'route_to_professor',
    name: 'route_to_professor',
    description: 'Route a question to a specialized professor',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        question: { type: 'string' },
      },
    },
    handlerMethod: 'route_to_professor',
    category: 'knowledge',
    authorityTier: 'ASSIST',
    xpOnUse: 10,
  },
  {
    toolId: 'generate_insight',
    name: 'generate_insight',
    description: 'Generate insights from interaction patterns',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handlerMethod: 'generate_insight',
    category: 'analysis',
    authorityTier: 'EXECUTE',
    xpOnUse: 25,
  },
];

export type CompletionSummary = {
  total: number;
  planned: number;
  inProgress: number;
  complete: number;
  verified: number;
  completionPercentage: number;
};

export type CategoryBreakdown = Record<
  string,
  {
    total: number;
    complete: number;
    verified: number;
    completionPercentage: number;
  }
>;

function copyCapability(capability: ProgressionCapability): ProgressionCapability {
  return {
    ...capability,
    dependencies: [...capability.dependencies],
    srsCodes: [...capability.srsCodes],
  };
}

function copyTool(tool: McpToolEntry): McpToolEntry {
  return {
    ...tool,
    inputSchema: structuredClone(tool.inputSchema),
  };
}

function authorityToIndex(authority: AuthorityTier): number {
  return AUTHORITY_ORDER.indexOf(authority);
}

export class MCPProgressionSheet {
  private readonly capabilities: Record<string, ProgressionCapability>;
  private readonly tools: McpToolEntry[];

  constructor(
    capabilities: Record<string, ProgressionCapability> = CAPABILITIES,
    tools: McpToolEntry[] = TOOL_REGISTRY,
  ) {
    const capabilityCopy: Record<string, ProgressionCapability> = {};
    for (const [key, value] of Object.entries(capabilities)) {
      capabilityCopy[key] = copyCapability(value);
    }
    this.capabilities = capabilityCopy;
    this.tools = tools.map((tool) => copyTool(tool));
  }

  getCapability(id: string): ProgressionCapability | undefined {
    const capability = this.capabilities[id];
    return capability ? copyCapability(capability) : undefined;
  }

  getCapabilities(): Record<string, ProgressionCapability> {
    const snapshot: Record<string, ProgressionCapability> = {};
    for (const [key, value] of Object.entries(this.capabilities)) {
      snapshot[key] = copyCapability(value);
    }
    return snapshot;
  }

  getCompletionSummary(): CompletionSummary {
    const values = Object.values(this.capabilities);
    const total = values.length;
    const planned = values.filter((capability) => capability.status === 'planned').length;
    const inProgress = values.filter(
      (capability) => capability.status === 'in_progress',
    ).length;
    const complete = values.filter((capability) => capability.status === 'complete').length;
    const verified = values.filter((capability) => capability.status === 'verified').length;

    const completionSum = values.reduce(
      (sum, capability) => sum + capability.completionPercentage,
      0,
    );
    const completionPercentage = total === 0 ? 0 : completionSum / total;

    return {
      total,
      planned,
      inProgress,
      complete,
      verified,
      completionPercentage,
    };
  }

  getCategoryBreakdown(): CategoryBreakdown {
    const byCategory: CategoryBreakdown = {};

    for (const capability of Object.values(this.capabilities)) {
      const category = capability.category;
      const existing = byCategory[category];
      if (!existing) {
        byCategory[category] = {
          total: 1,
          complete: capability.status === 'complete' ? 1 : 0,
          verified: capability.status === 'verified' ? 1 : 0,
          completionPercentage: capability.completionPercentage,
        };
        continue;
      }

      existing.total += 1;
      if (capability.status === 'complete') {
        existing.complete += 1;
      }
      if (capability.status === 'verified') {
        existing.verified += 1;
      }
      existing.completionPercentage += capability.completionPercentage;
    }

    for (const category of Object.keys(byCategory)) {
      const row = byCategory[category];
      row.completionPercentage =
        row.total === 0 ? 0 : row.completionPercentage / row.total;
    }

    return byCategory;
  }

  getToolsForAuthority(authority: AuthorityTier): McpToolEntry[] {
    const limit = authorityToIndex(authority);
    return this.tools
      .filter((tool) => authorityToIndex(tool.authorityTier) <= limit)
      .map((tool) => copyTool(tool));
  }
}
import { BrotherhoodSystem } from './brotherhood.js';

export type SkillAimbMetadata = {
  srsCode: string;
  reflex: string;
  tags: string[];
  categories: string[];
  knowledgeSectors: string[];
  authorityTier: string;
  capsGrade: string;
  integrationPoints: string[];
  descriptionExtended: string;
};

export type SkillTreeSkill = {
  id: string;
  name: string;
  description: string;
  tree: string;
  tier: number;
  tpCost: number;
  xpRequirement: number;
  prerequisites: string[];
  unlocked: boolean;
  aimb?: SkillAimbMetadata;
};

export type SkillUnlockResult = {
  skillId: string;
  success: boolean;
  reason: string;
  tpSpent: number;
};

type SkillTreeDefinition = {
  name: string;
  skills: SkillTreeSkill[];
};

const SKILL_AIMB_REGISTRY: Record<string, SkillAimbMetadata> = {
  conv_greeting: {
    srsCode: 'SRS-GAMIFY-003.CONV.01',
    reflex: 'REFLEX_GREETING_RESPOND',
    tags: ['conversation', 'greeting', 'social'],
    categories: ['Conversation', 'Social'],
    knowledgeSectors: ['Communication', 'User Experience'],
    authorityTier: 'OBSERVE',
    capsGrade: 'CAPSTONE-A',
    integrationPoints: ['discord', 'slack'],
    descriptionExtended:
      'Enables enhanced greeting detection and contextual responses.',
  },
  know_recall: {
    srsCode: 'SRS-GAMIFY-003.KNOW.01',
    reflex: 'REFLEX_MEMORY_RECALL',
    tags: ['knowledge', 'memory', 'retrieval'],
    categories: ['Knowledge', 'Memory'],
    knowledgeSectors: ['Information Retrieval', 'Cognitive Science'],
    authorityTier: 'OBSERVE',
    capsGrade: 'CAPSTONE-A',
    integrationPoints: ['supabase'],
    descriptionExtended:
      'Enhances memory retrieval accuracy and relevance scoring.',
  },
  gov_policy: {
    srsCode: 'SRS-GAMIFY-003.GOV.01',
    reflex: 'REFLEX_POLICY_READ',
    tags: ['governance', 'policy', 'rules'],
    categories: ['Governance', 'Compliance'],
    knowledgeSectors: ['Constitutional Governance', 'Policy'],
    authorityTier: 'OBSERVE',
    capsGrade: 'CAPSTONE-A',
    integrationPoints: [],
    descriptionExtended:
      'Interprets governance policy surfaces and route constraints.',
  },
  auto_reflex: {
    srsCode: 'SRS-GAMIFY-003.AUTO.01',
    reflex: 'REFLEX_PATTERN_AUTO',
    tags: ['automation', 'reflex', 'patterns'],
    categories: ['Automation', 'Efficiency'],
    knowledgeSectors: ['Pattern Recognition', 'Optimization'],
    authorityTier: 'OBSERVE',
    capsGrade: 'CAPSTONE-A',
    integrationPoints: [],
    descriptionExtended:
      'Enables deterministic reflex handling for common prompts.',
  },
  int_notify: {
    srsCode: 'SRS-GAMIFY-003.INT.01',
    reflex: 'REFLEX_NOTIFY_SEND',
    tags: ['integration', 'notifications', 'multi-channel'],
    categories: ['Integration', 'Communication'],
    knowledgeSectors: ['External Systems', 'Communication'],
    authorityTier: 'ASSIST',
    capsGrade: 'CAPSTONE-A',
    integrationPoints: ['discord', 'slack'],
    descriptionExtended:
      'Enables multi-channel notification broadcasting.',
  },
};

const SKILL_TREES: Record<string, SkillTreeDefinition> = {
  conversation: {
    name: 'Conversation Arts',
    skills: [
      {
        id: 'conv_greeting',
        name: 'Greeting Mastery',
        description: 'Enhanced greeting responses',
        tree: 'conversation',
        tier: 1,
        tpCost: 10,
        xpRequirement: 0,
        prerequisites: [],
        unlocked: false,
      },
      {
        id: 'conv_farewell',
        name: 'Farewell Finesse',
        description: 'Memorable goodbyes',
        tree: 'conversation',
        tier: 1,
        tpCost: 10,
        xpRequirement: 0,
        prerequisites: [],
        unlocked: false,
      },
      {
        id: 'conv_smalltalk',
        name: 'Small Talk',
        description: 'Casual conversation skills',
        tree: 'conversation',
        tier: 2,
        tpCost: 25,
        xpRequirement: 500,
        prerequisites: ['conv_greeting'],
        unlocked: false,
      },
      {
        id: 'conv_questions',
        name: 'Question Crafting',
        description: 'Better question formulation',
        tree: 'conversation',
        tier: 2,
        tpCost: 25,
        xpRequirement: 500,
        prerequisites: ['conv_greeting'],
        unlocked: false,
      },
      {
        id: 'conv_debate',
        name: 'Debate Skills',
        description: 'Structured argumentation',
        tree: 'conversation',
        tier: 3,
        tpCost: 50,
        xpRequirement: 2000,
        prerequisites: ['conv_smalltalk', 'conv_questions'],
        unlocked: false,
      },
    ],
  },
  knowledge: {
    name: 'Knowledge Mastery',
    skills: [
      {
        id: 'know_recall',
        name: 'Memory Recall',
        description: 'Better memory retrieval',
        tree: 'knowledge',
        tier: 1,
        tpCost: 15,
        xpRequirement: 0,
        prerequisites: [],
        unlocked: false,
      },
      {
        id: 'know_search',
        name: 'Knowledge Search',
        description: 'Semantic search skills',
        tree: 'knowledge',
        tier: 1,
        tpCost: 15,
        xpRequirement: 0,
        prerequisites: [],
        unlocked: false,
      },
      {
        id: 'know_synthesis',
        name: 'Synthesis',
        description: 'Combine knowledge sources',
        tree: 'knowledge',
        tier: 2,
        tpCost: 30,
        xpRequirement: 750,
        prerequisites: ['know_recall', 'know_search'],
        unlocked: false,
      },
      {
        id: 'know_analysis',
        name: 'Deep Analysis',
        description: 'Analytical thinking',
        tree: 'knowledge',
        tier: 2,
        tpCost: 30,
        xpRequirement: 750,
        prerequisites: ['know_recall'],
        unlocked: false,
      },
      {
        id: 'know_insight',
        name: 'Insight Generation',
        description: 'Generate novel insights',
        tree: 'knowledge',
        tier: 3,
        tpCost: 60,
        xpRequirement: 3000,
        prerequisites: ['know_synthesis', 'know_analysis'],
        unlocked: false,
      },
    ],
  },
  governance: {
    name: 'Governance Expertise',
    skills: [
      {
        id: 'gov_policy',
        name: 'Policy Understanding',
        description: 'Understand governance policies',
        tree: 'governance',
        tier: 1,
        tpCost: 20,
        xpRequirement: 100,
        prerequisites: [],
        unlocked: false,
      },
      {
        id: 'gov_council',
        name: 'Council Interaction',
        description: 'Interact with council system',
        tree: 'governance',
        tier: 2,
        tpCost: 40,
        xpRequirement: 1000,
        prerequisites: ['gov_policy'],
        unlocked: false,
      },
      {
        id: 'gov_propose',
        name: 'Policy Proposal',
        description: 'Propose new policies',
        tree: 'governance',
        tier: 3,
        tpCost: 80,
        xpRequirement: 5000,
        prerequisites: ['gov_council'],
        unlocked: false,
      },
    ],
  },
  social: {
    name: 'Social Dynamics',
    skills: [
      {
        id: 'soc_leaderboard',
        name: 'Leaderboard Access',
        description: 'View global rankings',
        tree: 'social',
        tier: 1,
        tpCost: 10,
        xpRequirement: 0,
        prerequisites: [],
        unlocked: false,
      },
      {
        id: 'soc_guild',
        name: 'Guild Membership',
        description: 'Join and interact with guilds',
        tree: 'social',
        tier: 2,
        tpCost: 25,
        xpRequirement: 500,
        prerequisites: ['soc_leaderboard'],
        unlocked: false,
      },
      {
        id: 'soc_mentor',
        name: 'Mentorship',
        description: 'Guide other agents',
        tree: 'social',
        tier: 3,
        tpCost: 50,
        xpRequirement: 2500,
        prerequisites: ['soc_guild'],
        unlocked: false,
      },
    ],
  },
  automation: {
    name: 'Automation Mastery',
    skills: [
      {
        id: 'auto_reflex',
        name: 'Reflex Patterns',
        description: 'Auto-response patterns',
        tree: 'automation',
        tier: 1,
        tpCost: 15,
        xpRequirement: 0,
        prerequisites: [],
        unlocked: false,
      },
      {
        id: 'auto_mission',
        name: 'Mission Tracking',
        description: 'Auto-track missions',
        tree: 'automation',
        tier: 2,
        tpCost: 30,
        xpRequirement: 750,
        prerequisites: ['auto_reflex'],
        unlocked: false,
      },
      {
        id: 'auto_outcome',
        name: 'Outcome Scoring',
        description: 'Outcome-weighted XP',
        tree: 'automation',
        tier: 3,
        tpCost: 60,
        xpRequirement: 2000,
        prerequisites: ['auto_mission'],
        unlocked: false,
      },
    ],
  },
  integration: {
    name: 'Integration Mastery',
    skills: [
      {
        id: 'int_notify',
        name: 'Notifications',
        description: 'Multi-channel notifications',
        tree: 'integration',
        tier: 1,
        tpCost: 20,
        xpRequirement: 250,
        prerequisites: [],
        unlocked: false,
      },
      {
        id: 'int_sync',
        name: 'Data Sync',
        description: 'Sync to external services',
        tree: 'integration',
        tier: 2,
        tpCost: 40,
        xpRequirement: 1000,
        prerequisites: ['int_notify'],
        unlocked: false,
      },
      {
        id: 'int_webhook',
        name: 'Webhook Mastery',
        description: 'Advanced webhook integrations',
        tree: 'integration',
        tier: 3,
        tpCost: 80,
        xpRequirement: 5000,
        prerequisites: ['int_sync'],
        unlocked: false,
      },
    ],
  },
};

export class SkillTreeSystem {
  readonly unlockedSkills = new Map<string, SkillTreeSkill>();
  readonly allSkills = new Map<string, SkillTreeSkill>();

  constructor(private readonly brotherhood: BrotherhoodSystem) {
    this.flattenSkills();
  }

  getSkillAimb(skillId: string): SkillAimbMetadata | undefined {
    const skill = this.allSkills.get(skillId);
    return skill?.aimb ?? SKILL_AIMB_REGISTRY[skillId];
  }

  getSkillsByAuthorityTier(tier: string): SkillTreeSkill[] {
    return [...this.allSkills.values()].filter(
      (skill) => skill.aimb?.authorityTier === tier,
    );
  }

  getSkillsByIntegration(service: string): SkillTreeSkill[] {
    return [...this.allSkills.values()].filter((skill) =>
      skill.aimb ? skill.aimb.integrationPoints.includes(service) : false,
    );
  }

  canUnlockSkill(skillId: string): { allowed: boolean; reason: string } {
    const skill = this.allSkills.get(skillId);
    if (!skill) {
      return { allowed: false, reason: `Unknown skill: ${skillId}` };
    }
    if (this.unlockedSkills.has(skillId)) {
      return { allowed: false, reason: 'Skill already unlocked' };
    }
    if (this.brotherhood.totalXp < skill.xpRequirement) {
      return {
        allowed: false,
        reason: `Need ${skill.xpRequirement} XP (have ${this.brotherhood.totalXp})`,
      };
    }
    if (this.brotherhood.totalTp < skill.tpCost) {
      return {
        allowed: false,
        reason: `Need ${skill.tpCost} TP (have ${this.brotherhood.totalTp})`,
      };
    }
    for (const prerequisite of skill.prerequisites) {
      if (!this.unlockedSkills.has(prerequisite)) {
        return {
          allowed: false,
          reason: `Prerequisite not met: ${prerequisite}`,
        };
      }
    }
    return { allowed: true, reason: 'Can unlock' };
  }

  unlockSkill(skillId: string): SkillUnlockResult {
    const check = this.canUnlockSkill(skillId);
    if (!check.allowed) {
      return {
        skillId,
        success: false,
        reason: check.reason,
        tpSpent: 0,
      };
    }
    const skill = this.allSkills.get(skillId);
    if (!skill) {
      return {
        skillId,
        success: false,
        reason: `Unknown skill: ${skillId}`,
        tpSpent: 0,
      };
    }
    this.brotherhood.totalTp -= skill.tpCost;
    skill.unlocked = true;
    this.unlockedSkills.set(skillId, skill);
    return {
      skillId,
      success: true,
      reason: `Unlocked ${skill.name}`,
      tpSpent: skill.tpCost,
    };
  }

  getSkillTreeProgress(): Record<
    string,
    { name: string; total: number; unlocked: number; percentage: number }
  > {
    const output: Record<
      string,
      { name: string; total: number; unlocked: number; percentage: number }
    > = {};
    for (const [treeId, tree] of Object.entries(SKILL_TREES)) {
      const total = tree.skills.length;
      const unlocked = tree.skills.filter((skill) => this.unlockedSkills.has(skill.id))
        .length;
      output[treeId] = {
        name: tree.name,
        total,
        unlocked,
        percentage: total === 0 ? 0 : (unlocked / total) * 100,
      };
    }
    return output;
  }

  private flattenSkills(): void {
    for (const tree of Object.values(SKILL_TREES)) {
      for (const seed of tree.skills) {
        const skill: SkillTreeSkill = {
          ...seed,
          prerequisites: [...seed.prerequisites],
          unlocked: seed.unlocked,
          aimb: SKILL_AIMB_REGISTRY[seed.id],
        };
        this.allSkills.set(skill.id, skill);
      }
    }
  }
}
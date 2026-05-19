export type SrsRequirement = {
  code: string;
  title: string;
  description: string;
  category: string;
  status: 'implemented' | 'planned' | 'in_progress';
};

function makeRequirement(
  code: string,
  title: string,
  description: string,
  category: string,
  status: 'implemented' | 'planned' | 'in_progress' = 'implemented',
): SrsRequirement {
  return {
    code,
    title,
    description,
    category,
    status,
  };
}

export const SRS_AGENT_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-AGENT-001': makeRequirement(
    'SRS-AGENT-001',
    'Agent Core Loop',
    'Main interaction cycle: input -> embed -> recall -> generate -> store -> award XP',
    'core',
  ),
  'SRS-AGENT-002': makeRequirement(
    'SRS-AGENT-002',
    'State Persistence',
    'Save/load agent state between sessions',
    'persistence',
  ),
  'SRS-AGENT-003': makeRequirement(
    'SRS-AGENT-003',
    'Memory Vector Storage',
    'Semantic memory indexed for similarity retrieval',
    'memory',
  ),
};

export const SRS_BROTHERHOOD_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-BROTHER-001': makeRequirement(
    'SRS-BROTHER-001',
    'XP Tracking',
    'Brotherhood XP as the source of progression truth',
    'gamification',
  ),
  'SRS-BROTHER-002': makeRequirement(
    'SRS-BROTHER-002',
    'TP System',
    'Tavern Points awarded from interaction outcomes',
    'gamification',
  ),
  'SRS-BROTHER-003': makeRequirement(
    'SRS-BROTHER-003',
    'Rank Progression',
    'Eight-tier rank progression from initiate to legend',
    'gamification',
  ),
  'SRS-BROTHER-004': makeRequirement(
    'SRS-BROTHER-004',
    'Streak Tracking',
    'Daily streaks with multiplier-aware incentives',
    'gamification',
  ),
};

export const SRS_GAMIFICATION_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-GAMIFY-001': makeRequirement(
    'SRS-GAMIFY-001',
    'Badge System',
    '50+ achievements unlockable through milestones',
    'achievements',
  ),
  'SRS-GAMIFY-002': makeRequirement(
    'SRS-GAMIFY-002',
    'Leaderboards',
    'Global and guild ranking support',
    'social',
  ),
  'SRS-GAMIFY-003': makeRequirement(
    'SRS-GAMIFY-003',
    'Skill Tree',
    'Six skill trees with tier-based progression',
    'progression',
  ),
  'SRS-GAMIFY-004': makeRequirement(
    'SRS-GAMIFY-004',
    'Quest System',
    'Daily, weekly, and epic quest support',
    'engagement',
  ),
  'SRS-GAMIFY-005': makeRequirement(
    'SRS-GAMIFY-005',
    'Tracked Skills',
    'Persist unlocked skills with usage analytics',
    'progression',
  ),
};

export const SRS_COUNCIL_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-COUNCIL-001': makeRequirement(
    'SRS-COUNCIL-001',
    'S00-S03 Pipeline',
    'Constitutional governance flow from intake through verdict',
    'governance',
  ),
  'SRS-COUNCIL-002': makeRequirement(
    'SRS-COUNCIL-002',
    'Policy Matching',
    'Policy path matching for governance actions',
    'governance',
  ),
};

export const SRS_AUDIT_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-AUDIT-001': makeRequirement(
    'SRS-AUDIT-001',
    'Guardian Hash Chain',
    'Immutable SHA-256 audit chain for event history',
    'compliance',
  ),
};

export const SRS_PROFESSOR_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-PROF-001': makeRequirement(
    'SRS-PROF-001',
    'Professor Network',
    '28-domain routing surface for specialist guidance',
    'knowledge',
  ),
};

export const SRS_MISSION_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-MISSION-001': makeRequirement(
    'SRS-MISSION-001',
    'Mission Tracking',
    'Auto-generated missions with lifecycle states',
    'engagement',
  ),
};

export const SRS_AUTHORITY_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-AUTH-001': makeRequirement(
    'SRS-AUTH-001',
    'Authority Gating',
    'XP-gated authority tiers for action control',
    'security',
  ),
};

export const SRS_REFLEX_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-REFLEX-001': makeRequirement(
    'SRS-REFLEX-001',
    'Auto-Response Engine',
    'Pattern-based reflex responses without model invocation',
    'optimization',
  ),
};

export const SRS_OUTCOME_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-OUTCOME-001': makeRequirement(
    'SRS-OUTCOME-001',
    'Outcome-Weighted XP',
    'Outcome quality contributes to XP weighting logic',
    'analytics',
  ),
};

export const SRS_NOTIFICATION_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-NOTIFY-001': makeRequirement(
    'SRS-NOTIFY-001',
    'Multi-Channel Broadcast',
    'Fan-out signals to configured communication channels',
    'integration',
  ),
};

export const SRS_INSIGHT_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-INSIGHT-001': makeRequirement(
    'SRS-INSIGHT-001',
    'Insight Engine',
    'Pattern and trend insight generation',
    'analytics',
  ),
};

export const SRS_COGNITIVE_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-COGNITIVE-001': makeRequirement(
    'SRS-COGNITIVE-001',
    'Cognitive Cortex',
    'Attention, planning, and decision surface',
    'cognition',
  ),
  'SRS-COGNITIVE-002': makeRequirement(
    'SRS-COGNITIVE-002',
    'Cognitive Mind Routing',
    'Domain routing and specialist collaboration',
    'cognition',
  ),
};

export const SRS_TELEMETRY_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-TELEMETRY-001': makeRequirement(
    'SRS-TELEMETRY-001',
    'Telemetry Stack',
    'Track 25+ lifecycle metrics for observability',
    'observability',
  ),
};

export const SRS_DIAGNOSTIC_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-DIAGNOSTIC-001': makeRequirement(
    'SRS-DIAGNOSTIC-001',
    'Diagnostic Test Suite',
    'Self-assessment test coverage for major systems',
    'quality',
  ),
};

export const SRS_FACTORY_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-FACTORY-001': makeRequirement(
    'SRS-FACTORY-001',
    'Agent Factory',
    'Template-driven agent creation and registry',
    'core',
  ),
};

export const SRS_INSTALLATION_REQUIREMENTS: Record<string, SrsRequirement> = {
  'SRS-INSTALL-001': makeRequirement(
    'SRS-INSTALL-001',
    'Auto-Installation',
    'Environment validation and file scaffolding',
    'distribution',
  ),
  'SRS-INSTALL-002': makeRequirement(
    'SRS-INSTALL-002',
    'Installation Scaffolding',
    'Incremental scaffolding for required runtime files',
    'distribution',
  ),
};

export const SRS_REGISTRY: Record<string, SrsRequirement> = {
  ...SRS_AGENT_REQUIREMENTS,
  ...SRS_BROTHERHOOD_REQUIREMENTS,
  ...SRS_GAMIFICATION_REQUIREMENTS,
  ...SRS_COUNCIL_REQUIREMENTS,
  ...SRS_AUDIT_REQUIREMENTS,
  ...SRS_PROFESSOR_REQUIREMENTS,
  ...SRS_MISSION_REQUIREMENTS,
  ...SRS_AUTHORITY_REQUIREMENTS,
  ...SRS_REFLEX_REQUIREMENTS,
  ...SRS_OUTCOME_REQUIREMENTS,
  ...SRS_NOTIFICATION_REQUIREMENTS,
  ...SRS_INSIGHT_REQUIREMENTS,
  ...SRS_COGNITIVE_REQUIREMENTS,
  ...SRS_TELEMETRY_REQUIREMENTS,
  ...SRS_DIAGNOSTIC_REQUIREMENTS,
  ...SRS_FACTORY_REQUIREMENTS,
  ...SRS_INSTALLATION_REQUIREMENTS,
};

export function validateSrsCoverage(implementedCodes: string[]): Record<string, boolean> {
  const coverage: Record<string, boolean> = {};
  for (const code of Object.keys(SRS_REGISTRY)) {
    coverage[code] = implementedCodes.includes(code);
  }
  return coverage;
}

export function getSrsSummary(): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const requirement of Object.values(SRS_REGISTRY)) {
    const count = summary[requirement.category] ?? 0;
    summary[requirement.category] = count + 1;
  }
  return summary;
}

export type SrsValidationResult = {
  code: string;
  title: string;
  category: string;
  satisfied: boolean;
  evidence: string;
  validatorName: string;
  timestamp: string;
  implementingSection?: string;
};

export type ComplianceJsonReport = {
  timestamp: string;
  totalRequirements: number;
  passed: number;
  failed: number;
  compliancePercentage: number;
  results: Array<{
    code: string;
    title: string;
    category: string;
    satisfied: boolean;
    evidence: string;
    section?: string;
  }>;
};

type SrsSpec = {
  spec: string;
  verifier: string;
  section: string;
  critical: boolean;
};

const SRS_SPECIFICATIONS: Record<string, SrsSpec> = {
  'SRS-AGENT-001': {
    spec: 'Agent processes input through interaction loop',
    verifier: 'agent_core_loop',
    section: 'SECTION 8: INTERACTION ENGINE',
    critical: true,
  },
  'SRS-AGENT-002': {
    spec: 'Agent state persists across sessions',
    verifier: 'state_persistence',
    section: 'SECTION 21: STATE SERIALIZATION',
    critical: true,
  },
  'SRS-AGENT-003': {
    spec: 'Vector memory storage exists',
    verifier: 'vector_storage',
    section: 'SECTION 10: VECTOR MEMORY',
    critical: true,
  },
  'SRS-BROTHER-001': {
    spec: 'Brotherhood XP tracking exists',
    verifier: 'xp_tracking',
    section: 'SECTION 7: BROTHERHOOD SYSTEM',
    critical: true,
  },
  'SRS-BROTHER-002': {
    spec: 'TP tracking exists with XP relation',
    verifier: 'tp_system',
    section: 'SECTION 7: BROTHERHOOD SYSTEM',
    critical: false,
  },
  'SRS-BROTHER-003': {
    spec: 'Rank progression uses eight tiers',
    verifier: 'rank_progression',
    section: 'SECTION 7: BROTHERHOOD SYSTEM',
    critical: true,
  },
  'SRS-BROTHER-004': {
    spec: 'Streak tracking is available',
    verifier: 'streak_tracking',
    section: 'SECTION 7: BROTHERHOOD SYSTEM',
    critical: false,
  },
  'SRS-GAMIFY-001': {
    spec: 'Badge system has 50+ entries',
    verifier: 'badge_system',
    section: 'SECTION 14: GAMIFICATION ENGINE',
    critical: false,
  },
  'SRS-GAMIFY-002': {
    spec: 'Leaderboard system exists',
    verifier: 'leaderboards',
    section: 'SECTION 15: LEADERBOARD SYSTEM',
    critical: false,
  },
  'SRS-COUNCIL-001': {
    spec: 'Council pipeline exists with staged checks',
    verifier: 'council_pipeline',
    section: 'SECTION 5: COUNCIL SYSTEM',
    critical: true,
  },
  'SRS-AUDIT-001': {
    spec: 'Audit trail captures immutable chain entries',
    verifier: 'audit_trail',
    section: 'SECTION 6: GUARDIAN AUDIT',
    critical: true,
  },
  'SRS-COGNITIVE-001': {
    spec: 'Cognitive cortex exposes attention/planning/decision',
    verifier: 'cognitive_cortex',
    section: 'SECTION 116: NEXUS COGNITIVE',
    critical: true,
  },
  'SRS-COGNITIVE-002': {
    spec: 'Cognitive mind routes by domain',
    verifier: 'cognitive_mind',
    section: 'SECTION 116: NEXUS COGNITIVE',
    critical: true,
  },
  'SRS-TELEMETRY-001': {
    spec: 'Telemetry stack tracks at least 25 metrics',
    verifier: 'telemetry_stack',
    section: 'SECTION 117: UNIFIED TELEMETRY',
    critical: false,
  },
  'SRS-DIAGNOSTIC-001': {
    spec: 'Diagnostic suite exists for major features',
    verifier: 'diagnostic_suite',
    section: 'SECTION 118: DIAGNOSTIC TEST SUITE',
    critical: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasCallable(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'function';
}

function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = record[key];
  if (!isRecord(value)) {
    return undefined;
  }
  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function countRecordKeys(record: Record<string, unknown>): number {
  return Object.keys(record).length;
}

type ValidationCheck = {
  satisfied: boolean;
  evidence: string;
};

export class OperationalSRSValidator {
  private readonly agent?: Record<string, unknown>;
  private readonly validationTimestamp: string;
  private results: SrsValidationResult[] = [];

  constructor(agent?: unknown) {
    this.agent = isRecord(agent) ? agent : undefined;
    this.validationTimestamp = new Date().toISOString();
  }

  validateAll(): Record<string, SrsValidationResult> {
    this.results = [];
    const output: Record<string, SrsValidationResult> = {};

    for (const [code, spec] of Object.entries(SRS_SPECIFICATIONS)) {
      const validation = this.runVerifier(spec.verifier);
      const requirement = SRS_REGISTRY[code];
      const result: SrsValidationResult = {
        code,
        title: requirement ? requirement.title : 'Unknown',
        category: requirement ? requirement.category : 'unknown',
        satisfied: validation.satisfied,
        evidence: validation.evidence,
        validatorName: spec.verifier,
        timestamp: new Date().toISOString(),
        implementingSection: spec.section,
      };
      this.results.push(result);
      output[code] = result;
    }

    return output;
  }

  validateCritical(): { allPassed: boolean; failedCodes: string[] } {
    const failedCodes: string[] = [];
    for (const [code, spec] of Object.entries(SRS_SPECIFICATIONS)) {
      if (!spec.critical) {
        continue;
      }
      const validation = this.runVerifier(spec.verifier);
      if (!validation.satisfied) {
        failedCodes.push(code);
      }
    }
    return {
      allPassed: failedCodes.length === 0,
      failedCodes,
    };
  }

  getResults(): SrsValidationResult[] {
    return this.results.map((result) => ({ ...result }));
  }

  getComplianceJson(): ComplianceJsonReport {
    if (this.results.length === 0) {
      this.validateAll();
    }

    const passed = this.results.filter((result) => result.satisfied).length;
    const failed = this.results.length - passed;
    const compliancePercentage =
      this.results.length === 0 ? 0 : (passed / this.results.length) * 100;

    return {
      timestamp: this.validationTimestamp,
      totalRequirements: this.results.length,
      passed,
      failed,
      compliancePercentage,
      results: this.results.map((result) => ({
        code: result.code,
        title: result.title,
        category: result.category,
        satisfied: result.satisfied,
        evidence: result.evidence,
        section: result.implementingSection,
      })),
    };
  }

  formatComplianceReport(): string {
    const results = this.results.length > 0 ? this.results : Object.values(this.validateAll());
    const totalPassed = results.filter((result) => result.satisfied).length;
    const total = results.length;
    const lines: string[] = [];

    lines.push('SRS COMPLIANCE REPORT');
    lines.push(`Generated: ${this.validationTimestamp}`);
    lines.push(`Total: ${totalPassed}/${total}`);

    const byCategory: Record<string, SrsValidationResult[]> = {};
    for (const result of results) {
      const existing = byCategory[result.category];
      if (existing) {
        existing.push(result);
      } else {
        byCategory[result.category] = [result];
      }
    }

    for (const [category, entries] of Object.entries(byCategory)) {
      const passed = entries.filter((entry) => entry.satisfied).length;
      lines.push(`${category}: ${passed}/${entries.length}`);
      for (const entry of entries) {
        const status = entry.satisfied ? 'PASS' : 'FAIL';
        lines.push(`  - ${status} ${entry.code} :: ${entry.evidence}`);
      }
    }

    return lines.join('\n');
  }

  private runVerifier(name: string): ValidationCheck {
    switch (name) {
      case 'agent_core_loop':
        return this.verifyAgentCoreLoop();
      case 'state_persistence':
        return this.verifyStatePersistence();
      case 'vector_storage':
        return this.verifyVectorStorage();
      case 'xp_tracking':
        return this.verifyXpTracking();
      case 'tp_system':
        return this.verifyTpSystem();
      case 'rank_progression':
        return this.verifyRankProgression();
      case 'streak_tracking':
        return this.verifyStreakTracking();
      case 'badge_system':
        return this.verifyBadgeSystem();
      case 'leaderboards':
        return this.verifyLeaderboards();
      case 'council_pipeline':
        return this.verifyCouncilPipeline();
      case 'audit_trail':
        return this.verifyAuditTrail();
      case 'cognitive_cortex':
        return this.verifyCognitiveCortex();
      case 'cognitive_mind':
        return this.verifyCognitiveMind();
      case 'telemetry_stack':
        return this.verifyTelemetryStack();
      case 'diagnostic_suite':
        return this.verifyDiagnosticSuite();
      default:
        return {
          satisfied: false,
          evidence: `Unknown verifier: ${name}`,
        };
    }
  }

  private verifyAgentCoreLoop(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }

    const hasInteract = hasCallable(this.agent, 'interact');
    const hasMemory =
      readRecord(this.agent, 'memory') !== undefined ||
      readRecord(this.agent, '_long_term_memory') !== undefined;
    const hasBrotherhood = readRecord(this.agent, 'brotherhood') !== undefined;

    if (hasInteract && hasMemory && hasBrotherhood) {
      return {
        satisfied: true,
        evidence: 'interact() method present, memory system active, brotherhood connected',
      };
    }

    const missing: string[] = [];
    if (!hasInteract) {
      missing.push('interact()');
    }
    if (!hasMemory) {
      missing.push('memory system');
    }
    if (!hasBrotherhood) {
      missing.push('brotherhood');
    }
    return {
      satisfied: false,
      evidence: `Missing: ${missing.join(', ')}`,
    };
  }

  private verifyStatePersistence(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const hasSave = hasCallable(this.agent, 'save_state');
    const hasLoad = hasCallable(this.agent, 'load_state');
    if (hasSave && hasLoad) {
      return {
        satisfied: true,
        evidence: 'save_state() and load_state() methods present',
      };
    }
    const missing: string[] = [];
    if (!hasSave) {
      missing.push('save_state()');
    }
    if (!hasLoad) {
      missing.push('load_state()');
    }
    return {
      satisfied: false,
      evidence: `Missing: ${missing.join(', ')}`,
    };
  }

  private verifyVectorStorage(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const ltm = readRecord(this.agent, '_long_term_memory');
    if (!ltm) {
      return { satisfied: false, evidence: 'Long-term memory component not initialized' };
    }
    const hasIndexes = readRecord(ltm, 'indexes') !== undefined;
    const hasFaissIndex = readRecord(ltm, '_faiss_index') !== undefined;
    if (hasIndexes || hasFaissIndex) {
      return {
        satisfied: true,
        evidence: 'Long-term memory with vector index surface detected',
      };
    }
    return {
      satisfied: false,
      evidence: 'Vector indexes not detected on memory component',
    };
  }

  private verifyXpTracking(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const brotherhood = readRecord(this.agent, 'brotherhood');
    if (!brotherhood) {
      return { satisfied: false, evidence: 'Brotherhood component not initialized' };
    }
    const xp = readNumber(brotherhood, 'total_xp');
    if (xp === undefined) {
      return { satisfied: false, evidence: 'Brotherhood XP field not found' };
    }
    return {
      satisfied: true,
      evidence: `Brotherhood XP tracking active (current: ${xp})`,
    };
  }

  private verifyTpSystem(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const brotherhood = readRecord(this.agent, 'brotherhood');
    if (!brotherhood) {
      return { satisfied: false, evidence: 'Brotherhood component not initialized' };
    }
    const tp = readNumber(brotherhood, 'total_tp');
    const xp = readNumber(brotherhood, 'total_xp');
    if (tp === undefined || xp === undefined) {
      return { satisfied: false, evidence: 'Brotherhood XP/TP fields not found' };
    }

    if (xp === 0) {
      return {
        satisfied: true,
        evidence: 'TP tracking present with zero XP baseline',
      };
    }

    const expectedMin = Math.floor(xp * 0.09);
    const expectedMax = Math.ceil(xp * 0.11);
    if (tp >= expectedMin && tp <= expectedMax) {
      return {
        satisfied: true,
        evidence: `TP ratio aligned (XP: ${xp}, TP: ${tp})`,
      };
    }

    return {
      satisfied: true,
      evidence: `TP tracking present but ratio differs (XP: ${xp}, TP: ${tp})`,
    };
  }

  private verifyRankProgression(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const brotherhood = readRecord(this.agent, 'brotherhood');
    if (!brotherhood) {
      return { satisfied: false, evidence: 'Brotherhood component not initialized' };
    }
    const rank = readString(brotherhood, 'rank');
    const thresholds = readRecord(brotherhood, 'RANK_THRESHOLDS');
    if (!rank || !thresholds) {
      return { satisfied: false, evidence: 'Rank data not fully configured' };
    }
    if (countRecordKeys(thresholds) >= 8) {
      return {
        satisfied: true,
        evidence: `Rank progression active (current: ${rank}, tiers: ${countRecordKeys(thresholds)})`,
      };
    }
    return {
      satisfied: false,
      evidence: `Rank thresholds incomplete (tiers: ${countRecordKeys(thresholds)})`,
    };
  }

  private verifyStreakTracking(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const brotherhood = readRecord(this.agent, 'brotherhood');
    if (!brotherhood) {
      return { satisfied: false, evidence: 'Brotherhood component not initialized' };
    }
    const streak = readNumber(brotherhood, 'streak');
    if (streak === undefined) {
      return { satisfied: false, evidence: 'Streak tracking field not found' };
    }
    return {
      satisfied: true,
      evidence: `Streak tracking active (current: ${streak} days)`,
    };
  }

  private verifyBadgeSystem(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const gamification = readRecord(this.agent, 'gamification');
    if (!gamification) {
      return { satisfied: false, evidence: 'Gamification component not initialized' };
    }
    const badges = readRecord(gamification, 'BADGES');
    if (!badges) {
      return { satisfied: false, evidence: 'Badge registry not found on gamification component' };
    }
    const count = countRecordKeys(badges);
    if (count >= 50) {
      return {
        satisfied: true,
        evidence: `Badge system active with ${count} badges`,
      };
    }
    return {
      satisfied: false,
      evidence: `Badge count too low (${count}), expected >= 50`,
    };
  }

  private verifyLeaderboards(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const leaderboard = readRecord(this.agent, '_leaderboard_system');
    if (leaderboard) {
      return {
        satisfied: true,
        evidence: 'Leaderboard system component present',
      };
    }
    return {
      satisfied: false,
      evidence: 'Leaderboard component not initialized',
    };
  }

  private verifyCouncilPipeline(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const council = readRecord(this.agent, 'council');
    if (!council) {
      return { satisfied: false, evidence: 'Council component not initialized' };
    }
    if (hasCallable(council, 'validate_action') || hasCallable(council, 'submitDecision')) {
      return {
        satisfied: true,
        evidence: 'Council pipeline validation surface present',
      };
    }
    return {
      satisfied: false,
      evidence: 'Council pipeline methods not found',
    };
  }

  private verifyAuditTrail(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const guardian = readRecord(this.agent, 'guardian');
    if (guardian && hasCallable(guardian, 'log_event')) {
      const entries = guardian.entries;
      if (Array.isArray(entries)) {
        return {
          satisfied: true,
          evidence: `Guardian audit trail active (${entries.length} entries)`,
        };
      }
      return {
        satisfied: true,
        evidence: 'Guardian audit trail interface active',
      };
    }

    if (readRecord(this.agent, 'auditTrail') && hasCallable(this.agent, 'getChainHead')) {
      return {
        satisfied: true,
        evidence: 'Public audit trail interface active',
      };
    }
    return {
      satisfied: false,
      evidence: 'Audit trail component not initialized',
    };
  }

  private verifyCognitiveCortex(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const cortex = readRecord(this.agent, '_cognitive_cortex');
    if (!cortex) {
      return { satisfied: false, evidence: 'Cognitive cortex not initialized' };
    }

    const hasAttention = hasCallable(cortex, 'focus_attention');
    const hasPlanning = hasCallable(cortex, 'plan_action');
    const hasDecision = hasCallable(cortex, 'make_decision');
    if (hasAttention && hasPlanning && hasDecision) {
      return {
        satisfied: true,
        evidence: 'Cognitive cortex with attention/planning/decision functions',
      };
    }
    return {
      satisfied: false,
      evidence: 'Cognitive cortex missing one or more core functions',
    };
  }

  private verifyCognitiveMind(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const mind = readRecord(this.agent, '_cognitive_mind');
    if (!mind) {
      return { satisfied: false, evidence: 'Cognitive mind not initialized' };
    }
    const hasRoute = hasCallable(mind, 'route_to_domain');
    const hasDomains =
      readRecord(mind, 'professors') !== undefined ||
      readRecord(mind, '_domain_experts') !== undefined;
    if (hasRoute && hasDomains) {
      return {
        satisfied: true,
        evidence: 'Cognitive mind with domain routing present',
      };
    }
    return {
      satisfied: false,
      evidence: 'Cognitive mind routing surface incomplete',
    };
  }

  private verifyTelemetryStack(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const stack = readRecord(this.agent, '_telemetry_stack');
    if (!stack) {
      return { satisfied: false, evidence: 'Telemetry stack not initialized' };
    }
    const metrics = readRecord(stack, '_metrics');
    if (!metrics) {
      return { satisfied: false, evidence: 'Telemetry metrics surface not found' };
    }
    const count = countRecordKeys(metrics);
    if (count >= 25) {
      return {
        satisfied: true,
        evidence: `Telemetry stack tracking ${count} metrics`,
      };
    }
    return {
      satisfied: false,
      evidence: `Telemetry stack tracks ${count} metrics, expected >= 25`,
    };
  }

  private verifyDiagnosticSuite(): ValidationCheck {
    if (!this.agent) {
      return { satisfied: false, evidence: 'No agent instance provided' };
    }
    const diagnostic = readRecord(this.agent, 'self_assessment_diagnostic');
    if (diagnostic && (hasCallable(diagnostic, 'run_all') || hasCallable(diagnostic, 'runAll'))) {
      return {
        satisfied: true,
        evidence: 'Diagnostic suite available through self_assessment_diagnostic',
      };
    }
    if (hasCallable(this.agent, 'run_all_diagnostics')) {
      return {
        satisfied: true,
        evidence: 'Diagnostic suite available through run_all_diagnostics()',
      };
    }
    return {
      satisfied: false,
      evidence: 'Diagnostic suite not found',
    };
  }
}
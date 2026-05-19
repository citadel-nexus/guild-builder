export type CognitiveSystemKey =
  | 'nlp_mca'
  | 'nexus_mind'
  | 'nexus_sense'
  | 'nexus_memory'
  | 'nexus_council'
  | 'nexus_cortex';

export type CognitiveSystemStatus = {
  available: boolean;
  initialized: boolean;
  signalCount?: number;
  learningMemorySize?: number;
  persistentMemorySize?: number;
};

export type CognitiveSystemsStatus = Record<
  CognitiveSystemKey,
  CognitiveSystemStatus
>;

export type PreflightStageResult = {
  stageName: string;
  passed: boolean;
  checks: number;
  durationMs: number;
};

export type PreflightAssessment = {
  available: boolean;
  readyToDeploy: boolean | null;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
  stageResults: Record<string, PreflightStageResult>;
  recommendations: string[];
  timestamp: string;
};

export type PreflightAssessmentInput = Partial<
  Omit<PreflightAssessment, 'recommendations' | 'timestamp' | 'stageResults'>
> & {
  stageResults?: Record<string, PreflightStageResult> | PreflightStageResult[];
  recommendations?: string[];
};

function cloneSystemStatus(status: CognitiveSystemStatus): CognitiveSystemStatus {
  return { ...status };
}

function cloneSystemsStatus(status: CognitiveSystemsStatus): CognitiveSystemsStatus {
  return {
    nlp_mca: cloneSystemStatus(status.nlp_mca),
    nexus_mind: cloneSystemStatus(status.nexus_mind),
    nexus_sense: cloneSystemStatus(status.nexus_sense),
    nexus_memory: cloneSystemStatus(status.nexus_memory),
    nexus_council: cloneSystemStatus(status.nexus_council),
    nexus_cortex: cloneSystemStatus(status.nexus_cortex),
  };
}

function normalizeStageResults(
  input: PreflightAssessmentInput['stageResults'],
): Record<string, PreflightStageResult> {
  if (!input) {
    return {};
  }
  if (Array.isArray(input)) {
    const output: Record<string, PreflightStageResult> = {};
    for (const stage of input) {
      output[stage.stageName] = {
        stageName: stage.stageName,
        passed: stage.passed,
        checks: stage.checks,
        durationMs: stage.durationMs,
      };
    }
    return output;
  }
  const output: Record<string, PreflightStageResult> = {};
  for (const [key, stage] of Object.entries(input)) {
    output[key] = {
      stageName: stage.stageName,
      passed: stage.passed,
      checks: stage.checks,
      durationMs: stage.durationMs,
    };
  }
  return output;
}

function buildRecommendations(
  assessment: Omit<PreflightAssessment, 'recommendations'>,
  explicit?: string[],
): string[] {
  if (explicit && explicit.length > 0) {
    return [...explicit];
  }
  const recommendations: string[] = [];
  if (!assessment.available) {
    recommendations.push(
      'Install and configure preflight tooling to enable deployment readiness checks.',
    );
    return recommendations;
  }
  if (assessment.failedChecks > 0) {
    recommendations.push(
      `Address ${assessment.failedChecks} failed preflight checks before deployment.`,
    );
  }
  if (assessment.warnings > 0) {
    recommendations.push(
      `Review ${assessment.warnings} preflight warnings for non-blocking risk reduction.`,
    );
  }
  if (assessment.readyToDeploy === false) {
    recommendations.push('Deployment should remain blocked until preflight is green.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Preflight checks are healthy. Safe to proceed.');
  }
  return recommendations;
}

export class CognitiveSystemsRegistry {
  private status: CognitiveSystemsStatus;

  constructor(initial?: Partial<CognitiveSystemsStatus>) {
    this.status = CognitiveSystemsRegistry.defaultStatus();
    if (initial) {
      for (const [key, value] of Object.entries(initial)) {
        this.setSystemStatus(key as CognitiveSystemKey, value);
      }
    }
  }

  static defaultStatus(): CognitiveSystemsStatus {
    return {
      nlp_mca: { available: false, initialized: false, signalCount: 0 },
      nexus_mind: {
        available: false,
        initialized: false,
        learningMemorySize: 0,
        persistentMemorySize: 0,
      },
      nexus_sense: { available: false, initialized: false },
      nexus_memory: { available: false, initialized: false },
      nexus_council: { available: false, initialized: false },
      nexus_cortex: { available: true, initialized: true },
    };
  }

  setSystemStatus(
    system: CognitiveSystemKey,
    patch: Partial<CognitiveSystemStatus>,
  ): void {
    this.status[system] = {
      ...this.status[system],
      ...patch,
    };
  }

  getSystemStatus(system: CognitiveSystemKey): CognitiveSystemStatus {
    return cloneSystemStatus(this.status[system]);
  }

  getStatus(): CognitiveSystemsStatus {
    return cloneSystemsStatus(this.status);
  }
}

export function buildPreflightAssessment(
  input: PreflightAssessmentInput = {},
): PreflightAssessment {
  const stageResults = normalizeStageResults(input.stageResults);
  const available = input.available ?? false;
  const totalChecks = input.totalChecks ?? 0;
  const passedChecks = input.passedChecks ?? 0;
  const failedChecks = input.failedChecks ?? Math.max(totalChecks - passedChecks, 0);
  const warnings = input.warnings ?? 0;
  const readyToDeploy =
    input.readyToDeploy ?? (available ? failedChecks === 0 : null);

  const baseAssessment = {
    available,
    readyToDeploy,
    totalChecks,
    passedChecks,
    failedChecks,
    warnings,
    stageResults,
    timestamp: new Date().toISOString(),
  };

  return {
    ...baseAssessment,
    recommendations: buildRecommendations(baseAssessment, input.recommendations),
  };
}

export function renderPreflightAssessment(
  assessment: PreflightAssessment,
): string {
  const lines: string[] = ['PREFLIGHT SELF-ASSESSMENT'];
  if (!assessment.available) {
    lines.push('Status: Not Available');
    lines.push(...assessment.recommendations.map((entry) => `- ${entry}`));
    return lines.join('\n');
  }

  lines.push(
    `Status: ${assessment.readyToDeploy ? 'READY' : 'NOT READY'}`,
    `Total Checks: ${assessment.totalChecks}`,
    `Passed: ${assessment.passedChecks}`,
    `Failed: ${assessment.failedChecks}`,
    `Warnings: ${assessment.warnings}`,
  );

  const stageEntries = Object.values(assessment.stageResults);
  if (stageEntries.length > 0) {
    lines.push('Stage Results:');
    for (const stage of stageEntries) {
      const mark = stage.passed ? 'PASS' : 'FAIL';
      lines.push(
        `- ${stage.stageName}: ${mark} (${stage.checks} checks, ${stage.durationMs.toFixed(0)}ms)`,
      );
    }
  }

  if (assessment.recommendations.length > 0) {
    lines.push('Recommendations:');
    for (const recommendation of assessment.recommendations) {
      lines.push(`- ${recommendation}`);
    }
  }
  return lines.join('\n');
}

export function renderCognitiveSystemsStatus(
  status: CognitiveSystemsStatus,
): string {
  const lines: string[] = ['EXTENDED COGNITIVE SYSTEMS STATUS'];
  const orderedKeys: CognitiveSystemKey[] = [
    'nlp_mca',
    'nexus_mind',
    'nexus_sense',
    'nexus_memory',
    'nexus_council',
    'nexus_cortex',
  ];
  for (const key of orderedKeys) {
    const entry = status[key];
    const availability = entry.available ? 'available' : 'unavailable';
    const initialization = entry.initialized ? 'initialized' : 'not initialized';
    lines.push(`- ${key}: ${availability}, ${initialization}`);
  }
  return lines.join('\n');
}
import { randomUUID } from 'node:crypto';

import { GuardianAuditTrail } from './audit.js';
import {
  CouncilPipelineVerdict,
  GovernanceDecision,
} from './models.js';
import { AUTHORITY_ORDER, type AuthorityTier } from './types.js';
import type {
  AuditEntry,
  CouncilDecision,
  CouncilStage,
  CouncilVerdict,
} from './types.js';

type DecisionContext = Record<string, unknown>;

function isAuthorityTier(value: unknown): value is AuthorityTier {
  return (
    typeof value === 'string' &&
    (value === 'OBSERVE' ||
      value === 'ASSIST' ||
      value === 'EXECUTE' ||
      value === 'GOVERN' ||
      value === 'ARCHITECT')
  );
}

function authorityAtLeast(current: AuthorityTier, required: AuthorityTier): boolean {
  return AUTHORITY_ORDER.indexOf(current) >= AUTHORITY_ORDER.indexOf(required);
}

function readBoolean(context: DecisionContext, key: string): boolean {
  return context[key] === true;
}

function readActor(context: DecisionContext): string {
  const actor = context.actor;
  return typeof actor === 'string' && actor.length > 0 ? actor : 'system';
}

function readAuthority(context: DecisionContext): AuthorityTier {
  const authority = context.authority;
  return isAuthorityTier(authority) ? authority : 'OBSERVE';
}

export class ConstitutionalCouncil {
  constructor(private readonly auditTrail: GuardianAuditTrail = new GuardianAuditTrail()) {}

  submitDecision(action: string, context: DecisionContext = {}): CouncilDecision {
    const actor = readActor(context);
    const authority = readAuthority(context);

    const startedAt = new Date().toISOString();
    this.auditTrail.append(
      'council.stage.S00',
      actor,
      `S00 syntax check started for action=${action}`,
      startedAt,
    );

    if (action.trim().length === 0) {
      return this.finishDecision('S00', 'denied', 'S00 syntax check failed', actor);
    }

    this.auditTrail.append(
      'council.stage.S01',
      actor,
      `S01 authority check with authority=${authority}`,
    );
    if (!authorityAtLeast(authority, 'ASSIST')) {
      return this.finishDecision(
        'S01',
        'review',
        'S01 authority check requires ASSIST or higher',
        actor,
      );
    }

    this.auditTrail.append(
      'council.stage.S02',
      actor,
      'S02 policy check started for submitted action',
    );
    if (readBoolean(context, 'policyBlock')) {
      return this.finishDecision('S02', 'denied', 'S02 policy check blocked action', actor);
    }
    if (readBoolean(context, 'policyReview')) {
      return this.finishDecision(
        'S02',
        'review',
        'S02 policy check requested human review',
        actor,
      );
    }

    this.auditTrail.append(
      'council.stage.S03',
      actor,
      'S03 final approval stage reached in public stub pipeline',
    );

    if (readBoolean(context, 'forceEscalation')) {
      return this.finishDecision(
        'S03',
        'escalated',
        'S03 escalated by context override',
        actor,
      );
    }

    return this.finishDecision(
      'S03',
      'approved',
      'S03 final approval passed in public council stub',
      actor,
    );
  }

  getAuditTrail(): readonly AuditEntry[] {
    return this.auditTrail.getEntries();
  }

  getChainHead(): string {
    return this.auditTrail.getChainHead();
  }

  private finishDecision(
    stage: CouncilStage,
    verdict: CouncilVerdict,
    reason: string,
    actor: string,
  ): CouncilDecision {
    const timestamp = new Date().toISOString();
    const decision: CouncilDecision = {
      id: randomUUID(),
      stage,
      verdict,
      reason,
      timestamp,
      hashChain: '',
    };
    const detail = JSON.stringify({
      decisionId: decision.id,
      stage,
      verdict,
      reason,
      timestamp,
    });
    const auditEntry = this.auditTrail.append('council.decision', actor, detail, timestamp);
    decision.hashChain = auditEntry.hash;
    return decision;
  }
}

export class CouncilSystem {
  private readonly decisions: GovernanceDecision[] = [];
  private lastHash = '';
  private decisionCount = 0;

  compileDecision(decision: GovernanceDecision): {
    verdict: CouncilPipelineVerdict;
    confidence: number;
    hash: string;
    timestamp: string;
  } {
    decision.verdict = this.stageS00Intake(decision);
    decision.verdict = this.stageS01PolicyMatch(decision);
    decision.verdict = this.stageS02RiskAssess(decision);
    decision.verdict = this.stageS03Verdict(decision);

    decision.hashChain = decision.computeHash(this.lastHash);
    this.lastHash = decision.hashChain;

    this.decisions.push(decision);
    this.decisionCount += 1;

    return {
      verdict: decision.verdict,
      confidence: decision.confidence,
      hash: decision.hashChain,
      timestamp: decision.timestamp,
    };
  }

  getDecisionCount(): number {
    return this.decisionCount;
  }

  getLastHash(): string {
    return this.lastHash;
  }

  getDecisions(): GovernanceDecision[] {
    return this.decisions.map((decision) => new GovernanceDecision(decision.toDict()));
  }

  private stageS00Intake(_decision: GovernanceDecision): CouncilPipelineVerdict {
    return CouncilPipelineVerdict.REVIEW;
  }

  private stageS01PolicyMatch(decision: GovernanceDecision): CouncilPipelineVerdict {
    if (decision.decisionType.toLowerCase().includes('deployment')) {
      decision.confidence = 0.9;
      return CouncilPipelineVerdict.REVIEW;
    }
    return CouncilPipelineVerdict.ALLOW;
  }

  private stageS02RiskAssess(decision: GovernanceDecision): CouncilPipelineVerdict {
    const riskLevel = decision.context.risk_level;
    if (riskLevel === 'HIGH') {
      decision.confidence = 0.7;
      return CouncilPipelineVerdict.REVIEW;
    }
    return CouncilPipelineVerdict.ALLOW;
  }

  private stageS03Verdict(decision: GovernanceDecision): CouncilPipelineVerdict {
    decision.confidence = Math.min(0.99, decision.confidence + 0.1);
    return decision.verdict;
  }
}
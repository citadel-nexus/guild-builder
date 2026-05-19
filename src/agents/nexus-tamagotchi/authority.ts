import { BrotherhoodSystem } from './brotherhood.js';

export enum AuthorityGateTier {
  OBSERVE = 'OBSERVE',
  ASSIST = 'ASSIST',
  EXECUTE = 'EXECUTE',
  GOVERN = 'GOVERN',
  META = 'META',
}

export type AuthorityCheck = {
  action: string;
  requiredTier: AuthorityGateTier;
  userTier: AuthorityGateTier;
  allowed: boolean;
  reason: string;
  timestamp: string;
};

const TIER_THRESHOLDS: Record<AuthorityGateTier, number> = {
  [AuthorityGateTier.OBSERVE]: 0,
  [AuthorityGateTier.ASSIST]: 250,
  [AuthorityGateTier.EXECUTE]: 1000,
  [AuthorityGateTier.GOVERN]: 5000,
  [AuthorityGateTier.META]: 25000,
};

const TIER_ORDER: AuthorityGateTier[] = [
  AuthorityGateTier.OBSERVE,
  AuthorityGateTier.ASSIST,
  AuthorityGateTier.EXECUTE,
  AuthorityGateTier.GOVERN,
  AuthorityGateTier.META,
];

const ACTION_REQUIREMENTS: Record<string, AuthorityGateTier> = {
  view_status: AuthorityGateTier.OBSERVE,
  view_memories: AuthorityGateTier.OBSERVE,
  view_leaderboard: AuthorityGateTier.OBSERVE,
  interact: AuthorityGateTier.ASSIST,
  search_knowledge: AuthorityGateTier.ASSIST,
  ask_professor: AuthorityGateTier.ASSIST,
  complete_mission: AuthorityGateTier.EXECUTE,
  unlock_skill: AuthorityGateTier.EXECUTE,
  claim_reward: AuthorityGateTier.EXECUTE,
  modify_policy: AuthorityGateTier.GOVERN,
  approve_decision: AuthorityGateTier.GOVERN,
  grant_xp: AuthorityGateTier.GOVERN,
  self_modify: AuthorityGateTier.META,
  override_council: AuthorityGateTier.META,
  reset_agent: AuthorityGateTier.META,
};

export class AuthorityGate {
  readonly checkHistory: AuthorityCheck[] = [];

  constructor(private readonly brotherhood: BrotherhoodSystem) {}

  getUserTier(): AuthorityGateTier {
    const xp = this.brotherhood.totalXp;
    for (let index = TIER_ORDER.length - 1; index >= 0; index -= 1) {
      const tier = TIER_ORDER[index];
      if (xp >= TIER_THRESHOLDS[tier]) {
        return tier;
      }
    }
    return AuthorityGateTier.OBSERVE;
  }

  canPerform(action: string): AuthorityCheck {
    const requiredTier = ACTION_REQUIREMENTS[action] ?? AuthorityGateTier.EXECUTE;
    const userTier = this.getUserTier();
    const userXp = this.brotherhood.totalXp;
    const requiredXp = TIER_THRESHOLDS[requiredTier];

    const allowed = userXp >= requiredXp;
    const check: AuthorityCheck = {
      action,
      requiredTier,
      userTier,
      allowed,
      reason: `User has ${userXp} XP (${userTier}), action requires ${requiredXp} XP (${requiredTier})`,
      timestamp: new Date().toISOString(),
    };
    this.checkHistory.push(check);
    return check;
  }

  require(action: string): true {
    const check = this.canPerform(action);
    if (!check.allowed) {
      throw new Error(`Authority denied: ${check.reason}`);
    }
    return true;
  }
}
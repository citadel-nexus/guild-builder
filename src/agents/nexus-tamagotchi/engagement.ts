import { GameRank } from './models.js';

type RankThresholdInfo = {
  xp: number;
  nextXp: number | null;
};

type XpProgress = {
  progress: number;
  toNext: number;
  nextRank: GameRank | null;
};

const RANK_ORDER: GameRank[] = [
  GameRank.INITIATE,
  GameRank.APPRENTICE,
  GameRank.JOURNEYMAN,
  GameRank.EXPERT,
  GameRank.MASTER,
  GameRank.LEGEND,
  GameRank.ARCHITECT,
  GameRank.SAGE,
];

const RANK_THRESHOLDS: Record<GameRank, RankThresholdInfo> = {
  [GameRank.INITIATE]: { xp: 0, nextXp: 500 },
  [GameRank.APPRENTICE]: { xp: 500, nextXp: 1500 },
  [GameRank.JOURNEYMAN]: { xp: 1500, nextXp: 3500 },
  [GameRank.EXPERT]: { xp: 3500, nextXp: 7000 },
  [GameRank.MASTER]: { xp: 7000, nextXp: 12000 },
  [GameRank.LEGEND]: { xp: 12000, nextXp: 20000 },
  [GameRank.ARCHITECT]: { xp: 20000, nextXp: 35000 },
  [GameRank.SAGE]: { xp: 35000, nextXp: null },
};

const UPGRADE_PATHS: Record<GameRank, string[]> = {
  [GameRank.INITIATE]: [
    'Basic conversation memory',
    'XP tracking system',
    'Simple reflexes',
  ],
  [GameRank.APPRENTICE]: [
    'Enhanced memory recall',
    'Council consultation access',
    'Mission system unlocked',
    'Badge collection enabled',
  ],
  [GameRank.JOURNEYMAN]: [
    'Professor network routing',
    'Multi-channel notifications',
    'Authority gating tier 1',
    'Skill tree access',
  ],
  [GameRank.EXPERT]: [
    'Advanced governance pipeline',
    'Memory orchestration hooks',
    'Web enrichment routing',
    'Authority gating tier 2',
  ],
  [GameRank.MASTER]: [
    'Cognition engine interfaces',
    'Meta-orchestration hooks',
    'Evolution engine stubs',
    'Authority gating tier 3',
  ],
  [GameRank.LEGEND]: [
    'Self-model interfaces',
    'Knowledge synthesis pipeline',
    'Autonomous goal planning',
    'Full authority access',
  ],
  [GameRank.ARCHITECT]: [
    'System architecture control',
    'Integration bridge mastery',
    'Custom workflow composition',
    'Council override candidate',
  ],
  [GameRank.SAGE]: [
    'Transcendent mode',
    'Full system awareness',
    'Legacy creation path',
    'Brotherhood leadership',
  ],
};

export class ZayaraEngagementEngine {
  generatePromotionMessage(
    oldRank: GameRank,
    newRank: GameRank,
    totalXp: number,
  ): string {
    const upgrades = UPGRADE_PATHS[newRank] ?? [];
    const thresholdInfo = RANK_THRESHOLDS[newRank];
    const lines: string[] = [
      `RANK PROMOTION: ${oldRank} -> ${newRank}!`,
      '',
      `Total XP: ${totalXp}`,
    ];

    if (thresholdInfo.nextXp === null) {
      lines.push('You have reached the highest rank!');
    } else {
      lines.push(
        `Next rank at: ${thresholdInfo.nextXp} XP (${Math.max(0, thresholdInfo.nextXp - totalXp)} XP to go)`,
      );
    }

    if (upgrades.length > 0) {
      lines.push('');
      lines.push('New capabilities unlocked:');
      for (const upgrade of upgrades) {
        lines.push(`  + ${upgrade}`);
      }
    }

    return lines.join('\n');
  }

  getXpProgress(currentRank: GameRank, totalXp: number): XpProgress {
    const info = RANK_THRESHOLDS[currentRank];
    if (info.nextXp === null) {
      return {
        progress: 100,
        toNext: 0,
        nextRank: null,
      };
    }
    const numerator = totalXp - info.xp;
    const denominator = info.nextXp - info.xp;
    const progress = denominator <= 0 ? 100 : (numerator / denominator) * 100;
    return {
      progress: Math.max(0, Math.min(100, progress)),
      toNext: Math.max(0, info.nextXp - totalXp),
      nextRank: this.getNextRank(currentRank),
    };
  }

  private getNextRank(rank: GameRank): GameRank | null {
    const index = RANK_ORDER.indexOf(rank);
    if (index < 0 || index >= RANK_ORDER.length - 1) {
      return null;
    }
    return RANK_ORDER[index + 1];
  }
}
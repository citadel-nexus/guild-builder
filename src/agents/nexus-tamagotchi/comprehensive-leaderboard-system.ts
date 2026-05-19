import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import type { BrotherhoodSystem } from "./brotherhood.js";

export enum ComprehensiveLeaderboardType {
  GLOBAL = "global",
  GUILD = "guild",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  ALL_TIME = "all_time",
  SPECIALTY = "specialty",
}

export enum ComprehensiveLeaderboardMetric {
  TOTAL_XP = "total_xp",
  TOTAL_TP = "total_tp",
  INTERACTIONS = "interactions",
  STREAK = "streak",
  BADGES = "badges",
  SKILLS = "skills",
  QUESTS = "quests",
  TRUST = "trust",
}

export type ComprehensiveLeaderboardEntry = {
  userId: string;
  userName: string;
  rank: number;
  score: number;
  metric: ComprehensiveLeaderboardMetric;
  change: number;
  badgesCount: number;
  rankTitle: string;
  avatar: string;
  guild?: string;
  lastActive?: string;
};

export type ComprehensiveCompetition = {
  id: string;
  name: string;
  description: string;
  metric: ComprehensiveLeaderboardMetric;
  startTime: string;
  endTime: string;
  isActive: boolean;
  minParticipants: number;
  firstPlaceXp: number;
  firstPlaceTp: number;
  firstPlaceBadge?: string;
  secondPlaceXp: number;
  secondPlaceTp: number;
  thirdPlaceXp: number;
  thirdPlaceTp: number;
  participationXp: number;
  participationTp: number;
  participants: string[];
  winners: string[];
};

export type ComprehensiveLeaderboardSystemOptions = {
  storageDir?: string;
  brotherhood?: BrotherhoodSystem;
  now?: () => Date;
};

function isCompetitionEnded(competition: ComprehensiveCompetition, now: Date): boolean {
  const endTime = new Date(competition.endTime);
  return now.getTime() > endTime.getTime();
}

export class ComprehensiveLeaderboardSystem {
  private readonly storageDir: string;
  private readonly stateFile: string;
  private readonly now: () => Date;
  private readonly brotherhood?: BrotherhoodSystem;

  readonly leaderboards = new Map<string, ComprehensiveLeaderboardEntry[]>();
  readonly competitions = new Map<string, ComprehensiveCompetition>();
  readonly userStats: Record<string, Record<string, number | string>> = {};

  constructor(options: ComprehensiveLeaderboardSystemOptions = {}) {
    this.storageDir =
      options.storageDir ?? join(process.cwd(), ".nexus_cache", "leaderboards-comprehensive");
    this.stateFile = join(this.storageDir, "leaderboard_state.json");
    this.now = options.now ?? (() => new Date());
    this.brotherhood = options.brotherhood;
    mkdirSync(this.storageDir, { recursive: true });
    this.initializeLeaderboards();
    this.loadState();
  }

  updateUserStats(
    userId: string,
    userName: string,
    stats: Partial<Record<string, number | string>>,
  ): void {
    if (!this.userStats[userId]) {
      this.userStats[userId] = {
        user_name: userName,
        total_xp: 0,
        total_tp: 0,
        interactions: 0,
        streak: 0,
        badges: 0,
        skills: 0,
        quests: 0,
        trust: 0,
        rank_title: "INITIATE",
      };
    }
    this.userStats[userId] = {
      ...this.userStats[userId],
      ...stats,
      user_name: userName,
    };
    this.rebuildLeaderboards();
    this.saveState();
  }

  getLeaderboard(
    metric: ComprehensiveLeaderboardMetric,
    leaderboardType: ComprehensiveLeaderboardType = ComprehensiveLeaderboardType.GLOBAL,
    limit = 10,
    offset = 0,
  ): ComprehensiveLeaderboardEntry[] {
    const key = `${leaderboardType}_${metric}`;
    const entries = this.leaderboards.get(key) ?? [];
    return entries.slice(offset, offset + limit);
  }

  getUserRank(
    userId: string,
    metric: ComprehensiveLeaderboardMetric,
  ): ComprehensiveLeaderboardEntry | undefined {
    const key = `${ComprehensiveLeaderboardType.GLOBAL}_${metric}`;
    const entries = this.leaderboards.get(key) ?? [];
    return entries.find((entry) => entry.userId === userId);
  }

  createCompetition(input: {
    name: string;
    description: string;
    metric: ComprehensiveLeaderboardMetric;
    durationDays?: number;
    prizes?: Partial<{
      firstXp: number;
      firstTp: number;
      secondXp: number;
      secondTp: number;
      thirdXp: number;
      thirdTp: number;
    }>;
  }): ComprehensiveCompetition {
    const durationDays = Math.max(1, Math.floor(input.durationDays ?? 7));
    const competition: ComprehensiveCompetition = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      metric: input.metric,
      startTime: this.now().toISOString(),
      endTime: new Date(
        this.now().getTime() + durationDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      isActive: true,
      minParticipants: 10,
      firstPlaceXp: input.prizes?.firstXp ?? 1000,
      firstPlaceTp: input.prizes?.firstTp ?? 500,
      secondPlaceXp: input.prizes?.secondXp ?? 500,
      secondPlaceTp: input.prizes?.secondTp ?? 250,
      thirdPlaceXp: input.prizes?.thirdXp ?? 250,
      thirdPlaceTp: input.prizes?.thirdTp ?? 125,
      participationXp: 50,
      participationTp: 25,
      participants: [],
      winners: [],
    };
    this.competitions.set(competition.id, competition);
    this.saveState();
    return competition;
  }

  joinCompetition(
    competitionId: string,
    userId: string,
  ): { success: boolean; message: string } {
    const competition = this.competitions.get(competitionId);
    if (!competition) {
      return { success: false, message: "Competition not found" };
    }
    if (isCompetitionEnded(competition, this.now())) {
      return { success: false, message: "Competition has ended" };
    }
    if (competition.participants.includes(userId)) {
      return { success: false, message: "Already participating" };
    }
    competition.participants.push(userId);
    this.saveState();
    return { success: true, message: `Joined competition: ${competition.name}` };
  }

  finalizeCompetition(
    competitionId: string,
  ): Record<string, unknown> {
    const competition = this.competitions.get(competitionId);
    if (!competition) {
      return { success: false, error: "Competition not found" };
    }
    if (!isCompetitionEnded(competition, this.now())) {
      return { success: false, error: "Competition not yet ended" };
    }
    if (competition.winners.length > 0) {
      return { success: false, error: "Competition already finalized" };
    }

    const participants = competition.participants
      .map((userId) => ({
        userId,
        score: this.getMetricValue(userId, competition.metric),
      }))
      .sort((left, right) => right.score - left.score);

    const winners: Array<{ place: number; userId: string }> = [];
    if (participants[0]) {
      competition.winners.push(participants[0].userId);
      winners.push({ place: 1, userId: participants[0].userId });
    }
    if (participants[1]) {
      competition.winners.push(participants[1].userId);
      winners.push({ place: 2, userId: participants[1].userId });
    }
    if (participants[2]) {
      competition.winners.push(participants[2].userId);
      winners.push({ place: 3, userId: participants[2].userId });
    }

    if (this.brotherhood && winners[0]) {
      this.brotherhood.awardXp("feat", {
        baseAmount: competition.firstPlaceXp,
        reason: `Competition win: ${competition.name}`,
      });
      this.brotherhood.totalTp += competition.firstPlaceTp;
    }

    competition.isActive = false;
    this.saveState();
    return { success: true, winners };
  }

  getActiveCompetitions(): ComprehensiveCompetition[] {
    const now = this.now();
    return [...this.competitions.values()].filter(
      (competition) => competition.isActive && !isCompetitionEnded(competition, now),
    );
  }

  getCompetitionLeaderboard(
    competitionId: string,
    limit = 10,
  ): ComprehensiveLeaderboardEntry[] {
    const competition = this.competitions.get(competitionId);
    if (!competition) {
      return [];
    }
    const entries = competition.participants
      .map((userId) => ({
        userId,
        score: this.getMetricValue(userId, competition.metric),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((entry, index) => ({
        userId: entry.userId,
        userName: String(this.userStats[entry.userId]?.user_name ?? "Unknown"),
        rank: index + 1,
        score: entry.score,
        metric: competition.metric,
        change: 0,
        badgesCount: Number(this.userStats[entry.userId]?.badges ?? 0),
        rankTitle: String(this.userStats[entry.userId]?.rank_title ?? "INITIATE"),
        avatar: "👤",
      }));
    return entries;
  }

  getUserCompetitionStats(userId: string): Record<string, number> {
    let competitionsParticipated = 0;
    let competitionsWon = 0;
    let totalPrizeXp = 0;
    let totalPrizeTp = 0;

    for (const competition of this.competitions.values()) {
      if (!competition.participants.includes(userId)) {
        continue;
      }
      competitionsParticipated += 1;
      const winnerIndex = competition.winners.indexOf(userId);
      if (winnerIndex < 0) {
        continue;
      }
      competitionsWon += 1;
      if (winnerIndex === 0) {
        totalPrizeXp += competition.firstPlaceXp;
        totalPrizeTp += competition.firstPlaceTp;
      } else if (winnerIndex === 1) {
        totalPrizeXp += competition.secondPlaceXp;
        totalPrizeTp += competition.secondPlaceTp;
      } else if (winnerIndex === 2) {
        totalPrizeXp += competition.thirdPlaceXp;
        totalPrizeTp += competition.thirdPlaceTp;
      }
    }

    return {
      competitions_participated: competitionsParticipated,
      competitions_won: competitionsWon,
      win_rate:
        competitionsParticipated === 0
          ? 0
          : (competitionsWon / competitionsParticipated) * 100,
      total_prize_xp: totalPrizeXp,
      total_prize_tp: totalPrizeTp,
    };
  }

  private initializeLeaderboards(): void {
    for (const metric of Object.values(ComprehensiveLeaderboardMetric)) {
      this.leaderboards.set(`${ComprehensiveLeaderboardType.GLOBAL}_${metric}`, []);
      this.leaderboards.set(`${ComprehensiveLeaderboardType.WEEKLY}_${metric}`, []);
      this.leaderboards.set(`${ComprehensiveLeaderboardType.MONTHLY}_${metric}`, []);
    }
  }

  private rebuildLeaderboards(): void {
    for (const metric of Object.values(ComprehensiveLeaderboardMetric)) {
      const entries = Object.entries(this.userStats)
        .map(([userId, stats]) => ({
          userId,
          score: Number(stats[metric] ?? 0),
          userName: String(stats.user_name ?? "Unknown"),
          badgesCount: Number(stats.badges ?? 0),
          rankTitle: String(stats.rank_title ?? "INITIATE"),
        }))
        .sort((left, right) => right.score - left.score)
        .map(
          (entry, index): ComprehensiveLeaderboardEntry => ({
            userId: entry.userId,
            userName: entry.userName,
            rank: index + 1,
            score: entry.score,
            metric,
            change: 0,
            badgesCount: entry.badgesCount,
            rankTitle: entry.rankTitle,
            avatar: "👤",
          }),
        );

      this.leaderboards.set(
        `${ComprehensiveLeaderboardType.GLOBAL}_${metric}`,
        entries.slice(0, 100),
      );
    }
  }

  private getMetricValue(
    userId: string,
    metric: ComprehensiveLeaderboardMetric,
  ): number {
    return Number(this.userStats[userId]?.[metric] ?? 0);
  }

  private loadState(): void {
    if (!existsSync(this.stateFile)) {
      return;
    }
    try {
      const raw = readFileSync(this.stateFile, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.userStats === "object" && parsed.userStats !== null) {
        Object.assign(this.userStats, parsed.userStats);
      }
      if (Array.isArray(parsed.competitions)) {
        for (const competition of parsed.competitions) {
          if (typeof competition !== "object" || competition === null) {
            continue;
          }
          const record = competition as Record<string, unknown>;
          if (
            typeof record.id !== "string" ||
            typeof record.name !== "string" ||
            typeof record.metric !== "string"
          ) {
            continue;
          }
          const metric = Object.values(ComprehensiveLeaderboardMetric).includes(
            record.metric as ComprehensiveLeaderboardMetric,
          )
            ? (record.metric as ComprehensiveLeaderboardMetric)
            : ComprehensiveLeaderboardMetric.TOTAL_XP;

          this.competitions.set(record.id, {
            id: record.id,
            name: record.name,
            description: String(record.description ?? ""),
            metric,
            startTime: String(record.startTime ?? this.now().toISOString()),
            endTime: String(record.endTime ?? this.now().toISOString()),
            isActive: Boolean(record.isActive),
            minParticipants: Number(record.minParticipants ?? 10),
            firstPlaceXp: Number(record.firstPlaceXp ?? 1000),
            firstPlaceTp: Number(record.firstPlaceTp ?? 500),
            firstPlaceBadge:
              typeof record.firstPlaceBadge === "string"
                ? record.firstPlaceBadge
                : undefined,
            secondPlaceXp: Number(record.secondPlaceXp ?? 500),
            secondPlaceTp: Number(record.secondPlaceTp ?? 250),
            thirdPlaceXp: Number(record.thirdPlaceXp ?? 250),
            thirdPlaceTp: Number(record.thirdPlaceTp ?? 125),
            participationXp: Number(record.participationXp ?? 50),
            participationTp: Number(record.participationTp ?? 25),
            participants: Array.isArray(record.participants)
              ? record.participants.filter(
                  (participant): participant is string =>
                    typeof participant === "string",
                )
              : [],
            winners: Array.isArray(record.winners)
              ? record.winners.filter(
                  (winner): winner is string => typeof winner === "string",
                )
              : [],
          });
        }
      }
      this.rebuildLeaderboards();
    } catch {
      return;
    }
  }

  private saveState(): void {
    const payload = {
      userStats: this.userStats,
      competitions: [...this.competitions.values()],
    };
    writeFileSync(this.stateFile, JSON.stringify(payload, null, 2), "utf8");
  }
}
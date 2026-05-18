import type { IntegrationsManager } from './integrations-manager.js';

export type LeaderboardRecord = {
  userId: string;
  displayName: string;
  xp: number;
  rank: string;
  position: number;
  guild: string;
};

export class LeaderboardSystem {
  readonly entries = new Map<string, LeaderboardRecord>();
  lastSync?: string;

  constructor(private readonly integrations?: IntegrationsManager) {}

  updateEntry(
    userId: string,
    displayName: string,
    xp: number,
    rank: string,
    guild: string = 'CNWB',
  ): void {
    this.entries.set(userId, {
      userId,
      displayName,
      xp,
      rank,
      position: 0,
      guild,
    });
  }

  getLeaderboard(limit: number = 100, guild?: string): LeaderboardRecord[] {
    const entries = [...this.entries.values()].filter((entry) =>
      guild ? entry.guild === guild : true,
    );
    entries.sort((left, right) => right.xp - left.xp);
    const sliced = entries.slice(0, Math.max(0, limit));
    return sliced.map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
  }

  getUserRank(userId: string): number {
    const board = this.getLeaderboard(1000);
    for (const entry of board) {
      if (entry.userId === userId) {
        return entry.position;
      }
    }
    return -1;
  }

  async syncToSupabase(): Promise<boolean> {
    if (!this.integrations) {
      return false;
    }

    let success = true;
    for (const entry of this.entries.values()) {
      const result = await this.integrations.storeToSupabase('leaderboard', {
        user_id: entry.userId,
        display_name: entry.displayName,
        xp: entry.xp,
        rank: entry.rank,
        guild: entry.guild,
        updated_at: new Date().toISOString(),
      });
      if (!result) {
        success = false;
      }
    }
    if (success) {
      this.lastSync = new Date().toISOString();
    }
    return success;
  }
}
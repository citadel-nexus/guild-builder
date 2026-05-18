import { describe, expect, it } from 'vitest';

import { LeaderboardSystem } from '../../../src/agents/nexus-tamagotchi/leaderboard.js';

describe('LeaderboardSystem', () => {
  it('sorts leaderboard entries by xp descending', () => {
    const leaderboard = new LeaderboardSystem();
    leaderboard.updateEntry('u1', 'User 1', 100, 'INITIATE');
    leaderboard.updateEntry('u2', 'User 2', 250, 'APPRENTICE');

    const board = leaderboard.getLeaderboard();
    expect(board[0].userId).toBe('u2');
    expect(board[0].position).toBe(1);
    expect(leaderboard.getUserRank('u1')).toBe(2);
  });

  it('filters by guild when requested', () => {
    const leaderboard = new LeaderboardSystem();
    leaderboard.updateEntry('u1', 'User 1', 100, 'INITIATE', 'CNWB');
    leaderboard.updateEntry('u2', 'User 2', 300, 'EXPERT', 'ALPHA');

    const board = leaderboard.getLeaderboard(100, 'CNWB');
    expect(board.length).toBe(1);
    expect(board[0].guild).toBe('CNWB');
  });
});
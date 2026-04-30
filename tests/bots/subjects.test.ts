import { describe, expect, it } from 'vitest';

import {
  describeSubjects,
  loadSubjectConfig,
  parseActionFromSubject,
  parseBotIdFromSubject,
} from '../../src/bots/subjects.js';

describe('loadSubjectConfig', () => {
  it('uses the default guild prefix when env is empty', () => {
    const config = loadSubjectConfig({});
    expect(config.prefix).toBe('citadel.builder');
    expect(config.patterns).toEqual(['citadel.builder.bot.>']);
  });

  it('honors NATS_PREFIX', () => {
    const config = loadSubjectConfig({ NATS_PREFIX: 'citadel.tradebuilder' });
    expect(config.prefix).toBe('citadel.tradebuilder');
    expect(config.patterns).toEqual(['citadel.tradebuilder.bot.>']);
  });

  it('honors BOT_TRACKER_SUBJECTS as a comma list', () => {
    const config = loadSubjectConfig({
      NATS_PREFIX: 'citadel.builder',
      BOT_TRACKER_SUBJECTS: 'citadel.bits.>, citadel.builder.bot.>',
    });
    expect(config.patterns).toEqual(['citadel.bits.>', 'citadel.builder.bot.>']);
  });

  it('falls back to defaults when explicit list is empty', () => {
    const config = loadSubjectConfig({ BOT_TRACKER_SUBJECTS: ' , , ' });
    expect(config.patterns).toEqual(['citadel.builder.bot.>']);
  });
});

describe('parseBotIdFromSubject', () => {
  it('extracts the bot id from the canonical shape', () => {
    expect(
      parseBotIdFromSubject('citadel.builder.bot.bits-ai.dispatch_received', 'citadel.builder'),
    ).toBe('bits-ai');
  });

  it('returns null for non-bot subjects', () => {
    expect(parseBotIdFromSubject('citadel.builder.cml.task', 'citadel.builder')).toBeNull();
  });

  it('returns null when the subject is too short', () => {
    expect(parseBotIdFromSubject('citadel.builder.bot', 'citadel.builder')).toBeNull();
  });
});

describe('parseActionFromSubject', () => {
  it('returns the verb segment after the bot id', () => {
    expect(
      parseActionFromSubject('citadel.builder.bot.bits-ai.pr.opened', 'citadel.builder'),
    ).toBe('pr.opened');
  });

  it('returns null for non-bot subjects', () => {
    expect(parseActionFromSubject('citadel.builder.health', 'citadel.builder')).toBeNull();
  });
});

describe('describeSubjects', () => {
  it('joins multiple patterns with a comma', () => {
    expect(
      describeSubjects({
        prefix: 'citadel.builder',
        patterns: ['citadel.builder.bot.>', 'citadel.bits.>'],
      }),
    ).toBe('citadel.builder.bot.>, citadel.bits.>');
  });
});

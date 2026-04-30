import { describe, expect, it } from 'vitest';

import { BotRegistry } from '../../src/bots/registry.js';

describe('BotRegistry', () => {
  it('records an event and returns it', () => {
    const reg = new BotRegistry();
    const event = reg.record({
      bot_id: 'bits-ai',
      bot_name: 'Bits AI',
      bot_kind: 'agent',
      subject: 'citadel.builder.bot.bits-ai.dispatch_received',
      action: 'dispatch_received',
    });

    expect(event.bot_id).toBe('bits-ai');
    expect(event.bot_name).toBe('Bits AI');
    expect(event.bot_kind).toBe('agent');
    expect(event.status).toBe('active');
    expect(event.geo).toBeDefined();
  });

  it('snapshots include known bots and recent events', () => {
    const reg = new BotRegistry();
    reg.record({ bot_id: 'a', subject: 's', action: 'x' });
    reg.record({ bot_id: 'b', subject: 's', action: 'y' });
    reg.record({ bot_id: 'a', subject: 's', action: 'z' });

    const snap = reg.snapshot();
    expect(snap.bots).toHaveLength(2);
    expect(snap.recent_events).toHaveLength(3);
    const a = snap.bots.find((bot) => bot.id === 'a');
    expect(a?.event_count).toBe(2);
  });

  it('caps the recent-events ring buffer at maxRecentEvents', () => {
    const reg = new BotRegistry({ maxRecentEvents: 3 });
    for (let i = 0; i < 10; i += 1) {
      reg.record({ bot_id: 'a', subject: 's', action: `action-${i}` });
    }
    const snap = reg.snapshot();
    expect(snap.recent_events).toHaveLength(3);
    expect(snap.recent_events[0]?.action).toBe('action-7');
    expect(snap.recent_events[2]?.action).toBe('action-9');
  });

  it('marks bots offline once they cross the offline threshold', () => {
    const reg = new BotRegistry({ offlineThresholdMs: 1000 });
    reg.record({
      bot_id: 'stale',
      subject: 's',
      action: 'x',
      timestamp: new Date(Date.now() - 10_000).toISOString(),
    });
    const snap = reg.snapshot();
    const stale = snap.bots.find((bot) => bot.id === 'stale');
    expect(stale?.status).toBe('offline');
  });

  it('preserves explicit geo over deterministic fallback', () => {
    const reg = new BotRegistry();
    reg.record({
      bot_id: 'geo-bot',
      subject: 's',
      action: 'x',
      geo: { lat: 12.3, lon: 45.6 },
    });
    const snap = reg.snapshot();
    expect(snap.bots[0]?.geo).toEqual({ lat: 12.3, lon: 45.6 });
  });

  it('subscribers receive every recorded event', () => {
    const reg = new BotRegistry();
    const seen: string[] = [];
    const unsubscribe = reg.subscribe((event) => seen.push(event.action));
    reg.record({ bot_id: 'a', subject: 's', action: 'one' });
    reg.record({ bot_id: 'a', subject: 's', action: 'two' });
    unsubscribe();
    reg.record({ bot_id: 'a', subject: 's', action: 'three' });
    expect(seen).toEqual(['one', 'two']);
  });
});

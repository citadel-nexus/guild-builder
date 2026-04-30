import { describe, expect, it } from 'vitest';

import { parseBody } from '../../src/bots/listener.js';

describe('parseBody', () => {
  it('returns an empty object for empty payloads', () => {
    expect(parseBody('')).toEqual({});
    expect(parseBody('   ')).toEqual({});
  });

  it('treats a JSON string as the action verb', () => {
    expect(parseBody('"started"')).toEqual({ action: 'started' });
  });

  it('wraps non-JSON payloads as raw payload', () => {
    expect(parseBody('hello world')).toEqual({ payload: { raw: 'hello world' } });
  });

  it('parses the canonical object shape', () => {
    const parsed = parseBody(
      JSON.stringify({
        bot_id: 'bits-ai',
        bot_name: 'Bits AI',
        bot_kind: 'agent',
        action: 'dispatch_received',
        status: 'active',
        geo: { lat: 30.27, lon: -97.74 },
        payload: { dispatch_id: 'USO-001' },
      }),
    );
    expect(parsed).toEqual({
      bot_id: 'bits-ai',
      bot_name: 'Bits AI',
      bot_kind: 'agent',
      action: 'dispatch_received',
      status: 'active',
      geo: { lat: 30.27, lon: -97.74 },
      payload: { dispatch_id: 'USO-001' },
    });
  });

  it('drops invalid kinds and statuses', () => {
    const parsed = parseBody(
      JSON.stringify({
        bot_id: 'x',
        bot_kind: 'wizard',
        status: 'on-fire',
      }),
    );
    expect(parsed.bot_kind).toBeUndefined();
    expect(parsed.status).toBeUndefined();
  });

  it('rejects out-of-range geo', () => {
    expect(parseBody(JSON.stringify({ geo: { lat: 999, lon: 0 } })).geo).toBeUndefined();
    expect(parseBody(JSON.stringify({ geo: { lat: 0, lon: 999 } })).geo).toBeUndefined();
    expect(parseBody(JSON.stringify({ geo: 'somewhere' })).geo).toBeUndefined();
  });

  it('drops payload when not a plain object', () => {
    expect(parseBody(JSON.stringify({ payload: [1, 2] })).payload).toBeUndefined();
    expect(parseBody(JSON.stringify({ payload: 'x' })).payload).toBeUndefined();
  });
});

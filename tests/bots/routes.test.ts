import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BotRegistry } from '../../src/bots/registry.js';
import { tryHandleBotRoute } from '../../src/bots/routes.js';

const config = { prefix: 'citadel.builder', patterns: ['citadel.builder.bot.>'] };

const registry = new BotRegistry();
registry.record({
  bot_id: 'bits-ai',
  bot_name: 'Bits AI',
  bot_kind: 'agent',
  subject: 'citadel.builder.bot.bits-ai.dispatch_received',
  action: 'dispatch_received',
});

let baseUrl = '';
const server = createServer((req, res) => {
  if (
    tryHandleBotRoute(req, res, {
      registry,
      config,
    })
  ) {
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

describe('tryHandleBotRoute', () => {
  it('serves the dashboard html on GET /bots', async () => {
    const res = await fetch(`${baseUrl}/bots`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('Builder Guild · Bot Tracker');
    expect(body).toContain('/bots/stream');
  });

  it('returns the snapshot json on GET /bots/snapshot', async () => {
    const res = await fetch(`${baseUrl}/bots/snapshot`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    const parsed = (await res.json()) as {
      bots: Array<{ id: string }>;
      subjects: string;
    };
    expect(parsed.bots).toHaveLength(1);
    expect(parsed.bots[0]?.id).toBe('bits-ai');
    expect(parsed.subjects).toBe('citadel.builder.bot.>');
  });

  it('does not handle unrelated routes', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(404);
  });

  it('does not handle non-GET methods on bot routes', async () => {
    const res = await fetch(`${baseUrl}/bots/snapshot`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

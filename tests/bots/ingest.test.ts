import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BotRegistry } from '../../src/bots/registry.js';
import { tryHandleBotRoute } from '../../src/bots/routes.js';

const config = { prefix: 'citadel.builder', patterns: ['citadel.builder.bot.>'] };

function harness(ingestToken?: string): {
  registry: BotRegistry;
  url: () => string;
  setUrl: (u: string) => void;
} {
  const registry = new BotRegistry();
  let url = '';
  const server = createServer((req, res) => {
    if (
      tryHandleBotRoute(req, res, {
        registry,
        config,
        ingestToken,
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
          url = `http://127.0.0.1:${port}`;
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
  return { registry, url: () => url, setUrl: (u) => (url = u) };
}

describe('open ingest endpoints (no token)', () => {
  const env = harness();

  it('accepts a Wazuh alert and records the bot', async () => {
    const res = await fetch(`${env.url()}/bots/ingest/wazuh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rule: { id: '5710', level: 10, description: 'sshd: bad login' },
        agent: { name: 'vps-01', ip: '10.0.0.1' },
      }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { accepted: boolean; bot_id: string; source: string };
    expect(body.accepted).toBe(true);
    expect(body.bot_id).toBe('wazuh-vps-01');
    expect(body.source).toBe('wazuh');

    const snapshot = env.registry.snapshot();
    const recorded = snapshot.bots.find((b) => b.id === 'wazuh-vps-01');
    expect(recorded?.kind).toBe('sentinel');
    expect(recorded?.status).toBe('error');
  });

  it('accepts a Suricata alert', async () => {
    const res = await fetch(`${env.url()}/bots/ingest/suricata`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event_type: 'alert',
        src_ip: '203.0.113.5',
        alert: { signature: 'ET SCAN ssh brute', category: 'attempted-admin', severity: 1 },
      }),
    });
    expect(res.status).toBe(202);
  });

  it('accepts a Nemesis audit', async () => {
    const res = await fetch(`${env.url()}/bots/ingest/nemesis`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        audit_type: 'drift_check',
        severity: 'medium',
        affected_host: 'vps-01',
        rule_triggered: 'config_drift',
      }),
    });
    expect(res.status).toBe(202);
  });

  it('rejects payloads with invalid JSON', async () => {
    const res = await fetch(`${env.url()}/bots/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('rejects empty payloads', async () => {
    const res = await fetch(`${env.url()}/bots/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '',
    });
    expect(res.status).toBe(400);
  });

  it('returns 422 when the payload does not match the source', async () => {
    const res = await fetch(`${env.url()}/bots/ingest/wazuh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '"a string"',
    });
    expect(res.status).toBe(422);
  });

  it('does not handle POST on read endpoints', async () => {
    const res = await fetch(`${env.url()}/bots/snapshot`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

describe('protected ingest endpoints (token required)', () => {
  const env = harness('s3cret');

  it('rejects requests without an Authorization header', async () => {
    const res = await fetch(`${env.url()}/bots/ingest/nemesis`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audit_type: 'x', affected_host: 'h' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects wrong tokens', async () => {
    const res = await fetch(`${env.url()}/bots/ingest/nemesis`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer wrong',
      },
      body: JSON.stringify({ audit_type: 'x', affected_host: 'h' }),
    });
    expect(res.status).toBe(401);
  });

  it('accepts requests with the correct bearer token', async () => {
    const res = await fetch(`${env.url()}/bots/ingest/nemesis`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer s3cret',
      },
      body: JSON.stringify({ audit_type: 'drift', affected_host: 'h' }),
    });
    expect(res.status).toBe(202);
  });
});

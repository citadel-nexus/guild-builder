/**
 * HTTP route handlers for the bot tracker.
 *
 * Read routes:
 *   GET  /bots                  — html dashboard (vanilla canvas2d, no deps)
 *   GET  /bots/snapshot         — current registry state as JSON
 *   GET  /bots/stream           — SSE stream of bot events
 *
 * Sentinel ingestion routes (opt-in, see docs/bot-tracker.md):
 *   POST /bots/ingest           — generic BotEvent shape
 *   POST /bots/ingest/wazuh     — Wazuh alert JSON
 *   POST /bots/ingest/suricata  — Suricata EVE JSON line
 *   POST /bots/ingest/nemesis   — Nemesis audit summary
 *
 * Handlers are pure functions of (req, res, registry, config) so the
 * guild client can route to them without an extra framework. Ingest
 * routes optionally require a shared-secret bearer token via
 * BOT_TRACKER_INGEST_TOKEN — when unset the endpoints are open.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { BotRegistry } from './registry.js';
import { translate, type SentinelSource } from './sentinel.js';
import { attachSseClient } from './sse.js';
import { renderBotTrackerHtml } from './static.js';
import { describeSubjects, type SubjectConfig } from './subjects.js';

export type BotRouteContext = {
  registry: BotRegistry;
  config: SubjectConfig;
  /** Optional shared secret for the ingest routes. */
  ingestToken?: string;
};

const MAX_INGEST_BYTES = 256 * 1024; // 256 KiB — well above any realistic alert

export function tryHandleBotRoute(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: BotRouteContext,
): boolean {
  const url = req.url ?? '';

  if (req.method === 'GET') {
    if (url === '/bots' || url === '/bots/') {
      handleDashboard(res);
      return true;
    }
    if (url === '/bots/snapshot') {
      handleSnapshot(res, ctx);
      return true;
    }
    if (url === '/bots/stream') {
      attachSseClient(res, ctx.registry);
      return true;
    }
  }

  if (req.method === 'POST') {
    const source = ingestSourceForUrl(url);
    if (source) {
      void handleIngest(req, res, ctx, source);
      return true;
    }
  }

  return false;
}

function ingestSourceForUrl(url: string): SentinelSource | null {
  switch (url) {
    case '/bots/ingest':
      return 'generic';
    case '/bots/ingest/wazuh':
      return 'wazuh';
    case '/bots/ingest/suricata':
      return 'suricata';
    case '/bots/ingest/nemesis':
      return 'nemesis';
    default:
      return null;
  }
}

function handleDashboard(res: ServerResponse): void {
  const html = renderBotTrackerHtml();
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(html);
}

function handleSnapshot(res: ServerResponse, ctx: BotRouteContext): void {
  const snapshot = ctx.registry.snapshot();
  const body = JSON.stringify({
    ...snapshot,
    subjects: describeSubjects(ctx.config),
  });
  res.writeHead(200, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  res.end(body);
}

async function handleIngest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: BotRouteContext,
  source: SentinelSource,
): Promise<void> {
  if (!authorizeIngest(req, ctx)) {
    writeJson(res, 401, { error: 'unauthorized' });
    return;
  }

  let raw: string;
  try {
    raw = await readBody(req, MAX_INGEST_BYTES);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to read body';
    writeJson(res, 413, { error: message });
    return;
  }

  if (raw.trim() === '') {
    writeJson(res, 400, { error: 'empty body' });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    writeJson(res, 400, { error: 'invalid JSON' });
    return;
  }

  const parsed = translate(source, payload);
  if (!parsed) {
    writeJson(res, 422, { error: `payload not recognised as ${source}` });
    return;
  }

  const event = ctx.registry.record(parsed);
  writeJson(res, 202, {
    accepted: true,
    bot_id: event.bot_id,
    event_id: event.id,
    source,
  });
}

function authorizeIngest(req: IncomingMessage, ctx: BotRouteContext): boolean {
  const expected = ctx.ingestToken;
  if (!expected) return true; // open endpoint when token unset
  const header = req.headers.authorization;
  if (typeof header !== 'string') return false;
  const trimmed = header.trim();
  const prefix = 'bearer ';
  if (!trimmed.toLowerCase().startsWith(prefix)) return false;
  return trimmed.slice(prefix.length).trim() === expected;
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error(`payload exceeds ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

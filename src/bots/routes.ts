/**
 * HTTP route handlers for the bot tracker.
 *
 * Three routes:
 *   GET /bots          — html dashboard (vanilla canvas2d, no deps)
 *   GET /bots/snapshot — current registry state as JSON
 *   GET /bots/stream   — SSE stream of bot events
 *
 * Handlers are pure functions of (req, res, registry, config) so the
 * guild client can route to them without an extra framework.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { BotRegistry } from './registry.js';
import { attachSseClient } from './sse.js';
import { renderBotTrackerHtml } from './static.js';
import { describeSubjects, type SubjectConfig } from './subjects.js';

export type BotRouteContext = {
  registry: BotRegistry;
  config: SubjectConfig;
};

export function tryHandleBotRoute(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: BotRouteContext,
): boolean {
  const url = req.url ?? '';
  if (req.method !== 'GET') {
    return false;
  }
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
  return false;
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

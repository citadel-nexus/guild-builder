/**
 * SSE broadcaster for bot events.
 *
 * Each connected client gets every event the registry emits after the
 * subscription was opened. New clients also receive a `snapshot` frame
 * up front so the UI can render an immediate state.
 */

import type { ServerResponse } from 'node:http';

import type { BotRegistry } from './registry.js';

export type SseHandle = {
  close: () => void;
};

const HEARTBEAT_MS = 15_000;

export function attachSseClient(res: ServerResponse, registry: BotRegistry): SseHandle {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });

  // Initial snapshot frame so the UI can hydrate before the next event.
  writeFrame(res, 'snapshot', registry.snapshot());

  const unsubscribe = registry.subscribe((event) => {
    writeFrame(res, 'event', event);
  });

  const heartbeat = setInterval(() => {
    if (res.writableEnded) return;
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, HEARTBEAT_MS);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    if (!res.writableEnded) {
      res.end();
    }
  };

  res.on('close', close);
  res.on('error', close);

  return { close };
}

function writeFrame(res: ServerResponse, event: string, data: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ShortTermMemoryBuffer } from '../../../src/agents/nexus-tamagotchi/short-term-memory.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeBuffer(): ShortTermMemoryBuffer {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-stm-'));
  tempDirs.push(dir);
  return new ShortTermMemoryBuffer({
    storagePath: join(dir, 'stm.jsonl'),
    maxEntries: 50,
    pruneToSize: 25,
  });
}

describe('ShortTermMemoryBuffer', () => {
  it('injects entries and supports semantic search', async () => {
    const buffer = makeBuffer();
    await buffer.inject('Discuss mission planning and governance strategy', {
      tags: ['planning', 'governance'],
      emotion: 'curious',
      importance: 0.8,
    });
    await buffer.inject('Weekly report covers xp growth and rank progression', {
      tags: ['reporting'],
      emotion: 'happy',
      importance: 0.7,
    });

    const results = await buffer.search('rank progression report', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.content.length).toBeGreaterThan(0);
  });

  it('filters by tags/emotion and computes consolidation candidates', async () => {
    const buffer = makeBuffer();
    await buffer.inject('Memory sync completed successfully', {
      tags: ['sync'],
      emotion: 'content',
      importance: 0.9,
    });
    await buffer.inject('Auth cache entry expired and refreshed', {
      tags: ['auth', 'sync'],
      emotion: 'curious',
      importance: 0.85,
    });

    const byTag = buffer.getByTag('sync');
    expect(byTag.length).toBe(2);
    const byEmotion = buffer.getByEmotion('content');
    expect(byEmotion.length).toBe(1);

    const consolidation = buffer.getCandidatesForConsolidation(0.2, 48);
    expect(consolidation.length).toBeGreaterThan(0);
  });
});
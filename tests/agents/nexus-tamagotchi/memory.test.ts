import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
  SimpleCognitiveDomain,
  SimpleEmbeddingService,
  SimpleVectorStorage,
} from '../../../src/agents/nexus-tamagotchi/memory.js';
import { MemoryObject, MemoryType } from '../../../src/agents/nexus-tamagotchi/models.js';

describe('memory and vector storage', () => {
  it('generates deterministic synthetic embeddings', async () => {
    const service = new SimpleEmbeddingService({ dimension: 16 });
    const a = await service.embedText('same');
    const b = await service.embedText('same');
    expect(a).toEqual(b);
    expect(a.length).toBe(16);
  });

  it('returns nearest vectors by cosine similarity', () => {
    const storage = new SimpleVectorStorage(3);
    storage.addVector('f1', [1, 0, 0]);
    storage.addVector('f2', [0, 1, 0]);
    const results = storage.search([1, 0, 0], 1);
    expect(results.length).toBe(1);
    expect(results[0].fingerprint).toBe('f1');
  });

  it('ingests and recalls memory objects through the domain store', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'nexus-memory-'));
    const domain = new SimpleCognitiveDomain('agent-a', {
      cacheDir: tempRoot,
      dimension: 3,
    });
    const memory = new MemoryObject({
      inputText: 'query alpha',
      outputText: 'response alpha',
      memoryType: MemoryType.KNOWLEDGE,
      embedding: [1, 0, 0],
    });

    expect(domain.ingestMemory(memory)).toBe(true);
    const recalled = domain.recall([1, 0, 0], 1);
    expect(recalled.length).toBe(1);
    expect(recalled[0].id).toBe(memory.id);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
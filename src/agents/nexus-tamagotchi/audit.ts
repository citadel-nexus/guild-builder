// ─── CGRF Header ───────────────────────────────────────────────
// File:        src/agents/nexus-tamagotchi/audit.ts
// Stage:       11_COMMIT
// SRS:         SRS-CN-BUILDER-INTEGRATION-001
// CAPS:        pending
// CK:          pending
// Dispatch:    DISP-BUILDER-INTEGRATION-001
// Seat:        BITS-CODEGEN
// Owner:       Citadel Nexus Inc.
// Created:     2026-10-20
// Depends:     .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md
// EnumType:    Scaffold
// EnumEdges:   DEPENDS_ON .bits/srs/SRS-CN-BUILDER-INTEGRATION-001.md
// DAG Node:    none
// Intent:      Protect local audit evidence from caller mutation and detect edits or trusted-head truncation using unambiguous hash inputs.
// ───────────────────────────────────────────────────────────────

import { createHash, randomUUID } from 'node:crypto';

import type { AuditEntry } from './types.js';

function computeEntryHash(
  id: string,
  event: string,
  actor: string,
  detail: string,
  timestamp: string,
  prevHash: string,
): string {
  const payload = JSON.stringify([id, event, actor, detail, timestamp, prevHash]);
  return createHash('sha256').update(payload).digest('hex');
}

export function createAuditEntry(
  event: string,
  actor: string,
  detail: string,
  prevHash: string,
  timestamp: string = new Date().toISOString(),
): AuditEntry {
  const id = randomUUID();
  const hash = computeEntryHash(id, event, actor, detail, timestamp, prevHash);
  return {
    id,
    event,
    actor,
    detail,
    timestamp,
    hash,
    prevHash,
  };
}

export function verifyChain(
  entries: readonly AuditEntry[],
  expectedHead?: string,
): boolean {
  if (expectedHead !== undefined && getChainHead(entries) !== expectedHead) {
    return false;
  }
  if (entries.length === 0) {
    return true;
  }

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const expectedPrevHash = index === 0 ? '' : entries[index - 1].hash;
    if (entry.prevHash !== expectedPrevHash) {
      return false;
    }

    const expectedHash = computeEntryHash(
      entry.id,
      entry.event,
      entry.actor,
      entry.detail,
      entry.timestamp,
      entry.prevHash,
    );
    if (entry.hash !== expectedHash) {
      return false;
    }
  }

  return true;
}

export function getChainHead(entries: readonly AuditEntry[]): string {
  if (entries.length === 0) {
    return '';
  }
  return entries[entries.length - 1].hash;
}

export class GuardianAuditTrail {
  private readonly entries: AuditEntry[] = [];

  append(
    event: string,
    actor: string,
    detail: string,
    timestamp: string = new Date().toISOString(),
  ): AuditEntry {
    const prevHash = getChainHead(this.entries);
    const entry = createAuditEntry(event, actor, detail, prevHash, timestamp);
    this.entries.push(entry);
    return { ...entry };
  }

  verifyChain(): boolean {
    return verifyChain(this.entries);
  }

  getChainHead(): string {
    return getChainHead(this.entries);
  }

  getEntries(): readonly AuditEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  recordEvent(eventType: string, data: Record<string, unknown>): string {
    const detail = JSON.stringify(data);
    const entry = this.append(eventType, 'system', detail);
    return entry.hash;
  }
}
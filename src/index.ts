// ─── CGRF Header ───────────────────────────────────────────────
// File:        src/index.ts
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
// Intent:      Start the integrated opt-in services while preserving Datadog, provisioning and Tamagotchi startup.
// ───────────────────────────────────────────────────────────────

import { startBotListener } from './bots/index.js';
import { maybeStartResearchSignalPipe } from './automation/auto-start.js';
import GuildClient from './guild-client.js';
import { maybeStartDatadogBridge } from './agents/datadog-bridge/auto-start.js';
import { maybeStartNexusTamagotchi } from './agents/nexus-tamagotchi/index.js';
import { maybeStartProvisionBridge } from './provision/auto-start.js';

const guild = new GuildClient({
  name: process.env.GUILD_NAME || 'builder',
  natsPrefix: process.env.NATS_PREFIX || 'citadel.builder',
  port: Number(process.env.GUILD_PORT || 8443),
});

guild.start();

void maybeStartProvisionBridge()
  .then((result) => {
    if (result.started) {
      console.log('[builder] provision orchestrator bridge started');
    } else if (
      result.reason &&
      result.reason !== 'PROVISION_ORCHESTRATOR != on'
    ) {
      console.warn(
        `[builder] provision orchestrator skipped: ${result.reason}`,
      );
    }
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[builder] provision orchestrator failed to start: ${message}`);
  });

void maybeStartDatadogBridge()
  .then((result) => {
    if (result.started) {
      console.log('[builder] datadog bridge started');
    } else if (result.reason && result.reason !== 'DATADOG_BRIDGE != on') {
      console.warn(`[builder] datadog bridge skipped: ${result.reason}`);
    }
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[builder] datadog bridge failed to start: ${message}`);
  });


void maybeStartNexusTamagotchi()
  .then((result) => {
    if (result.started) {
      console.log('[builder] nexus tamagotchi started');
    } else if (
      result.reason &&
      result.reason !== 'NEXUS_TAMAGOTCHI != on'
    ) {
      console.warn(`[builder] nexus tamagotchi skipped: ${result.reason}`);
    }
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[builder] nexus tamagotchi failed to start: ${message}`);
  });

if (process.env.BOT_TRACKER_DISABLED !== '1' && process.env.NATS_URL) {
  startBotListener({
    registry: guild.registry,
    config: guild.subjectConfig,
  }).catch((err) => {
    console.error('[bots] listener failed to start', err);
  });
} else if (!process.env.NATS_URL) {
  console.log('[bots] NATS_URL unset — tracker UI runs but receives no events');
}

void maybeStartResearchSignalPipe()
  .then((result) => {
    if (result.started) {
      console.log('[builder] research signal pipe started');
    } else if (
      result.reason &&
      result.reason !== 'RESEARCH_SIGNAL_PIPE != on'
    ) {
      console.warn(`[builder] research signal pipe skipped: ${result.reason}`);
    }
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[builder] research signal pipe failed to start: ${message}`);
  });

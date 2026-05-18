/**
 * Optional auto-start of the tenant provisioning bridge.
 *
 * Activated when PROVISION_ORCHESTRATOR=on. Reads NATS connection info
 * and subjects from the environment — never hardcodes them — so the
 * subject canon stays operator-controlled.
 *
 * Required env when activated:
 *   NATS_URL                     — NATS server URL
 *   PROVISION_INBOUND_SUBJECT    — subject the walk-in pipeline emits on
 *   PROVISION_OUTBOUND_PREFIX    — prefix for provision.* events
 *
 * Optional:
 *   NATS_TOKEN                   — auth token, if your NATS requires it
 */
import { connect } from 'nats';

import {
  ProvisionNatsBridge,
  ProvisionOrchestrator,
  type NatsLikeClient,
} from './index.js';

export type ProvisionAutoStartResult = {
  started: boolean;
  reason?: string;
  stop?: () => Promise<void>;
};

export async function maybeStartProvisionBridge(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProvisionAutoStartResult> {
  if ((env.PROVISION_ORCHESTRATOR ?? '').toLowerCase() !== 'on') {
    return { started: false, reason: 'PROVISION_ORCHESTRATOR != on' };
  }

  const natsUrl = env.NATS_URL;
  const inboundSubject = env.PROVISION_INBOUND_SUBJECT;
  const outboundSubjectPrefix = env.PROVISION_OUTBOUND_PREFIX;

  if (!natsUrl) {
    return { started: false, reason: 'NATS_URL is required' };
  }
  if (!inboundSubject) {
    return { started: false, reason: 'PROVISION_INBOUND_SUBJECT is required' };
  }
  if (!outboundSubjectPrefix) {
    return { started: false, reason: 'PROVISION_OUTBOUND_PREFIX is required' };
  }

  const nc = await connect({
    servers: natsUrl,
    token: env.NATS_TOKEN,
  });

  const client = nc as unknown as NatsLikeClient;
  const orchestrator = new ProvisionOrchestrator();
  const bridge = new ProvisionNatsBridge({
    client,
    orchestrator,
    inboundSubject,
    outboundSubjectPrefix,
  });

  await bridge.start();

  return {
    started: true,
    stop: async () => {
      await bridge.stop();
      await nc.drain();
    },
  };
}

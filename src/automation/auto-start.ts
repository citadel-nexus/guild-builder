import { connect } from 'nats';

import {
  ResearchSignalPipe,
  type ResearchPipeNatsClient,
} from './research-pipe.js';

export type ResearchPipeAutoStartResult = {
  started: boolean;
  reason?: string;
  stop?: () => Promise<void>;
};

export async function maybeStartResearchSignalPipe(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResearchPipeAutoStartResult> {
  if ((env.RESEARCH_SIGNAL_PIPE ?? '').toLowerCase() !== 'on') {
    return { started: false, reason: 'RESEARCH_SIGNAL_PIPE != on' };
  }

  const natsUrl = env.NATS_URL;
  const inboundSubject = env.RESEARCH_PIPE_INBOUND_SUBJECT;
  const outboundSubjectPrefix = env.RESEARCH_PIPE_OUTBOUND_PREFIX;

  if (!natsUrl) {
    return { started: false, reason: 'NATS_URL is required' };
  }
  if (!inboundSubject) {
    return {
      started: false,
      reason: 'RESEARCH_PIPE_INBOUND_SUBJECT is required',
    };
  }
  if (!outboundSubjectPrefix) {
    return {
      started: false,
      reason: 'RESEARCH_PIPE_OUTBOUND_PREFIX is required',
    };
  }

  const sourceGuild = env.RESEARCH_PIPE_SOURCE_GUILD ?? 'builder';
  const targetGuild = env.RESEARCH_PIPE_TARGET_GUILD ?? 'research';
  const namespace = env.RESEARCH_PIPE_NAMESPACE ?? 'thesis';

  const nc = await connect({
    servers: natsUrl,
    token: env.NATS_TOKEN,
  });

  const client: ResearchPipeNatsClient = nc;
  const pipe = new ResearchSignalPipe({
    client,
    inboundSubject,
    outboundSubjectPrefix,
    sourceGuild,
    targetGuild,
    namespace,
  });
  await pipe.start();

  return {
    started: true,
    stop: async () => {
      await pipe.stop();
      await nc.drain();
    },
  };
}
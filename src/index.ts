import GuildClient from './guild-client.js';
import { maybeStartResearchSignalPipe } from './automation/auto-start.js';
import { maybeStartProvisionBridge } from './provision/auto-start.js';

const guild = new GuildClient({
  name: 'builder',
  natsPrefix: 'citadel.builder',
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

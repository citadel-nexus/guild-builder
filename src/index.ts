import { startBotListener } from './bots/index.js';
import GuildClient from './guild-client.js';
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
dd/feat/SRS-BOT-TRACKER-001/bot-tracker

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
=======
 main

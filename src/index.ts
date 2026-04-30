import { startBotListener } from './bots/index.js';
import GuildClient from './guild-client.js';

const guild = new GuildClient({
  name: process.env.GUILD_NAME || 'builder',
  natsPrefix: process.env.NATS_PREFIX || 'citadel.builder',
  port: Number(process.env.GUILD_PORT || 8443),
});

guild.start();

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

import GuildClient from './guild-client.js';

const guild = new GuildClient({
  name: 'builder',
  natsPrefix: 'citadel.builder',
  port: Number(process.env.GUILD_PORT || 8443),
});

guild.start();

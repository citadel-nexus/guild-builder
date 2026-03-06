import  GuildClient  from '@citadel-guilds/sdk';

const guild = new GuildClient({
  name: 'builder',
  natsPrefix: 'citadel.builder',
  port: 8443,
});

guild.start();

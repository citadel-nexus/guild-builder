import  connect, StringCodec  from 'nats';

const sc = StringCodec();

export async function startListener() {
  const nc = await connect( servers: process.env.NATS_URL );
  const sub = nc.subscribe('citadel.builder.>');
  console.log(`[builder] Listening on citadel.builder.*`);
  for await (const msg of sub) {
    const data = sc.decode(msg.data);
    console.log(`[builder] $msg.subject: $data`);
    // Route to handlers based on msg.subject
  }
}

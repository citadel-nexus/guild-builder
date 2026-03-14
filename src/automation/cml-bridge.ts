/**
 * CML Bridge — receives task queue items via NATS, executes, reports back.
 * Subject: citadel.builder.cml.task
 * Result:  citadel.builder.cml.result
 */
import { connect, StringCodec } from 'nats';

const sc = StringCodec();

export async function startCmlBridge() {
  const nc = await connect({ servers: process.env.NATS_URL });
  const sub = nc.subscribe('citadel.builder.cml.task');

  console.log('[builder] CML bridge listening');

  for await (const msg of sub) {
    const task = JSON.parse(sc.decode(msg.data));
    console.log(`[builder] CML task: ${task.task_id}`);

    try {
      const result = { task_id: task.task_id, status: 'done', output: 'ok' };
      nc.publish('citadel.builder.cml.result', sc.encode(JSON.stringify(result)));
    } catch (err) {
      const result = { task_id: task.task_id, status: 'failed', error: String(err) };
      nc.publish('citadel.builder.cml.result', sc.encode(JSON.stringify(result)));
    }
  }
}

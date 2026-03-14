import { createServer, type Server } from 'node:http';

import { healthCheck } from './routes/health.js';

type GuildClientOptions = {
  name: string;
  natsPrefix: string;
  port: number;
};

export default class GuildClient {
  private readonly name: string;
  private readonly natsPrefix: string;
  private readonly port: number;
  private server: Server | null = null;

  constructor(options: GuildClientOptions) {
    this.name = options.name;
    this.natsPrefix = options.natsPrefix;
    this.port = options.port;
  }

  start() {
    if (this.server) {
      return;
    }

    this.server = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify(
            healthCheck({
              guild: this.name,
              natsPrefix: `${this.natsPrefix}.*`,
            }),
          ),
        );
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          guild: this.name,
          status: 'online',
          nats_prefix: `${this.natsPrefix}.*`,
        }),
      );
    });

    this.server.listen(this.port, () => {
      console.log(`[builder] listening on :${this.port}`);
    });
  }
}

import { createServer, type Server } from 'node:http';

import { BotRegistry, loadSubjectConfig, tryHandleBotRoute, type SubjectConfig } from './bots/index.js';
import { healthCheck } from './routes/health.js';

type GuildClientOptions = {
  name: string;
  natsPrefix: string;
  port: number;
  botRegistry?: BotRegistry;
  botSubjects?: SubjectConfig;
};

export default class GuildClient {
  private readonly name: string;
  private readonly natsPrefix: string;
  private readonly port: number;
  private readonly botRegistry: BotRegistry;
  private readonly botSubjects: SubjectConfig;
  private server: Server | null = null;

  constructor(options: GuildClientOptions) {
    this.name = options.name;
    this.natsPrefix = options.natsPrefix;
    this.port = options.port;
    this.botRegistry = options.botRegistry ?? new BotRegistry();
    this.botSubjects = options.botSubjects ?? loadSubjectConfig();
  }

  /** Exposed so the entry point (or tests) can wire a NATS listener to it. */
  get registry(): BotRegistry {
    return this.botRegistry;
  }

  /** Exposed so the entry point can use the same env-resolved patterns. */
  get subjectConfig(): SubjectConfig {
    return this.botSubjects;
  }

  start() {
    if (this.server) {
      return;
    }

    this.server = createServer((req, res) => {
      if (
        tryHandleBotRoute(req, res, {
          registry: this.botRegistry,
          config: this.botSubjects,
        })
      ) {
        return;
      }

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
          bot_tracker: {
            subjects: this.botSubjects.patterns,
            dashboard: '/bots',
          },
        }),
      );
    });

    this.server.listen(this.port, () => {
      console.log(`[builder] listening on :${this.port}`);
    });
  }
}

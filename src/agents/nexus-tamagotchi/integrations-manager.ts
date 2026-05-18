import {
  CitadelIntegrationRouter,
  type IntegrationEndpoint,
} from './integration-router.js';

export class IntegrationsManager {
  private readonly router: CitadelIntegrationRouter;
  private readonly activeIntegrations: Record<string, boolean> = {};

  constructor(
    env: NodeJS.ProcessEnv = process.env,
    router?: CitadelIntegrationRouter,
  ) {
    this.router = router ?? new CitadelIntegrationRouter(env);
    this.refreshStatus();
  }

  async trackEvent(
    eventName: string,
    properties: Record<string, unknown> = {},
    userId: string = 'agent',
  ): Promise<void> {
    await this.router.route('posthog', 'capture', {
      event_name: eventName,
      properties,
      user_id: userId,
    });
    await this.router.route('datadog', 'increment_metric', {
      metric: `nexus.${eventName}`,
      properties,
      user_id: userId,
    });
  }

  async storeToSupabase(
    table: string,
    data: Record<string, unknown>,
  ): Promise<boolean> {
    const result = await this.router.route('supabase', 'insert', {
      table,
      data,
    });
    return result.success;
  }

  async sendSlackMessage(channel: string, message: string): Promise<boolean> {
    const result = await this.router.route('slack', 'post_message', {
      channel,
      message,
    });
    return result.success;
  }

  getStatus(): Record<string, boolean> {
    return { ...this.activeIntegrations };
  }

  getActiveCount(): number {
    return Object.values(this.activeIntegrations).filter(Boolean).length;
  }

  private refreshStatus(): void {
    const available = this.router.getAvailableServices();
    const availableSet = new Set<IntegrationEndpoint>(available);

    const allServices: IntegrationEndpoint[] = [
      'discord',
      'slack',
      'notion',
      'linear',
      'github',
      'gitlab',
      'supabase',
      'posthog',
      'datadog',
      'stripe',
      'intercom',
      'openai',
      'anthropic',
    ];

    for (const service of allServices) {
      this.activeIntegrations[service] = availableSet.has(service);
    }
  }
}

let integrationsInstance: IntegrationsManager | undefined;

export function getIntegrations(
  env: NodeJS.ProcessEnv = process.env,
): IntegrationsManager {
  if (!integrationsInstance) {
    integrationsInstance = new IntegrationsManager(env);
  }
  return integrationsInstance;
}
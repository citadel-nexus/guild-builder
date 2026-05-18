type IntegrationTransport = 'webhook' | 'api' | 'graphql' | 'rest' | 'agent';
type IntegrationPriority = 'low' | 'normal' | 'high' | 'critical';

type IntegrationEndpointConfig = {
  type: IntegrationTransport;
  rateLimit: number;
  retryCount: number;
};

export const INTEGRATION_ENDPOINTS = {
  discord: { type: 'webhook', rateLimit: 30, retryCount: 3 },
  slack: { type: 'api', rateLimit: 50, retryCount: 3 },
  notion: { type: 'api', rateLimit: 30, retryCount: 2 },
  linear: { type: 'graphql', rateLimit: 60, retryCount: 2 },
  github: { type: 'api', rateLimit: 100, retryCount: 2 },
  gitlab: { type: 'api', rateLimit: 60, retryCount: 2 },
  supabase: { type: 'rest', rateLimit: 100, retryCount: 3 },
  posthog: { type: 'api', rateLimit: 100, retryCount: 1 },
  datadog: { type: 'agent', rateLimit: 200, retryCount: 1 },
  stripe: { type: 'api', rateLimit: 50, retryCount: 2 },
  intercom: { type: 'api', rateLimit: 30, retryCount: 2 },
  openai: { type: 'api', rateLimit: 60, retryCount: 3 },
  anthropic: { type: 'api', rateLimit: 30, retryCount: 3 },
};

export type IntegrationEndpoint = keyof typeof INTEGRATION_ENDPOINTS;

const INTEGRATION_ENDPOINT_LIST: IntegrationEndpoint[] = [
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

const OAD_TOKEN_KEYS: Record<IntegrationEndpoint, string[]> = {
  discord: ['DISCORD_BOT_TOKEN', 'DISCORD_TOKEN'],
  slack: ['SLACK_BOT_TOKEN', 'OAD_SLACK_TOKEN'],
  notion: ['NOTION_TOKEN', 'OAD_NOTION_KEY'],
  linear: ['LINEAR_API_KEY', 'LINEAR_API_TOKEN'],
  github: ['GITHUB_TOKEN', 'GH_TOKEN'],
  gitlab: ['GITLAB_TOKEN', 'OAD_PAT', 'CITADEL_HELPER_PAT'],
  supabase: ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY'],
  posthog: ['POSTHOG_API_KEY'],
  datadog: ['DD_API_KEY'],
  stripe: ['STRIPE_SECRET_KEY'],
  intercom: ['INTERCOM_ACCESS_TOKEN'],
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
};

function getOadToken(env: NodeJS.ProcessEnv, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function isIntegrationEndpoint(value: string): value is IntegrationEndpoint {
  for (const endpoint of INTEGRATION_ENDPOINT_LIST) {
    if (endpoint === value) {
      return true;
    }
  }
  return false;
}

type PolicyDecision = 'allow' | 'deny' | 'review';

export type IntegrationPolicyRequest = {
  actionType: string;
  userId: string;
  context: Record<string, unknown>;
  autonomyBudget?: unknown;
};

export type IntegrationPolicyResult = {
  decision: PolicyDecision;
  reason: string;
  risk?: number;
  reviewRoute?: string;
};

export type IntegrationPolicyMatrix = {
  authorize: (request: IntegrationPolicyRequest) => IntegrationPolicyResult;
};

export type IntegrationLedgerEvent = {
  eventType: string;
  component: string;
  message: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  details: Record<string, unknown>;
};

export type IntegrationLedger = {
  logEvent: (event: IntegrationLedgerEvent) => void;
};

export type IntegrationAgentContext = {
  policyMatrix?: IntegrationPolicyMatrix;
  ledger?: IntegrationLedger;
};

export type IntegrationRouteResult = {
  success: boolean;
  service: string;
  action: string;
  timestamp?: string;
  payloadKeys?: string[];
  error?: string;
  policyDecision?: PolicyDecision;
  reviewRoute?: string;
};

export type RouterStats = {
  availableServices: IntegrationEndpoint[];
  requestCounts: Record<IntegrationEndpoint, number>;
  errorCounts: Record<IntegrationEndpoint, number>;
  totalRequests: number;
  totalErrors: number;
};

export class CitadelIntegrationRouter {
  readonly tokens: Record<IntegrationEndpoint, string | undefined>;
  readonly rateLimitBuckets: Record<IntegrationEndpoint, number>;
  readonly lastRequestTimes: Record<IntegrationEndpoint, number | undefined>;
  readonly requestCounts: Record<IntegrationEndpoint, number>;
  readonly errorCounts: Record<IntegrationEndpoint, number>;

  private policyMatrix?: IntegrationPolicyMatrix;
  private ledger?: IntegrationLedger;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    this.tokens = this.loadTokens();
    this.rateLimitBuckets = this.initializeCounterRecord(0);
    this.lastRequestTimes = this.initializeTimestampRecord();
    this.requestCounts = this.initializeCounterRecord(0);
    this.errorCounts = this.initializeCounterRecord(0);
  }

  setPolicyContext(context: {
    agent?: IntegrationAgentContext;
    policyMatrix?: IntegrationPolicyMatrix;
    ledger?: IntegrationLedger;
  }): void {
    const fromAgentPolicy = context.agent?.policyMatrix;
    const fromAgentLedger = context.agent?.ledger;
    this.policyMatrix = context.policyMatrix ?? fromAgentPolicy;
    this.ledger = context.ledger ?? fromAgentLedger;
  }

  isAvailable(service: string): boolean {
    if (!isIntegrationEndpoint(service)) {
      return false;
    }
    return this.tokens[service] !== undefined;
  }

  getAvailableServices(): IntegrationEndpoint[] {
    return INTEGRATION_ENDPOINT_LIST.filter((service) => this.isAvailable(service));
  }

  async route(
    service: string,
    action: string,
    payload: Record<string, unknown>,
    priority: IntegrationPriority = 'normal',
  ): Promise<IntegrationRouteResult> {
    if (!isIntegrationEndpoint(service)) {
      return {
        success: false,
        error: `Service ${service} is not supported`,
        service,
        action,
      };
    }

    if (!this.isAvailable(service)) {
      return {
        success: false,
        error: `Service ${service} not configured (missing token)`,
        service,
        action,
      };
    }

    if (!this.checkRateLimit(service)) {
      return {
        success: false,
        error: `Rate limit exceeded for ${service}`,
        service,
        action,
      };
    }

    const policyResult = this.evaluatePolicy(service, action, payload, priority);
    if (policyResult) {
      return policyResult;
    }

    this.requestCounts[service] += 1;
    this.lastRequestTimes[service] = Date.now();
    this.rateLimitBuckets[service] += 1;

    const result = await this.dispatch(service, action, payload);
    if (!result.success) {
      this.errorCounts[service] += 1;
    }
    return result;
  }

  getStats(): RouterStats {
    const totalRequests = Object.values(this.requestCounts).reduce(
      (total, value) => total + value,
      0,
    );
    const totalErrors = Object.values(this.errorCounts).reduce(
      (total, value) => total + value,
      0,
    );

    return {
      availableServices: this.getAvailableServices(),
      requestCounts: { ...this.requestCounts },
      errorCounts: { ...this.errorCounts },
      totalRequests,
      totalErrors,
    };
  }

  private initializeCounterRecord(initialValue: number): Record<IntegrationEndpoint, number> {
    const output: Record<IntegrationEndpoint, number> = {
      discord: initialValue,
      slack: initialValue,
      notion: initialValue,
      linear: initialValue,
      github: initialValue,
      gitlab: initialValue,
      supabase: initialValue,
      posthog: initialValue,
      datadog: initialValue,
      stripe: initialValue,
      intercom: initialValue,
      openai: initialValue,
      anthropic: initialValue,
    };
    return output;
  }

  private initializeTimestampRecord(): Record<IntegrationEndpoint, number | undefined> {
    return {
      discord: undefined,
      slack: undefined,
      notion: undefined,
      linear: undefined,
      github: undefined,
      gitlab: undefined,
      supabase: undefined,
      posthog: undefined,
      datadog: undefined,
      stripe: undefined,
      intercom: undefined,
      openai: undefined,
      anthropic: undefined,
    };
  }

  private loadTokens(): Record<IntegrationEndpoint, string | undefined> {
    return {
      discord: getOadToken(this.env, OAD_TOKEN_KEYS.discord),
      slack: getOadToken(this.env, OAD_TOKEN_KEYS.slack),
      notion: getOadToken(this.env, OAD_TOKEN_KEYS.notion),
      linear: getOadToken(this.env, OAD_TOKEN_KEYS.linear),
      github: getOadToken(this.env, OAD_TOKEN_KEYS.github),
      gitlab: getOadToken(this.env, OAD_TOKEN_KEYS.gitlab),
      supabase: getOadToken(this.env, OAD_TOKEN_KEYS.supabase),
      posthog: getOadToken(this.env, OAD_TOKEN_KEYS.posthog),
      datadog: getOadToken(this.env, OAD_TOKEN_KEYS.datadog),
      stripe: getOadToken(this.env, OAD_TOKEN_KEYS.stripe),
      intercom: getOadToken(this.env, OAD_TOKEN_KEYS.intercom),
      openai: getOadToken(this.env, OAD_TOKEN_KEYS.openai),
      anthropic: getOadToken(this.env, OAD_TOKEN_KEYS.anthropic),
    };
  }

  private checkRateLimit(service: IntegrationEndpoint): boolean {
    const endpoint = INTEGRATION_ENDPOINTS[service];
    const now = Date.now();
    const last = this.lastRequestTimes[service];

    if (last === undefined) {
      return true;
    }

    if (now - last > 60_000) {
      this.rateLimitBuckets[service] = 0;
      return true;
    }

    return this.rateLimitBuckets[service] < endpoint.rateLimit;
  }

  private evaluatePolicy(
    service: IntegrationEndpoint,
    action: string,
    payload: Record<string, unknown>,
    priority: IntegrationPriority,
  ): IntegrationRouteResult | undefined {
    if (!this.policyMatrix) {
      return undefined;
    }

    try {
      const writeActions = ['create', 'update', 'delete', 'write', 'post', 'put', 'patch'];
      const isWrite = writeActions.some((token) => action.toLowerCase().includes(token));
      const userId =
        typeof payload.user_id === 'string' && payload.user_id.length > 0
          ? payload.user_id
          : 'system';

      const request: IntegrationPolicyRequest = {
        actionType: `INTEGRATION_${service.toUpperCase()}_${action.toUpperCase()}`,
        userId,
        context: {
          service,
          action,
          payloadKeys: Object.keys(payload),
          isWrite,
          priority,
        },
        autonomyBudget: payload.autonomy_budget,
      };
      const result = this.policyMatrix.authorize(request);
      this.ledger?.logEvent({
        eventType: 'INTEGRATION_POLICY_DECISION',
        component: `integration.${service}`,
        message: `Integration policy: ${result.decision}`,
        severity: result.decision === 'allow' ? 'INFO' : 'WARN',
        details: {
          service,
          action,
          decision: result.decision,
          reason: result.reason,
          risk: result.risk,
          reviewRoute: result.reviewRoute,
          isWrite,
        },
      });

      if (result.decision === 'deny') {
        return {
          success: false,
          error: `Policy denied: ${result.reason}`,
          service,
          action,
          policyDecision: 'deny',
        };
      }

      if (result.decision === 'review') {
        return {
          success: false,
          error: `Policy requires review (${result.reviewRoute ?? 'unknown'}): ${result.reason}`,
          service,
          action,
          policyDecision: 'review',
          reviewRoute: result.reviewRoute,
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.ledger?.logEvent({
        eventType: 'INTEGRATION_POLICY_ERROR',
        component: `integration.${service}`,
        message: `Policy check error (fail-open): ${errorMessage}`,
        severity: 'WARN',
        details: {
          service,
          action,
          error: errorMessage,
        },
      });
      return undefined;
    }

    return undefined;
  }

  private async dispatch(
    service: IntegrationEndpoint,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<IntegrationRouteResult> {
    return {
      success: true,
      service,
      action,
      timestamp: new Date().toISOString(),
      payloadKeys: Object.keys(payload),
    };
  }
}

export const CITADEL_ROUTER = new CitadelIntegrationRouter();
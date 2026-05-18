type WebEnrichmentUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type WebEnrichmentResult = {
  success: boolean;
  response?: string;
  citations?: string[];
  model?: string;
  usage?: WebEnrichmentUsage;
  error?: string;
};

export class PerplexityClient {
  private readonly apiKey?: string;
  private readonly endpoint?: string;
  private readonly defaultModel: string;
  private readonly enabled: boolean;
  private requestCount = 0;
  private lastRequest?: string;

  constructor(options: {
    apiKey?: string;
    endpoint?: string;
    model?: string;
    env?: NodeJS.ProcessEnv;
  } = {}) {
    const env = options.env ?? process.env;
    this.apiKey = options.apiKey ?? env.NEXUS_WEB_ENRICHMENT_API_KEY;
    this.endpoint = options.endpoint ?? env.NEXUS_WEB_ENRICHMENT_ENDPOINT;
    this.defaultModel = options.model ?? 'online-small';
    this.enabled = Boolean(this.apiKey && this.endpoint);
  }

  isAvailable(): boolean {
    return this.enabled;
  }

  shouldUsePerplexity(query: string): boolean {
    if (!this.enabled) {
      return false;
    }
    const triggers = [
      'latest',
      'current',
      'recent',
      'today',
      'news',
      'what is',
      'who is',
      'how do',
      'research',
      'documentation',
      'docs for',
      'api for',
      'fact check',
      'verify',
      'is it true',
    ];
    const normalized = query.toLowerCase();
    return triggers.some((trigger) => normalized.includes(trigger));
  }

  async enrichResponse(
    query: string,
    context: string = '',
    model?: string,
  ): Promise<WebEnrichmentResult> {
    if (!this.enabled || !this.apiKey || !this.endpoint) {
      return {
        success: false,
        error: 'Web enrichment client not configured',
      };
    }

    try {
      const payload = {
        model: model ?? this.defaultModel,
        query,
        context: context.length > 0 ? context : undefined,
      };
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Web enrichment API error: ${response.status}`,
        };
      }

      const data = (await response.json()) as {
        response?: string;
        citations?: string[];
        model?: string;
        usage?: WebEnrichmentUsage;
      };

      this.requestCount += 1;
      this.lastRequest = new Date().toISOString();

      return {
        success: true,
        response: data.response ?? '',
        citations: data.citations ?? [],
        model: data.model ?? (model ?? this.defaultModel),
        usage: data.usage,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  }

  getStats(): {
    enabled: boolean;
    requestCount: number;
    lastRequest?: string;
    model: string;
  } {
    return {
      enabled: this.enabled,
      requestCount: this.requestCount,
      lastRequest: this.lastRequest,
      model: this.defaultModel,
    };
  }
}
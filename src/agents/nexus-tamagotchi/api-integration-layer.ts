import { mkdirSync } from "node:fs";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { join } from "node:path";

export enum APIClientStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  RATE_LIMITED = "rate_limited",
  CIRCUIT_OPEN = "circuit_open",
  UNKNOWN = "unknown",
}

export enum RetryStrategy {
  NONE = "none",
  LINEAR = "linear",
  EXPONENTIAL = "exponential",
  FIBONACCI = "fibonacci",
  JITTERED = "jittered",
}

export enum RateLimitPolicy {
  FIXED_WINDOW = "fixed_window",
  SLIDING_WINDOW = "sliding_window",
  TOKEN_BUCKET = "token_bucket",
  LEAKY_BUCKET = "leaky_bucket",
  ADAPTIVE = "adaptive",
}

export enum AuthMethod {
  NONE = "none",
  API_KEY = "api_key",
  BEARER_TOKEN = "bearer_token",
  BASIC_AUTH = "basic_auth",
  OAUTH2 = "oauth2",
  JWT = "jwt",
  HMAC = "hmac",
  CUSTOM = "custom",
}

export enum WebhookEventType {
  STRIPE_PAYMENT_SUCCEEDED = "stripe.payment.succeeded",
  STRIPE_PAYMENT_FAILED = "stripe.payment.failed",
  STRIPE_SUBSCRIPTION_CREATED = "stripe.subscription.created",
  STRIPE_SUBSCRIPTION_UPDATED = "stripe.subscription.updated",
  STRIPE_SUBSCRIPTION_DELETED = "stripe.subscription.deleted",
  STRIPE_INVOICE_PAID = "stripe.invoice.paid",
  STRIPE_CUSTOMER_CREATED = "stripe.customer.created",
  DISCORD_MESSAGE_CREATE = "discord.message.create",
  DISCORD_REACTION_ADD = "discord.reaction.add",
  DISCORD_MEMBER_JOIN = "discord.member.join",
  DISCORD_MEMBER_LEAVE = "discord.member.leave",
  LINEAR_ISSUE_CREATED = "linear.issue.created",
  LINEAR_ISSUE_UPDATED = "linear.issue.updated",
  LINEAR_COMMENT_CREATED = "linear.comment.created",
  GITHUB_PUSH = "github.push",
  GITHUB_PR_OPENED = "github.pr.opened",
  GITHUB_PR_MERGED = "github.pr.merged",
  GITHUB_ISSUE_OPENED = "github.issue.opened",
  AGENT_XP_EARNED = "agent.xp.earned",
  AGENT_RANK_UP = "agent.rank.up",
  AGENT_BADGE_UNLOCKED = "agent.badge.unlocked",
  AGENT_QUEST_COMPLETED = "agent.quest.completed",
  SYSTEM_HEALTH_CHECK = "system.health.check",
  SYSTEM_ERROR = "system.error",
  SYSTEM_ALERT = "system.alert",
}

export type RetryConfig = {
  strategy: RetryStrategy;
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterFactor: number;
  retryOnStatusCodes: number[];
  retryOnExceptions: string[];
};

export type RateLimitConfig = {
  policy: RateLimitPolicy;
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
  windowSizeSeconds: number;
  adaptiveThreshold: number;
};

export type CircuitBreakerConfig = {
  failureThreshold: number;
  successThreshold: number;
  halfOpenTimeoutSeconds: number;
  resetTimeoutSeconds: number;
  windowSizeSeconds: number;
  monitoredExceptions: string[];
};

export type AuthConfig = {
  method: AuthMethod;
  apiKey?: string;
  apiKeyHeader: string;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthTokenUrl?: string;
  oauthScope?: string;
  jwtSecret?: string;
  jwtAlgorithm: string;
  customHandler?: (headers: Record<string, string>) => Record<string, string>;
};

export type APIClientConfig = {
  name: string;
  baseUrl: string;
  timeoutSeconds: number;
  auth: AuthConfig;
  retry: RetryConfig;
  rateLimit: RateLimitConfig;
  circuitBreaker: CircuitBreakerConfig;
  defaultHeaders: Record<string, string>;
  verifySsl: boolean;
  proxy?: string;
  enableCaching: boolean;
  cacheTtlSeconds: number;
  enableMetrics: boolean;
  logRequests: boolean;
  logResponses: boolean;
};

type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type APIRequest = {
  id?: string;
  method: HTTPMethod;
  endpoint: string;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  jsonBody?: Record<string, unknown>;
  timeoutOverrideSeconds?: number;
  skipAuth?: boolean;
  skipRetry?: boolean;
  skipRateLimit?: boolean;
  cacheKey?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

type PreparedRequest = {
  requestId: string;
  method: HTTPMethod;
  url: string;
  params: Record<string, unknown>;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
  jsonBody?: Record<string, unknown>;
  timeoutSeconds: number;
};

type HTTPResponseData = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  strategy: RetryStrategy.EXPONENTIAL,
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
  jitterFactor: 0.1,
  retryOnStatusCodes: [429, 500, 502, 503, 504],
  retryOnExceptions: ["ConnectionError", "TimeoutError", "Error"],
};

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  policy: RateLimitPolicy.TOKEN_BUCKET,
  requestsPerSecond: 10,
  requestsPerMinute: 600,
  requestsPerHour: 10000,
  burstLimit: 20,
  windowSizeSeconds: 60,
  adaptiveThreshold: 0.8,
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  halfOpenTimeoutSeconds: 30,
  resetTimeoutSeconds: 60,
  windowSizeSeconds: 120,
  monitoredExceptions: ["Error"],
};

const DEFAULT_AUTH_CONFIG: AuthConfig = {
  method: AuthMethod.NONE,
  apiKeyHeader: "X-API-Key",
  jwtAlgorithm: "HS256",
};

function mergeClientConfig(input: Partial<APIClientConfig> & {
  name: string;
  baseUrl: string;
}): APIClientConfig {
  return {
    name: input.name,
    baseUrl: input.baseUrl,
    timeoutSeconds: input.timeoutSeconds ?? 30,
    auth: { ...DEFAULT_AUTH_CONFIG, ...(input.auth ?? {}) },
    retry: { ...DEFAULT_RETRY_CONFIG, ...(input.retry ?? {}) },
    rateLimit: { ...DEFAULT_RATE_LIMIT_CONFIG, ...(input.rateLimit ?? {}) },
    circuitBreaker: {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...(input.circuitBreaker ?? {}),
    },
    defaultHeaders: { ...(input.defaultHeaders ?? {}) },
    verifySsl: input.verifySsl ?? true,
    proxy: input.proxy,
    enableCaching: input.enableCaching ?? true,
    cacheTtlSeconds: input.cacheTtlSeconds ?? 300,
    enableMetrics: input.enableMetrics ?? true,
    logRequests: input.logRequests ?? true,
    logResponses: input.logResponses ?? false,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class APIResponse {
  requestId: string;
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
  contentType: string;
  elapsedMs: number;
  fromCache: boolean;
  retryCount: number;
  error?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
  metadata: Record<string, unknown>;
  receivedAt: string;

  constructor(input: {
    requestId: string;
    statusCode: number;
    headers?: Record<string, string>;
    body?: unknown;
    contentType?: string;
    elapsedMs?: number;
    fromCache?: boolean;
    retryCount?: number;
    error?: string;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
    metadata?: Record<string, unknown>;
    receivedAt?: string;
  }) {
    this.requestId = input.requestId;
    this.statusCode = input.statusCode;
    this.headers = { ...(input.headers ?? {}) };
    this.body = input.body;
    this.contentType = input.contentType ?? "application/json";
    this.elapsedMs = input.elapsedMs ?? 0;
    this.fromCache = input.fromCache ?? false;
    this.retryCount = input.retryCount ?? 0;
    this.error = input.error;
    this.rateLimitRemaining = input.rateLimitRemaining;
    this.rateLimitReset = input.rateLimitReset;
    this.metadata = { ...(input.metadata ?? {}) };
    this.receivedAt = input.receivedAt ?? new Date().toISOString();
  }

  get isSuccess(): boolean {
    return this.statusCode >= 200 && this.statusCode < 300;
  }

  get isError(): boolean {
    return this.statusCode >= 400;
  }

  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  json<T extends Record<string, unknown>>(): T | undefined {
    if (typeof this.body === "object" && this.body !== null) {
      return this.body as T;
    }
    return undefined;
  }
}

export class APIMetrics {
  totalRequests = 0;
  successfulRequests = 0;
  failedRequests = 0;
  cachedResponses = 0;
  totalRetries = 0;
  rateLimitedRequests = 0;
  circuitBreakerOpens = 0;
  totalLatencyMs = 0;
  requestsByEndpoint: Record<string, number> = {};
  errorsByType: Record<string, number> = {};
  latencyPercentiles: Record<string, number> = {};
  lastRequestAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;

  get successRate(): number {
    if (this.totalRequests === 0) {
      return 0;
    }
    return (this.successfulRequests / this.totalRequests) * 100;
  }

  get avgLatencyMs(): number {
    if (this.successfulRequests === 0) {
      return 0;
    }
    return this.totalLatencyMs / this.successfulRequests;
  }
}

export type WebhookEvent = {
  id: string;
  eventType: WebhookEventType;
  source: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  signature?: string;
  signatureValid: boolean;
  processed: boolean;
  processedAt?: string;
  error?: string;
  receivedAt: string;
};

export type WebhookHandler = {
  eventType: WebhookEventType;
  handler: (event: WebhookEvent) => unknown | Promise<unknown>;
  name: string;
  asyncHandler?: boolean;
  retryOnFailure?: boolean;
  maxRetries?: number;
  timeoutSeconds?: number;
};

export class RateLimiter {
  private tokens: number;
  private lastUpdate: number;
  private requestHistory: number[] = [];
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.tokens = config.burstLimit;
    this.lastUpdate = Date.now();
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - this.lastUpdate) / 1000);
    this.tokens = Math.min(
      this.config.burstLimit,
      this.tokens + elapsedSeconds * this.config.requestsPerSecond,
    );
    this.lastUpdate = now;
  }

  acquire(tokenCount = 1): { success: boolean; waitSeconds: number } {
    this.refillTokens();
    if (this.tokens >= tokenCount) {
      this.tokens -= tokenCount;
      this.requestHistory.push(Date.now());
      const cutoff = Date.now() - this.config.windowSizeSeconds * 1000;
      this.requestHistory = this.requestHistory.filter((time) => time >= cutoff);
      return { success: true, waitSeconds: 0 };
    }
    const deficit = tokenCount - this.tokens;
    const waitSeconds =
      this.config.requestsPerSecond <= 0
        ? Number.POSITIVE_INFINITY
        : deficit / this.config.requestsPerSecond;
    return { success: false, waitSeconds };
  }

  async waitForToken(tokenCount = 1, maxWaitMs = 30000): Promise<boolean> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() <= deadline) {
      const result = this.acquire(tokenCount);
      if (result.success) {
        return true;
      }
      const sleepMs = Math.max(5, Math.min(100, Math.floor(result.waitSeconds * 1000)));
      await sleep(sleepMs);
    }
    return false;
  }

  getStats(): Record<string, unknown> {
    this.refillTokens();
    return {
      availableTokens: this.tokens,
      burstLimit: this.config.burstLimit,
      requestsPerSecond: this.config.requestsPerSecond,
      requestsInWindow: this.requestHistory.length,
      windowSizeSeconds: this.config.windowSizeSeconds,
    };
  }
}

export class CircuitBreaker {
  static State = {
    CLOSED: "closed",
    OPEN: "open",
    HALF_OPEN: "half_open",
  } as const;

  private readonly config: CircuitBreakerConfig;
  private state: (typeof CircuitBreaker.State)[keyof typeof CircuitBreaker.State] =
    CircuitBreaker.State.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastStateChange = Date.now();
  private failureHistory: Array<{ timestamp: number; error: string }> = [];

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  canExecute(): { allowed: boolean; reason: string } {
    if (this.state === CircuitBreaker.State.CLOSED) {
      return { allowed: true, reason: "Circuit closed" };
    }
    if (this.state === CircuitBreaker.State.OPEN) {
      const elapsedSeconds = (Date.now() - this.lastStateChange) / 1000;
      if (elapsedSeconds >= this.config.halfOpenTimeoutSeconds) {
        this.state = CircuitBreaker.State.HALF_OPEN;
        this.lastStateChange = Date.now();
        return { allowed: true, reason: "Circuit half-open" };
      }
      return { allowed: false, reason: "Circuit open" };
    }
    return { allowed: true, reason: "Circuit half-open" };
  }

  recordSuccess(): void {
    if (this.state === CircuitBreaker.State.HALF_OPEN) {
      this.successCount += 1;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitBreaker.State.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastStateChange = Date.now();
      }
    }
  }

  recordFailure(error: string): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    this.failureHistory.push({ timestamp: Date.now(), error });
    const cutoff = Date.now() - this.config.windowSizeSeconds * 1000;
    this.failureHistory = this.failureHistory.filter((item) => item.timestamp >= cutoff);
    if (this.state === CircuitBreaker.State.HALF_OPEN) {
      this.state = CircuitBreaker.State.OPEN;
      this.successCount = 0;
      this.lastStateChange = Date.now();
      return;
    }
    if (
      this.state === CircuitBreaker.State.CLOSED &&
      this.failureCount >= this.config.failureThreshold
    ) {
      this.state = CircuitBreaker.State.OPEN;
      this.lastStateChange = Date.now();
    }
  }

  reset(): void {
    this.state = CircuitBreaker.State.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.failureHistory = [];
    this.lastStateChange = Date.now();
  }

  getStats(): Record<string, unknown> {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failureThreshold: this.config.failureThreshold,
      successThreshold: this.config.successThreshold,
      recentFailures: this.failureHistory.length,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : undefined,
      timeInCurrentStateSeconds: (Date.now() - this.lastStateChange) / 1000,
    };
  }
}

export class ResponseCache {
  private readonly defaultTtlSeconds: number;
  private readonly maxEntries: number;
  private readonly cache = new Map<string, { response: APIResponse; expiresAt: number }>();

  constructor(defaultTtlSeconds = 300, maxEntries = 1000) {
    this.defaultTtlSeconds = defaultTtlSeconds;
    this.maxEntries = maxEntries;
  }

  get(key: string): APIResponse | undefined {
    const cached = this.cache.get(key);
    if (!cached) {
      return undefined;
    }
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return new APIResponse({
      ...cached.response,
      fromCache: true,
      headers: { ...cached.response.headers },
      metadata: { ...cached.response.metadata },
    });
  }

  set(key: string, response: APIResponse, ttlSeconds?: number): void {
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }
    const expiresAt = Date.now() + 1000 * (ttlSeconds ?? this.defaultTtlSeconds);
    this.cache.set(key, {
      response: new APIResponse({
        ...response,
        fromCache: false,
        headers: { ...response.headers },
        metadata: { ...response.metadata },
      }),
      expiresAt,
    });
  }

  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): number {
    const count = this.cache.size;
    this.cache.clear();
    return count;
  }

  getStats(): Record<string, unknown> {
    const now = Date.now();
    let activeEntries = 0;
    for (const value of this.cache.values()) {
      if (value.expiresAt >= now) {
        activeEntries += 1;
      }
    }
    return {
      totalEntries: this.cache.size,
      activeEntries,
      expiredEntries: this.cache.size - activeEntries,
      maxEntries: this.maxEntries,
      defaultTtlSeconds: this.defaultTtlSeconds,
    };
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestExpiry = Number.POSITIVE_INFINITY;
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt < oldestExpiry) {
        oldestExpiry = value.expiresAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

export class RetryExecutor {
  private readonly config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = config;
  }

  private calculateDelayMs(attempt: number): number {
    if (this.config.strategy === RetryStrategy.NONE) {
      return 0;
    }
    if (this.config.strategy === RetryStrategy.LINEAR) {
      return Math.min(this.config.maxDelayMs, this.config.initialDelayMs * attempt);
    }
    if (this.config.strategy === RetryStrategy.FIBONACCI) {
      let previous = 1;
      let current = 1;
      for (let index = 2; index <= attempt; index += 1) {
        const next = previous + current;
        previous = current;
        current = next;
      }
      return Math.min(this.config.maxDelayMs, this.config.initialDelayMs * current);
    }
    const baseDelay = Math.min(
      this.config.maxDelayMs,
      this.config.initialDelayMs * this.config.multiplier ** Math.max(0, attempt - 1),
    );
    if (this.config.strategy === RetryStrategy.JITTERED) {
      const jitter = (Math.random() * 2 - 1) * this.config.jitterFactor;
      return Math.max(0, Math.floor(baseDelay * (1 + jitter)));
    }
    return Math.floor(baseDelay);
  }

  shouldRetry(statusCode?: number, error?: Error): boolean {
    if (typeof statusCode === "number") {
      return this.config.retryOnStatusCodes.includes(statusCode);
    }
    if (error) {
      return this.config.retryOnExceptions.includes(error.name);
    }
    return false;
  }

  async execute(
    func: () => Promise<APIResponse>,
    onRetry?: (attempt: number, delayMs: number, reason: string) => void,
  ): Promise<APIResponse> {
    let lastResponse: APIResponse | undefined;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        const response = await func();
        if (!this.shouldRetry(response.statusCode) || response.isSuccess) {
          response.retryCount = attempt;
          return response;
        }
        lastResponse = response;
      } catch (error) {
        const normalized =
          error instanceof Error ? error : new Error("Unknown request error");
        lastError = normalized;
        if (!this.shouldRetry(undefined, normalized)) {
          throw normalized;
        }
      }

      if (attempt < this.config.maxRetries) {
        const delayMs = this.calculateDelayMs(attempt + 1);
        const reason = lastResponse
          ? `HTTP ${lastResponse.statusCode}`
          : lastError?.message ?? "retry";
        if (onRetry) {
          onRetry(attempt + 1, delayMs, reason);
        }
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    }

    if (lastResponse) {
      lastResponse.retryCount = this.config.maxRetries;
      return lastResponse;
    }
    if (lastError) {
      throw lastError;
    }
    throw new Error("Retry execution failed");
  }
}

export class BaseAPIClient {
  protected readonly config: APIClientConfig;
  protected readonly rateLimiter: RateLimiter;
  protected readonly circuitBreaker: CircuitBreaker;
  protected readonly cache?: ResponseCache;
  protected readonly retryExecutor: RetryExecutor;
  readonly metrics = new APIMetrics();

  constructor(config: Partial<APIClientConfig> & { name: string; baseUrl: string }) {
    this.config = mergeClientConfig(config);
    this.rateLimiter = new RateLimiter(this.config.rateLimit);
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
    this.cache = this.config.enableCaching
      ? new ResponseCache(this.config.cacheTtlSeconds)
      : undefined;
    this.retryExecutor = new RetryExecutor(this.config.retry);
  }

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const auth = this.config.auth;

    if (auth.method === AuthMethod.API_KEY && auth.apiKey) {
      headers[auth.apiKeyHeader] = auth.apiKey;
    } else if (auth.method === AuthMethod.BEARER_TOKEN && auth.bearerToken) {
      headers.Authorization = `Bearer ${auth.bearerToken}`;
    } else if (auth.method === AuthMethod.BASIC_AUTH && auth.basicUsername) {
      const encoded = Buffer.from(
        `${auth.basicUsername}:${auth.basicPassword ?? ""}`,
      ).toString("base64");
      headers.Authorization = `Basic ${encoded}`;
    } else if (auth.method === AuthMethod.CUSTOM && auth.customHandler) {
      return auth.customHandler(headers);
    }

    return headers;
  }

  protected buildUrl(endpoint: string): string {
    const normalizedBase = this.config.baseUrl.replace(/\/+$/, "");
    if (/^https?:\/\//.test(endpoint)) {
      return endpoint;
    }
    const normalizedEndpoint = endpoint.replace(/^\/+/, "");
    return `${normalizedBase}/${normalizedEndpoint}`;
  }

  protected generateCacheKey(request: APIRequest): string {
    if (request.cacheKey) {
      return request.cacheKey;
    }
    return JSON.stringify({
      method: request.method,
      endpoint: request.endpoint,
      params: request.params ?? {},
    });
  }

  protected async performHttpRequest(
    _request: PreparedRequest,
  ): Promise<HTTPResponseData> {
    return {
      statusCode: 503,
      body: { error: "HTTP client transport not configured" },
      headers: {},
    };
  }

  private updateMetrics(request: APIRequest, response: APIResponse): void {
    this.metrics.totalRequests += 1;
    this.metrics.lastRequestAt = new Date().toISOString();
    const endpointKey = `${request.method} ${request.endpoint}`;
    this.metrics.requestsByEndpoint[endpointKey] =
      (this.metrics.requestsByEndpoint[endpointKey] ?? 0) + 1;

    if (response.isSuccess) {
      this.metrics.successfulRequests += 1;
      this.metrics.lastSuccessAt = new Date().toISOString();
      this.metrics.totalLatencyMs += response.elapsedMs;
    } else {
      this.metrics.failedRequests += 1;
      this.metrics.lastFailureAt = new Date().toISOString();
      const errorKey = response.error ?? String(response.statusCode);
      this.metrics.errorsByType[errorKey] =
        (this.metrics.errorsByType[errorKey] ?? 0) + 1;
    }

    if (response.fromCache) {
      this.metrics.cachedResponses += 1;
    }
    if (response.isRateLimited) {
      this.metrics.rateLimitedRequests += 1;
    }
    this.metrics.totalRetries += response.retryCount;
  }

  async request(input: APIRequest): Promise<APIResponse> {
    const request: APIRequest = {
      ...input,
      id: input.id ?? randomUUID(),
      params: { ...(input.params ?? {}) },
      headers: { ...(input.headers ?? {}) },
      metadata: { ...(input.metadata ?? {}) },
      tags: [...(input.tags ?? [])],
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    const circuit = this.circuitBreaker.canExecute();
    if (!circuit.allowed) {
      return new APIResponse({
        requestId: request.id ?? randomUUID(),
        statusCode: 503,
        error: `Circuit breaker: ${circuit.reason}`,
      });
    }

    if (!request.skipRateLimit) {
      const allowed = await this.rateLimiter.waitForToken(1, 5000);
      if (!allowed) {
        return new APIResponse({
          requestId: request.id ?? randomUUID(),
          statusCode: 429,
          error: "Rate limited",
        });
      }
    }

    if (this.cache && request.method === "GET") {
      const cached = this.cache.get(this.generateCacheKey(request));
      if (cached) {
        this.updateMetrics(request, cached);
        return cached;
      }
    }

    const headers = {
      ...this.config.defaultHeaders,
      ...(request.headers ?? {}),
    };
    if (!request.skipAuth) {
      Object.assign(headers, this.getAuthHeaders());
    }

    const preparedRequest: PreparedRequest = {
      requestId: request.id ?? randomUUID(),
      method: request.method,
      url: this.buildUrl(request.endpoint),
      params: { ...(request.params ?? {}) },
      headers,
      body: request.body ? { ...request.body } : undefined,
      jsonBody: request.jsonBody ? { ...request.jsonBody } : undefined,
      timeoutSeconds: request.timeoutOverrideSeconds ?? this.config.timeoutSeconds,
    };

    const executeOnce = async (): Promise<APIResponse> => {
      const start = Date.now();
      try {
        const data = await this.performHttpRequest(preparedRequest);
        return new APIResponse({
          requestId: preparedRequest.requestId,
          statusCode: data.statusCode,
          headers: data.headers,
          body: data.body,
          elapsedMs: Date.now() - start,
          rateLimitRemaining: data.rateLimitRemaining,
          rateLimitReset:
            typeof data.rateLimitReset === "number"
              ? new Date(data.rateLimitReset * 1000)
              : undefined,
          error:
            data.statusCode >= 400 && typeof data.body === "object" && data.body
              ? String((data.body as Record<string, unknown>).error ?? "")
              : undefined,
        });
      } catch (error) {
        const normalized =
          error instanceof Error ? error : new Error("Unknown request error");
        return new APIResponse({
          requestId: preparedRequest.requestId,
          statusCode: 500,
          elapsedMs: Date.now() - start,
          error: normalized.message,
        });
      }
    };

    const response = request.skipRetry
      ? await executeOnce()
      : await this.retryExecutor.execute(executeOnce);

    if (response.isSuccess) {
      this.circuitBreaker.recordSuccess();
      if (this.cache && request.method === "GET") {
        this.cache.set(this.generateCacheKey(request), response);
      }
    } else {
      this.circuitBreaker.recordFailure(
        response.error ?? `HTTP ${response.statusCode}`,
      );
      if (this.circuitBreaker.getStats().state === CircuitBreaker.State.OPEN) {
        this.metrics.circuitBreakerOpens += 1;
      }
    }

    this.updateMetrics(request, response);
    return response;
  }

  async get(
    endpoint: string,
    params: Record<string, unknown> = {},
    options: Partial<APIRequest> = {},
  ): Promise<APIResponse> {
    return this.request({
      ...options,
      method: "GET",
      endpoint,
      params,
    });
  }

  async post(
    endpoint: string,
    jsonBody: Record<string, unknown> = {},
    options: Partial<APIRequest> = {},
  ): Promise<APIResponse> {
    return this.request({
      ...options,
      method: "POST",
      endpoint,
      jsonBody,
    });
  }

  async put(
    endpoint: string,
    jsonBody: Record<string, unknown> = {},
    options: Partial<APIRequest> = {},
  ): Promise<APIResponse> {
    return this.request({
      ...options,
      method: "PUT",
      endpoint,
      jsonBody,
    });
  }

  async patch(
    endpoint: string,
    jsonBody: Record<string, unknown> = {},
    options: Partial<APIRequest> = {},
  ): Promise<APIResponse> {
    return this.request({
      ...options,
      method: "PATCH",
      endpoint,
      jsonBody,
    });
  }

  async delete(
    endpoint: string,
    options: Partial<APIRequest> = {},
  ): Promise<APIResponse> {
    return this.request({
      ...options,
      method: "DELETE",
      endpoint,
    });
  }

  getHealth(): Record<string, unknown> {
    const circuitStats = this.circuitBreaker.getStats();
    const rateStats = this.rateLimiter.getStats();
    const cacheStats = this.cache?.getStats() ?? {};

    let status = APIClientStatus.HEALTHY;
    if (circuitStats.state === CircuitBreaker.State.OPEN) {
      status = APIClientStatus.CIRCUIT_OPEN;
    } else if (
      this.metrics.totalRequests > 10 &&
      this.metrics.successRate < 50
    ) {
      status = APIClientStatus.UNHEALTHY;
    } else if (
      this.metrics.totalRequests > 10 &&
      this.metrics.successRate < 90
    ) {
      status = APIClientStatus.DEGRADED;
    } else if (
      typeof rateStats.availableTokens === "number" &&
      rateStats.availableTokens < 1
    ) {
      status = APIClientStatus.RATE_LIMITED;
    }

    return {
      name: this.config.name,
      status,
      metrics: {
        totalRequests: this.metrics.totalRequests,
        successRate: this.metrics.successRate,
        avgLatencyMs: this.metrics.avgLatencyMs,
        failedRequests: this.metrics.failedRequests,
        cachedResponses: this.metrics.cachedResponses,
        totalRetries: this.metrics.totalRetries,
      },
      circuitBreaker: circuitStats,
      rateLimiter: rateStats,
      cache: cacheStats,
      lastRequestAt: this.metrics.lastRequestAt,
      lastSuccessAt: this.metrics.lastSuccessAt,
      lastFailureAt: this.metrics.lastFailureAt,
    };
  }
}

export class OpenAIClient extends BaseAPIClient {
  constructor(apiKey?: string) {
    super({
      name: "openai",
      baseUrl: "https://api.openai.com/v1",
      auth: {
        method: AuthMethod.BEARER_TOKEN,
        bearerToken: apiKey ?? process.env.OPENAI_API_KEY ?? "",
        apiKeyHeader: "X-API-Key",
        jwtAlgorithm: "HS256",
      },
      timeoutSeconds: 60,
    });
  }

  async chatCompletion(input: {
    messages: Array<Record<string, string>>;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    tools?: Array<Record<string, unknown>>;
    toolChoice?: string;
    stream?: boolean;
  }): Promise<APIResponse> {
    return this.post("/chat/completions", {
      model: input.model ?? "gpt-4o-mini",
      messages: input.messages,
      max_tokens: input.maxTokens ?? 4096,
      temperature: input.temperature ?? 0.7,
      stream: input.stream ?? false,
      ...(input.tools ? { tools: input.tools } : {}),
      ...(input.toolChoice ? { tool_choice: input.toolChoice } : {}),
    });
  }

  async embeddings(input: {
    inputText: string | string[];
    model?: string;
  }): Promise<APIResponse> {
    return this.post("/embeddings", {
      model: input.model ?? "text-embedding-3-small",
      input: input.inputText,
    });
  }
}

export class SupabaseClient extends BaseAPIClient {
  constructor(input: {
    projectUrl?: string;
    apiKey?: string;
    serviceRoleKey?: string;
  } = {}) {
    const projectUrl = input.projectUrl ?? process.env.SUPABASE_URL ?? "";
    const key =
      input.serviceRoleKey ??
      input.apiKey ??
      process.env.SUPABASE_ANON_KEY ??
      "";
    super({
      name: "supabase",
      baseUrl: `${projectUrl}/rest/v1`,
      auth: {
        method: AuthMethod.API_KEY,
        apiKey: key,
        apiKeyHeader: "apikey",
        jwtAlgorithm: "HS256",
      },
      defaultHeaders: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    });
  }

  async select(input: {
    table: string;
    columns?: string;
    filters?: Record<string, unknown>;
    order?: string;
    limit?: number;
    offset?: number;
  }): Promise<APIResponse> {
    const params: Record<string, unknown> = {
      select: input.columns ?? "*",
    };
    for (const [key, value] of Object.entries(input.filters ?? {})) {
      params[key] = `eq.${String(value)}`;
    }
    if (input.order) {
      params.order = input.order;
    }
    if (typeof input.limit === "number") {
      params.limit = input.limit;
    }
    if (typeof input.offset === "number") {
      params.offset = input.offset;
    }
    return this.get(input.table, params);
  }

  async insert(
    table: string,
    data: Record<string, unknown> | Array<Record<string, unknown>>,
  ): Promise<APIResponse> {
    return this.post(table, {
      payload: Array.isArray(data) ? data : [data],
    });
  }

  async update(
    table: string,
    data: Record<string, unknown>,
    filters: Record<string, unknown>,
  ): Promise<APIResponse> {
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filters)) {
      params[key] = `eq.${String(value)}`;
    }
    return this.patch(table, data, { params });
  }

  async remove(
    table: string,
    filters: Record<string, unknown>,
  ): Promise<APIResponse> {
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filters)) {
      params[key] = `eq.${String(value)}`;
    }
    return this.delete(table, { params });
  }

  async rpc(functionName: string, params: Record<string, unknown> = {}): Promise<APIResponse> {
    return this.post(`rpc/${functionName}`, params);
  }
}

export class StripeClient extends BaseAPIClient {
  constructor(apiKey?: string) {
    super({
      name: "stripe",
      baseUrl: "https://api.stripe.com/v1",
      auth: {
        method: AuthMethod.BEARER_TOKEN,
        bearerToken: apiKey ?? process.env.STRIPE_SECRET_KEY ?? "",
        apiKeyHeader: "X-API-Key",
        jwtAlgorithm: "HS256",
      },
      defaultHeaders: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }
}

export class DiscordClient extends BaseAPIClient {
  constructor(botToken?: string) {
    super({
      name: "discord",
      baseUrl: "https://discord.com/api/v10",
      auth: {
        method: AuthMethod.BEARER_TOKEN,
        bearerToken: `Bot ${botToken ?? process.env.DISCORD_BOT_TOKEN ?? ""}`,
        apiKeyHeader: "X-API-Key",
        jwtAlgorithm: "HS256",
      },
    });
  }

  async sendMessage(input: {
    channelId: string;
    content?: string;
    embeds?: Array<Record<string, unknown>>;
  }): Promise<APIResponse> {
    return this.post(`/channels/${input.channelId}/messages`, {
      ...(input.content ? { content: input.content } : {}),
      ...(input.embeds ? { embeds: input.embeds } : {}),
    });
  }
}

export class LinearClient extends BaseAPIClient {
  constructor(apiKey?: string) {
    super({
      name: "linear",
      baseUrl: "https://api.linear.app",
      auth: {
        method: AuthMethod.BEARER_TOKEN,
        bearerToken: apiKey ?? process.env.LINEAR_API_KEY ?? "",
        apiKeyHeader: "X-API-Key",
        jwtAlgorithm: "HS256",
      },
    });
  }

  async graphql(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<APIResponse> {
    return this.post("/graphql", { query, variables });
  }
}

export class SlackClient extends BaseAPIClient {
  constructor(botToken?: string) {
    super({
      name: "slack",
      baseUrl: "https://slack.com/api",
      auth: {
        method: AuthMethod.BEARER_TOKEN,
        bearerToken: botToken ?? process.env.SLACK_BOT_TOKEN ?? "",
        apiKeyHeader: "X-API-Key",
        jwtAlgorithm: "HS256",
      },
    });
  }

  async postMessage(input: {
    channel: string;
    text?: string;
    blocks?: Array<Record<string, unknown>>;
  }): Promise<APIResponse> {
    return this.post("/chat.postMessage", {
      channel: input.channel,
      ...(input.text ? { text: input.text } : {}),
      ...(input.blocks ? { blocks: input.blocks } : {}),
    });
  }
}

export class NotionClient extends BaseAPIClient {
  constructor(apiKey?: string) {
    super({
      name: "notion",
      baseUrl: "https://api.notion.com/v1",
      auth: {
        method: AuthMethod.BEARER_TOKEN,
        bearerToken: apiKey ?? process.env.NOTION_API_KEY ?? "",
        apiKeyHeader: "X-API-Key",
        jwtAlgorithm: "HS256",
      },
      defaultHeaders: { "Notion-Version": "2022-06-28" },
    });
  }
}

export class PostHogClient extends BaseAPIClient {
  private readonly projectApiKey: string;

  constructor(input: { apiKey?: string; host?: string; projectApiKey?: string } = {}) {
    super({
      name: "posthog",
      baseUrl: input.host ?? process.env.POSTHOG_HOST ?? "https://app.posthog.com",
      auth: {
        method: AuthMethod.API_KEY,
        apiKey: input.apiKey ?? process.env.POSTHOG_API_KEY ?? "",
        apiKeyHeader: "Authorization",
        jwtAlgorithm: "HS256",
      },
    });
    this.projectApiKey =
      input.projectApiKey ?? process.env.POSTHOG_PROJECT_API_KEY ?? "";
  }

  async capture(input: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
    timestamp?: string;
  }): Promise<APIResponse> {
    return this.post("/capture", {
      api_key: this.projectApiKey,
      distinct_id: input.distinctId,
      event: input.event,
      properties: input.properties ?? {},
      ...(input.timestamp ? { timestamp: input.timestamp } : {}),
    });
  }
}

export class DatadogClient extends BaseAPIClient {
  constructor(input: { apiKey?: string; appKey?: string; site?: string } = {}) {
    const site = input.site ?? process.env.DD_SITE ?? "datadoghq.com";
    super({
      name: "datadog",
      baseUrl: `https://api.${site}`,
      auth: {
        method: AuthMethod.CUSTOM,
        customHandler: (headers) => ({
          ...headers,
          "DD-API-KEY": input.apiKey ?? process.env.DD_API_KEY ?? "",
          "DD-APPLICATION-KEY": input.appKey ?? process.env.DD_APP_KEY ?? "",
        }),
        apiKeyHeader: "X-API-Key",
        jwtAlgorithm: "HS256",
      },
    });
  }

  async createEvent(input: {
    title: string;
    text: string;
    alertType?: string;
    tags?: string[];
    priority?: string;
  }): Promise<APIResponse> {
    return this.post("/api/v1/events", {
      title: input.title,
      text: input.text,
      alert_type: input.alertType ?? "info",
      tags: input.tags ?? [],
      priority: input.priority ?? "normal",
    });
  }
}

export class WebhookProcessor {
  private readonly handlers = new Map<string, WebhookHandler[]>();
  private readonly history: WebhookEvent[] = [];
  private readonly maxHistory = 1000;

  registerHandler(handler: WebhookHandler): void {
    const key = handler.eventType;
    const existing = this.handlers.get(key) ?? [];
    existing.push(handler);
    this.handlers.set(key, existing);
  }

  unregisterHandler(eventType: WebhookEventType, handlerName: string): boolean {
    const existing = this.handlers.get(eventType);
    if (!existing) {
      return false;
    }
    const filtered = existing.filter((handler) => handler.name !== handlerName);
    this.handlers.set(eventType, filtered);
    return filtered.length < existing.length;
  }

  async processEvent(event: WebhookEvent): Promise<Record<string, unknown>> {
    const handlers = this.handlers.get(event.eventType) ?? [];
    const result = {
      eventId: event.id,
      eventType: event.eventType,
      handlersCalled: 0,
      handlersSucceeded: 0,
      handlersFailed: 0,
      errors: [] as Array<Record<string, unknown>>,
    };

    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }

    for (const handler of handlers) {
      result.handlersCalled += 1;
      const retries = Math.max(0, handler.maxRetries ?? 0);
      let attempts = 0;
      let success = false;
      while (attempts <= retries && !success) {
        attempts += 1;
        try {
          await handler.handler(event);
          success = true;
          result.handlersSucceeded += 1;
        } catch (error) {
          if (!handler.retryOnFailure || attempts > retries) {
            result.handlersFailed += 1;
            result.errors.push({
              handler: handler.name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    event.processed = true;
    event.processedAt = new Date().toISOString();
    return result;
  }

  verifySignature(
    payload: Buffer,
    signature: string,
    secret: string,
    algorithm: "sha256" | "sha1" = "sha256",
  ): boolean {
    const expected = createHmac(algorithm, secret).update(payload).digest("hex");
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  getEventHistory(input: {
    eventType?: WebhookEventType;
    source?: string;
    limit?: number;
  } = {}): WebhookEvent[] {
    const filtered = this.history.filter((event) => {
      if (input.eventType && event.eventType !== input.eventType) {
        return false;
      }
      if (input.source && event.source !== input.source) {
        return false;
      }
      return true;
    });
    const limit = Math.max(1, input.limit ?? 100);
    return filtered.slice(-limit).map((event) => ({ ...event }));
  }

  getStats(): Record<string, unknown> {
    const eventsByType: Record<string, number> = {};
    for (const event of this.history) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] ?? 0) + 1;
    }
    return {
      totalEvents: this.history.length,
      registeredHandlers: [...this.handlers.values()].reduce(
        (total, handlers) => total + handlers.length,
        0,
      ),
      eventTypesHandled: [...this.handlers.keys()],
      eventsByType,
      processedEvents: this.history.filter((event) => event.processed).length,
    };
  }
}

export class APIIntegrationLayer {
  private readonly storagePath: string;
  private openaiClient?: OpenAIClient;
  private supabaseClient?: SupabaseClient;
  private stripeClient?: StripeClient;
  private discordClient?: DiscordClient;
  private linearClient?: LinearClient;
  private slackClient?: SlackClient;
  private notionClient?: NotionClient;
  private posthogClient?: PostHogClient;
  private datadogClient?: DatadogClient;

  readonly webhooks = new WebhookProcessor();

  constructor(storagePath = join(process.cwd(), ".nexus_cache", "api-integration")) {
    this.storagePath = storagePath;
    mkdirSync(this.storagePath, { recursive: true });
  }

  get openai(): OpenAIClient {
    this.openaiClient ??= new OpenAIClient();
    return this.openaiClient;
  }

  get supabase(): SupabaseClient {
    this.supabaseClient ??= new SupabaseClient();
    return this.supabaseClient;
  }

  get stripe(): StripeClient {
    this.stripeClient ??= new StripeClient();
    return this.stripeClient;
  }

  get discord(): DiscordClient {
    this.discordClient ??= new DiscordClient();
    return this.discordClient;
  }

  get linear(): LinearClient {
    this.linearClient ??= new LinearClient();
    return this.linearClient;
  }

  get slack(): SlackClient {
    this.slackClient ??= new SlackClient();
    return this.slackClient;
  }

  get notion(): NotionClient {
    this.notionClient ??= new NotionClient();
    return this.notionClient;
  }

  get posthog(): PostHogClient {
    this.posthogClient ??= new PostHogClient();
    return this.posthogClient;
  }

  get datadog(): DatadogClient {
    this.datadogClient ??= new DatadogClient();
    return this.datadogClient;
  }

  getAllHealth(): Record<string, unknown> {
    const clients = {
      openai: this.openaiClient,
      supabase: this.supabaseClient,
      stripe: this.stripeClient,
      discord: this.discordClient,
      linear: this.linearClient,
      slack: this.slackClient,
      notion: this.notionClient,
      posthog: this.posthogClient,
      datadog: this.datadogClient,
    };
    let overallStatus: APIClientStatus = APIClientStatus.HEALTHY;
    const health: Record<string, unknown> = {};
    for (const [name, client] of Object.entries(clients)) {
      if (!client) {
        health[name] = { status: "not_initialized" };
        continue;
      }
      const clientHealth = client.getHealth();
      health[name] = clientHealth;
      const status = clientHealth.status as APIClientStatus;
      if (status === APIClientStatus.UNHEALTHY) {
        overallStatus = APIClientStatus.UNHEALTHY;
      } else if (
        overallStatus === APIClientStatus.HEALTHY &&
        [APIClientStatus.DEGRADED, APIClientStatus.CIRCUIT_OPEN, APIClientStatus.RATE_LIMITED].includes(status)
      ) {
        overallStatus = APIClientStatus.DEGRADED;
      }
    }
    return {
      timestamp: new Date().toISOString(),
      clients: health,
      overallStatus,
      webhooks: this.webhooks.getStats(),
      storagePath: this.storagePath,
    };
  }

  async trackEvent(
    input: {
      eventName: string;
      userId: string;
      properties?: Record<string, unknown>;
      sendTo?: Array<"posthog" | "datadog">;
    },
  ): Promise<Record<string, boolean>> {
    const targets = input.sendTo ?? ["posthog", "datadog"];
    const result: Record<string, boolean> = {};

    if (targets.includes("posthog")) {
      try {
        const response = await this.posthog.capture({
          distinctId: input.userId,
          event: input.eventName,
          properties: input.properties ?? {},
        });
        result.posthog = response.isSuccess;
      } catch {
        result.posthog = false;
      }
    }
    if (targets.includes("datadog")) {
      try {
        const tags = Object.entries(input.properties ?? {}).map(
          ([key, value]) => `${key}:${String(value)}`,
        );
        const response = await this.datadog.createEvent({
          title: input.eventName,
          text: JSON.stringify(input.properties ?? {}),
          tags: [...tags, `user:${input.userId}`],
        });
        result.datadog = response.isSuccess;
      } catch {
        result.datadog = false;
      }
    }
    return result;
  }

  async broadcastNotification(input: {
    message: string;
    title?: string;
    channels?: Array<"discord" | "slack">;
    embedData?: Record<string, unknown>;
  }): Promise<Record<string, boolean>> {
    const channels = input.channels ?? ["discord", "slack"];
    const result: Record<string, boolean> = {};
    const discordChannel = process.env.DISCORD_NOTIFICATION_CHANNEL;
    const slackChannel = process.env.SLACK_NOTIFICATION_CHANNEL;

    if (channels.includes("discord") && discordChannel) {
      try {
        const response = await this.discord.sendMessage({
          channelId: discordChannel,
          content: input.title ? `**${input.title}**\n${input.message}` : input.message,
          embeds: input.embedData ? [input.embedData] : undefined,
        });
        result.discord = response.isSuccess;
      } catch {
        result.discord = false;
      }
    }

    if (channels.includes("slack") && slackChannel) {
      try {
        const response = await this.slack.postMessage({
          channel: slackChannel,
          text: input.title ? `*${input.title}*\n${input.message}` : input.message,
        });
        result.slack = response.isSuccess;
      } catch {
        result.slack = false;
      }
    }

    return result;
  }

  async syncToDatabase(input: {
    table: string;
    data: Record<string, unknown>;
    upsertKey?: string;
  }): Promise<APIResponse> {
    if (input.upsertKey && input.data[input.upsertKey] !== undefined) {
      const updateResponse = await this.supabase.update(
        input.table,
        input.data,
        { [input.upsertKey]: input.data[input.upsertKey] },
      );
      if (updateResponse.isSuccess) {
        return updateResponse;
      }
    }
    return this.supabase.insert(input.table, input.data);
  }

  async createIssueFromContext(input: {
    title: string;
    description: string;
    context?: Record<string, unknown>;
    priority?: number;
  }): Promise<APIResponse> {
    const contextBlock = Object.entries(input.context ?? {})
      .map(([key, value]) => `- ${key}: ${String(value)}`)
      .join("\n");
    const description = contextBlock
      ? `${input.description}\n\n---\nAgent context:\n${contextBlock}`
      : input.description;

    const query = `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier title url }
        }
      }
    `;
    return this.linear.graphql(query, {
      input: {
        title: input.title,
        description,
        priority: input.priority ?? 3,
      },
    });
  }
}
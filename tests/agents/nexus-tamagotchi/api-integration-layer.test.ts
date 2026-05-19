import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  APIIntegrationLayer,
  AuthMethod,
  BaseAPIClient,
  CircuitBreaker,
  RateLimiter,
  RateLimitPolicy,
  RetryStrategy,
  WebhookEventType,
  WebhookProcessor,
  type APIClientConfig,
} from "../../../src/agents/nexus-tamagotchi/api-integration-layer.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (!directory) {
      continue;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

class StubAPIClient extends BaseAPIClient {
  private responses: Array<
    | { statusCode: number; body?: Record<string, unknown> }
    | Error
  > = [];

  constructor(config: Partial<APIClientConfig> & { name: string; baseUrl: string }) {
    super(config);
  }

  queueResponses(
    responses: Array<{ statusCode: number; body?: Record<string, unknown> } | Error>,
  ): void {
    this.responses.push(...responses);
  }

  protected async performHttpRequest(_request: unknown): Promise<{
    statusCode: number;
    body?: unknown;
    headers?: Record<string, string>;
  }> {
    const next = this.responses.shift();
    if (!next) {
      return { statusCode: 200, body: { ok: true }, headers: {} };
    }
    if (next instanceof Error) {
      throw next;
    }
    return { statusCode: next.statusCode, body: next.body, headers: {} };
  }
}

describe("api-integration-layer", () => {
  it("supports token-bucket acquisition", async () => {
    const limiter = new RateLimiter({
      policy: RateLimitPolicy.TOKEN_BUCKET,
      requestsPerSecond: 1,
      requestsPerMinute: 60,
      requestsPerHour: 3600,
      burstLimit: 1,
      windowSizeSeconds: 60,
      adaptiveThreshold: 0.8,
    });
    const first = limiter.acquire();
    expect(first.success).toBe(true);
    const second = limiter.acquire();
    expect(second.success).toBe(false);
    const waited = await limiter.waitForToken(1, 1200);
    expect(waited).toBe(true);
  });

  it("opens circuit breaker after threshold", () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      successThreshold: 1,
      halfOpenTimeoutSeconds: 1,
      resetTimeoutSeconds: 1,
      windowSizeSeconds: 60,
      monitoredExceptions: ["Error"],
    });
    expect(breaker.canExecute().allowed).toBe(true);
    breaker.recordFailure("e1");
    breaker.recordFailure("e2");
    expect(breaker.canExecute().allowed).toBe(false);
  });

  it("retries failed requests and caches successful GETs", async () => {
    const client = new StubAPIClient({
      name: "stub",
      baseUrl: "https://example.com",
      auth: {
        method: AuthMethod.NONE,
        apiKeyHeader: "X-API-Key",
        jwtAlgorithm: "HS256",
      },
      retry: {
        strategy: RetryStrategy.LINEAR,
        maxRetries: 2,
        initialDelayMs: 1,
        maxDelayMs: 10,
        multiplier: 2,
        jitterFactor: 0,
        retryOnStatusCodes: [500],
        retryOnExceptions: ["Error"],
      },
    });

    client.queueResponses([
      { statusCode: 500, body: { error: "temporary" } },
      { statusCode: 200, body: { ok: true } },
    ]);
    const first = await client.get("/status");
    expect(first.isSuccess).toBe(true);
    expect(first.retryCount).toBe(1);

    const second = await client.get("/status");
    expect(second.isSuccess).toBe(true);
    expect(second.fromCache).toBe(true);
  });

  it("routes webhook events through registered handlers", async () => {
    const processor = new WebhookProcessor();
    let called = 0;
    processor.registerHandler({
      eventType: WebhookEventType.SYSTEM_ALERT,
      name: "alert-handler",
      handler: async () => {
        called += 1;
      },
      retryOnFailure: true,
      maxRetries: 1,
    });

    const result = await processor.processEvent({
      id: "evt-1",
      eventType: WebhookEventType.SYSTEM_ALERT,
      source: "test",
      payload: {},
      headers: {},
      signatureValid: false,
      processed: false,
      receivedAt: new Date().toISOString(),
    });

    expect(result.handlersSucceeded).toBe(1);
    expect(called).toBe(1);
  });

  it("reports integration-layer health with lazy clients", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-api-layer-"));
    tempDirs.push(storageDir);
    const layer = new APIIntegrationLayer(storageDir);
    const health = layer.getAllHealth();
    expect(health.overallStatus).toBe("healthy");
    const clients = health.clients as Record<string, { status: string }>;
    expect(clients.openai?.status).toBe("not_initialized");
  });
});
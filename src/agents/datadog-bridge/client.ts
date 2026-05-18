import type {
  DatadogApiResult,
  DatadogBridgeClient,
  DatadogBridgeConfig,
  DatadogDashboardSnapshot,
  DatadogHostSummary,
  DatadogHostsData,
  DatadogLogEvent,
  DatadogLogSearchData,
  DatadogMetricPoint,
  DatadogMetricQueryData,
  DatadogMetricSeries,
  DatadogMonitorSummary,
  DatadogMuteMonitorOptions,
  DatadogServiceDefinition,
  DatadogServiceDefinitionsData,
} from './types.js';

type JsonMap = Record<string, unknown>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 30_000;

function isJsonMap(value: unknown): value is JsonMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: JsonMap, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(source: JsonMap, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(source: JsonMap, key: string): boolean | undefined {
  const value = source[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readArray(source: JsonMap, key: string): unknown[] | undefined {
  const value = source[key];
  return Array.isArray(value) ? value : undefined;
}

function readObject(source: JsonMap, key: string): JsonMap | undefined {
  const value = source[key];
  return isJsonMap(value) ? value : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const output: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      output.push(item);
    }
  }
  return output;
}

function apiSuccess<T>(statusCode: number, data: T): DatadogApiResult<T> {
  return { ok: true, statusCode, data };
}

function apiFailure(
  statusCode: number,
  error: string,
  payload?: Record<string, unknown>,
): DatadogApiResult<never> {
  return { ok: false, statusCode, error, payload };
}

function parseMonitorSummary(value: unknown): DatadogMonitorSummary | null {
  if (!isJsonMap(value)) {
    return null;
  }
  const id = readNumber(value, 'id');
  const name = readString(value, 'name');
  const overallState = readString(value, 'overall_state');
  if (id === undefined || name === undefined || overallState === undefined) {
    return null;
  }
  return {
    id,
    name,
    overallState,
    message: readString(value, 'message'),
    tags: toStringArray(value.tags),
    raw: value,
  };
}

function parseMetricPoint(value: unknown): DatadogMetricPoint | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }
  const timestamp = value[0];
  const rawPointValue = value[1];
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return null;
  }
  if (rawPointValue !== null && typeof rawPointValue !== 'number') {
    return null;
  }
  return {
    timestamp,
    value: rawPointValue,
  };
}

function parseMetricSeries(value: unknown): DatadogMetricSeries | null {
  if (!isJsonMap(value)) {
    return null;
  }
  const pointlist = readArray(value, 'pointlist');
  if (!pointlist) {
    return null;
  }
  const points: DatadogMetricPoint[] = [];
  for (const point of pointlist) {
    const parsed = parseMetricPoint(point);
    if (parsed) {
      points.push(parsed);
    }
  }
  return {
    metric: readString(value, 'metric'),
    scope: readString(value, 'scope'),
    expression: readString(value, 'expression'),
    tags: toStringArray(value.tag_set),
    points,
    raw: value,
  };
}

function parseLogEvent(value: unknown): DatadogLogEvent | null {
  if (!isJsonMap(value)) {
    return null;
  }
  const id = readString(value, 'id');
  if (!id) {
    return null;
  }
  const attributes = readObject(value, 'attributes');
  return {
    id,
    timestamp: attributes ? readString(attributes, 'timestamp') : undefined,
    message: attributes ? readString(attributes, 'message') : undefined,
    service: attributes ? readString(attributes, 'service') : undefined,
    status: attributes ? readString(attributes, 'status') : undefined,
    tags: attributes ? toStringArray(attributes.tags) : [],
    raw: value,
  };
}

function parseHostSummary(value: unknown): DatadogHostSummary | null {
  if (!isJsonMap(value)) {
    return null;
  }
  const name = readString(value, 'host_name');
  if (!name) {
    return null;
  }
  const tagsBySource: Record<string, string[]> = {};
  const tagsRaw = readObject(value, 'tags_by_source');
  if (tagsRaw) {
    for (const [source, tags] of Object.entries(tagsRaw)) {
      tagsBySource[source] = toStringArray(tags);
    }
  }
  return {
    name,
    aliases: toStringArray(value.aliases),
    up: readBoolean(value, 'up'),
    lastReportedTime: readNumber(value, 'last_reported_time'),
    tagsBySource,
    raw: value,
  };
}

function parseServiceDefinition(value: unknown): DatadogServiceDefinition | null {
  if (!isJsonMap(value)) {
    return null;
  }
  const id = readString(value, 'id');
  if (!id) {
    return null;
  }
  const attributes = readObject(value, 'attributes');
  return {
    id,
    name: attributes ? readString(attributes, 'dd-service') : undefined,
    team: attributes ? readString(attributes, 'team') : undefined,
    languages: attributes ? toStringArray(attributes.languages) : [],
    raw: value,
  };
}

function extractErrorMessage(payload: unknown): string | undefined {
  if (!isJsonMap(payload)) {
    return undefined;
  }
  const direct = readString(payload, 'error');
  if (direct) {
    return direct;
  }
  const errors = payload.errors;
  if (Array.isArray(errors)) {
    const messages = errors.filter(
      (entry): entry is string => typeof entry === 'string',
    );
    if (messages.length > 0) {
      return messages.join('; ');
    }
  }
  return readString(payload, 'message');
}

export type DatadogApiClientOptions = {
  config: DatadogBridgeConfig;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

type HttpRequestOptions = {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
};

export class DatadogApiClient implements DatadogBridgeClient {
  private readonly config: DatadogBridgeConfig;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: DatadogApiClientOptions) {
    this.config = options.config;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;

    if (this.timeoutMs <= 0) {
      throw new Error('DatadogApiClient timeoutMs must be > 0');
    }
  }

  async fetchMonitorStatuses(): Promise<DatadogApiResult<DatadogMonitorSummary[]>> {
    const result = await this.request({
      method: 'GET',
      path: '/api/v1/monitor',
      query: {
        group_states: 'alert,warn,no_data,ok',
      },
    });
    if (!result.ok) {
      return result;
    }
    if (!Array.isArray(result.data)) {
      return apiFailure(
        result.statusCode,
        'Datadog monitor response shape mismatch',
        isJsonMap(result.data) ? result.data : undefined,
      );
    }

    const monitors: DatadogMonitorSummary[] = [];
    for (const item of result.data) {
      const parsed = parseMonitorSummary(item);
      if (parsed) {
        monitors.push(parsed);
      }
    }
    return apiSuccess(result.statusCode, monitors);
  }

  async queryMetric(
    query: string,
    from: number,
    to: number,
  ): Promise<DatadogApiResult<DatadogMetricQueryData>> {
    const result = await this.request({
      method: 'GET',
      path: '/api/v1/query',
      query: {
        query,
        from: String(from),
        to: String(to),
      },
    });
    if (!result.ok) {
      return result;
    }
    if (!isJsonMap(result.data)) {
      return apiFailure(result.statusCode, 'Datadog metric response is not an object');
    }
    const seriesRaw = readArray(result.data, 'series') ?? [];
    const series: DatadogMetricSeries[] = [];
    for (const value of seriesRaw) {
      const parsed = parseMetricSeries(value);
      if (parsed) {
        series.push(parsed);
      }
    }
    return apiSuccess(result.statusCode, {
      from: readNumber(result.data, 'from') ?? from,
      to: readNumber(result.data, 'to') ?? to,
      query: readString(result.data, 'query') ?? query,
      series,
      raw: result.data,
    });
  }

  async searchLogs(
    query: string,
    from: string,
    to: string,
  ): Promise<DatadogApiResult<DatadogLogSearchData>> {
    const body = {
      filter: {
        query,
        from,
        to,
      },
      sort: '-timestamp',
      page: {
        limit: 50,
      },
    };
    const result = await this.request({
      method: 'POST',
      path: '/api/v2/logs/events/search',
      body,
    });
    if (!result.ok) {
      return result;
    }
    if (!isJsonMap(result.data)) {
      return apiFailure(result.statusCode, 'Datadog logs response is not an object');
    }

    const eventsRaw = readArray(result.data, 'data') ?? [];
    const events: DatadogLogEvent[] = [];
    for (const eventRaw of eventsRaw) {
      const parsed = parseLogEvent(eventRaw);
      if (parsed) {
        events.push(parsed);
      }
    }

    return apiSuccess(result.statusCode, {
      events,
      raw: result.data,
    });
  }

  async listHosts(): Promise<DatadogApiResult<DatadogHostsData>> {
    const result = await this.request({
      method: 'GET',
      path: '/api/v1/hosts',
    });
    if (!result.ok) {
      return result;
    }
    if (!isJsonMap(result.data)) {
      return apiFailure(result.statusCode, 'Datadog hosts response is not an object');
    }

    const hostList = readArray(result.data, 'host_list') ?? [];
    const hosts: DatadogHostSummary[] = [];
    for (const hostRaw of hostList) {
      const parsed = parseHostSummary(hostRaw);
      if (parsed) {
        hosts.push(parsed);
      }
    }
    return apiSuccess(result.statusCode, {
      hosts,
      raw: result.data,
    });
  }

  async getMonitor(
    monitorId: number,
  ): Promise<DatadogApiResult<DatadogMonitorSummary>> {
    const result = await this.request({
      method: 'GET',
      path: `/api/v1/monitor/${monitorId}`,
    });
    if (!result.ok) {
      return result;
    }
    const monitor = parseMonitorSummary(result.data);
    if (!monitor) {
      return apiFailure(result.statusCode, 'Datadog monitor response shape mismatch');
    }
    return apiSuccess(result.statusCode, monitor);
  }

  async createMonitor(
    monitor: Record<string, unknown>,
  ): Promise<DatadogApiResult<DatadogMonitorSummary>> {
    const result = await this.request({
      method: 'POST',
      path: '/api/v1/monitor',
      body: monitor,
    });
    if (!result.ok) {
      return result;
    }
    const created = parseMonitorSummary(result.data);
    if (!created) {
      return apiFailure(result.statusCode, 'Datadog create monitor response mismatch');
    }
    return apiSuccess(result.statusCode, created);
  }

  async muteMonitor(
    monitorId: number,
    options: DatadogMuteMonitorOptions,
  ): Promise<DatadogApiResult<DatadogMonitorSummary>> {
    const result = await this.request({
      method: 'POST',
      path: `/api/v1/monitor/${monitorId}/mute`,
      body: options,
    });
    if (!result.ok) {
      return result;
    }
    const monitor = parseMonitorSummary(result.data);
    if (!monitor) {
      return apiFailure(result.statusCode, 'Datadog mute monitor response shape mismatch');
    }
    return apiSuccess(result.statusCode, monitor);
  }

  async snapshotDashboard(
    dashboardId: string,
  ): Promise<DatadogApiResult<DatadogDashboardSnapshot>> {
    const result = await this.request({
      method: 'GET',
      path: `/api/v1/dashboard/${dashboardId}`,
    });
    if (!result.ok) {
      return result;
    }
    if (!isJsonMap(result.data)) {
      return apiFailure(
        result.statusCode,
        'Datadog dashboard response shape mismatch',
      );
    }
    const dashboard = readObject(result.data, 'dashboard') ?? result.data;
    const id = readString(dashboard, 'id') ?? dashboardId;
    return apiSuccess(result.statusCode, {
      id,
      title: readString(dashboard, 'title'),
      description: readString(dashboard, 'description'),
      raw: dashboard,
    });
  }

  async listServices(): Promise<DatadogApiResult<DatadogServiceDefinitionsData>> {
    const result = await this.request({
      method: 'GET',
      path: '/api/v2/services/definitions',
    });
    if (!result.ok) {
      return result;
    }
    if (!isJsonMap(result.data)) {
      return apiFailure(
        result.statusCode,
        'Datadog services response shape mismatch',
      );
    }

    const servicesRaw = readArray(result.data, 'data') ?? [];
    const services: DatadogServiceDefinition[] = [];
    for (const serviceRaw of servicesRaw) {
      const parsed = parseServiceDefinition(serviceRaw);
      if (parsed) {
        services.push(parsed);
      }
    }
    return apiSuccess(result.statusCode, {
      services,
      raw: result.data,
    });
  }

  private async request(
    options: HttpRequestOptions,
  ): Promise<DatadogApiResult<unknown>> {
    const url = new URL(`https://${this.config.site}${options.path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: options.method,
        signal: controller.signal,
        headers: {
          'DD-API-KEY': this.config.apiKey,
          'DD-APPLICATION-KEY': this.config.appKey,
          'Content-Type': 'application/json',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const payload = await this.readPayload(response);
      if (!response.ok) {
        return apiFailure(
          response.status,
          extractErrorMessage(payload) ??
            `Datadog API request failed with status ${response.status}`,
          isJsonMap(payload) ? payload : undefined,
        );
      }
      return apiSuccess(response.status, payload);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return apiFailure(408, `Datadog request timed out after ${this.timeoutMs}ms`);
      }
      const message = err instanceof Error ? err.message : String(err);
      return apiFailure(500, `Datadog request failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readPayload(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return text.length > 0 ? { message: text } : {};
    }
    try {
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { message: `Invalid JSON payload: ${message}` };
    }
  }
}
import {
  isRecord,
  readNumber,
  readRecord,
  readString,
  readStringArray,
} from './codec.js';
import type {
  CIPipelineSubmission,
  DatadogBridgeConfig,
  DatadogEventSubmission,
  DowntimeResponse,
  DowntimeSpec,
  FindingsResponse,
  LogEntry,
  MetricResponse,
  MetricSeries,
  MetricSubmission,
  MonitorDefinition,
  MonitorResponse,
  MuteOptions,
  SecurityFinding,
  SecuritySignal,
  SecuritySignalResponse,
  SnapshotResponse,
} from './types.js';

type HttpMethod = 'GET' | 'POST';

type RequestOptions = {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

type DatadogClientOptions = {
  config: Pick<DatadogBridgeConfig, 'apiKey' | 'appKey' | 'site'>;
  fetchImpl?: typeof fetch;
  logger?: Pick<Console, 'warn'>;
};

function normalizeSeverity(value: unknown): SecuritySignal['severity'] {
  if (value === 'critical') {
    return 'critical';
  }
  if (value === 'high') {
    return 'high';
  }
  if (value === 'medium') {
    return 'medium';
  }
  if (value === 'low') {
    return 'low';
  }
  return 'info';
}

function normalizeFindingType(value: unknown): SecurityFinding['findingType'] {
  if (value === 'misconfiguration') {
    return 'misconfiguration';
  }
  if (value === 'secret') {
    return 'secret';
  }
  if (value === 'identity_risk') {
    return 'identity_risk';
  }
  return 'vulnerability';
}

function parseSecuritySignals(payload: unknown): SecuritySignalResponse {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return { signals: [] };
  }

  const signals = payload.data
    .map((row) => {
      if (!isRecord(row) || typeof row.id !== 'string') {
        return null;
      }
      const attributes = isRecord(row.attributes) ? row.attributes : {};
      const rule = readString(attributes.rule_name, 'rule_name');
      return {
        id: row.id,
        severity: normalizeSeverity(attributes.severity),
        rule,
        attributes,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return { signals };
}

function parseSecurityFindings(payload: unknown): FindingsResponse {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return { findings: [] };
  }

  const findings = payload.data
    .map((row) => {
      if (!isRecord(row) || typeof row.id !== 'string') {
        return null;
      }
      const attributes = isRecord(row.attributes) ? row.attributes : {};
      return {
        id: row.id,
        findingType: normalizeFindingType(attributes.finding_type),
        severity: normalizeSeverity(attributes.severity),
        resource: readString(attributes.resource_name, 'resource_name'),
        remediation: readString(attributes.remediation, 'remediation'),
        attributes,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return { findings };
}

function parseMetricSeries(entry: unknown): MetricSeries | null {
  if (!isRecord(entry)) {
    return null;
  }
  const metric = readString(entry.metric, 'metric') ?? 'unknown.metric';
  const tags = readStringArray(entry.tag_set, 'tag_set') ?? [];
  const pointsRaw = Array.isArray(entry.pointlist) ? entry.pointlist : [];
  const points = pointsRaw
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) {
        return null;
      }
      const timestamp = readNumber(point[0], 'point[0]');
      const value = readNumber(point[1], 'point[1]');
      if (timestamp === undefined || value === undefined) {
        return null;
      }
      return { timestamp, value };
    })
    .filter((point): point is NonNullable<typeof point> => point !== null);

  return { metric, tags, points };
}

function parseMetricResponse(payload: unknown, from: number, to: number): MetricResponse {
  if (!isRecord(payload)) {
    return { from, to, series: [] };
  }

  const responseFrom = readNumber(payload.from_date, 'from_date') ?? from;
  const responseTo = readNumber(payload.to_date, 'to_date') ?? to;
  const seriesRaw = Array.isArray(payload.series) ? payload.series : [];
  const series = seriesRaw
    .map((entry) => parseMetricSeries(entry))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return {
    from: responseFrom,
    to: responseTo,
    series,
  };
}

function parseMonitorResponse(payload: unknown, definition: MonitorDefinition): MonitorResponse {
  if (!isRecord(payload)) {
    return {
      id: 0,
      name: definition.name,
      type: definition.type,
      query: definition.query,
    };
  }

  return {
    id: readNumber(payload.id, 'id') ?? 0,
    name: readString(payload.name, 'name') ?? definition.name,
    type: readString(payload.type, 'type') ?? definition.type,
    query: readString(payload.query, 'query') ?? definition.query,
  };
}

function parseDowntimeResponse(payload: unknown, spec: DowntimeSpec): DowntimeResponse {
  if (!isRecord(payload)) {
    return {
      id: '',
      scope: spec.scope,
      startTs: spec.startTs,
      endTs: spec.endTs,
    };
  }

  const data = isRecord(payload.data) ? payload.data : payload;
  return {
    id: readString(data.id, 'id') ?? '',
    scope: readString(data.scope, 'scope') ?? spec.scope,
    startTs: readNumber(data.start, 'start') ?? spec.startTs,
    endTs: readNumber(data.end, 'end') ?? spec.endTs,
  };
}

function parseSnapshotResponse(payload: unknown): SnapshotResponse {
  if (!isRecord(payload)) {
    return { snapshotUrl: '' };
  }
  return {
    snapshotUrl: readString(payload.snapshot_url, 'snapshot_url') ?? '',
  };
}

export class DatadogBridgeClient {
  private readonly fetchImpl: typeof fetch;
  private readonly apiKey: string;
  private readonly appKey: string;
  private readonly site: string;
  private readonly logger: Pick<Console, 'warn'>;

  constructor(options: DatadogClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiKey = options.config.apiKey;
    this.appKey = options.config.appKey;
    this.site = options.config.site;
    this.logger = options.logger ?? console;
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const url = new URL(`https://${this.site}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) {
          continue;
        }
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async request(options: RequestOptions): Promise<unknown> {
    const response = await this.fetchImpl(this.buildUrl(options.path, options.query), {
      method: options.method,
      headers: {
        'content-type': 'application/json',
        'DD-API-KEY': this.apiKey,
        'DD-APPLICATION-KEY': this.appKey,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Datadog request failed (${response.status} ${response.statusText}): ${text}`,
      );
    }

    if (response.status === 204) {
      return {};
    }

    const text = await response.text();
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch (err) {
      this.logger.warn(
        `[datadog-bridge] non-JSON response for ${options.path}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return {};
    }
  }

  async searchSecuritySignals(
    query: string,
    from: string,
    to: string,
  ): Promise<SecuritySignalResponse> {
    const payload = await this.request({
      method: 'POST',
      path: '/api/v2/security_monitoring/signals/search',
      body: {
        filter: {
          query,
          from,
          to,
        },
      },
    });
    return parseSecuritySignals(payload);
  }

  async getSecurityFindings(filter = '@status:open'): Promise<FindingsResponse> {
    const payload = await this.request({
      method: 'POST',
      path: '/api/v2/security_monitoring/findings/search',
      body: {
        filter: {
          query: filter,
        },
      },
    });
    return parseSecurityFindings(payload);
  }

  async queryMetricTimeseries(
    query: string,
    from: number,
    to: number,
  ): Promise<MetricResponse> {
    const payload = await this.request({
      method: 'GET',
      path: '/api/v1/query',
      query: {
        from,
        to,
        query,
      },
    });
    return parseMetricResponse(payload, from, to);
  }

  async muteMonitor(id: number, options?: MuteOptions): Promise<void> {
    await this.request({
      method: 'POST',
      path: `/api/v1/monitor/${id}/mute`,
      body: {
        scope: options?.scope,
        end: options?.endTs,
      },
    });
  }

  async createMonitor(definition: MonitorDefinition): Promise<MonitorResponse> {
    const payload = await this.request({
      method: 'POST',
      path: '/api/v1/monitor',
      body: definition,
    });
    return parseMonitorResponse(payload, definition);
  }

  async createDowntime(spec: DowntimeSpec): Promise<DowntimeResponse> {
    const body: Record<string, unknown> = {
      data: {
        type: 'downtime',
        attributes: {
          scope: spec.scope,
          monitor_tags: spec.monitorTags ?? [],
          message: spec.message ?? '',
          schedule: {
            start: new Date(spec.startTs * 1000).toISOString(),
            end: new Date(spec.endTs * 1000).toISOString(),
          },
        },
      },
    };

    const payload = await this.request({
      method: 'POST',
      path: '/api/v2/downtime',
      body,
    });
    return parseDowntimeResponse(payload, spec);
  }

  async snapshotDashboard(
    dashboardId: string,
    timeframe: string,
  ): Promise<SnapshotResponse> {
    const payload = await this.request({
      method: 'GET',
      path: '/api/v1/graph/snapshot',
      query: {
        dashboard_id: dashboardId,
        timeframe,
      },
    });
    return parseSnapshotResponse(payload);
  }

  async submitEvent(event: DatadogEventSubmission): Promise<void> {
    await this.request({
      method: 'POST',
      path: '/api/v1/events',
      body: {
        title: event.title,
        text: event.text ?? '',
        tags: event.tags ?? [],
        date_happened: event.dateHappened,
      },
    });
  }

  async submitLogs(logs: LogEntry[]): Promise<void> {
    await this.request({
      method: 'POST',
      path: '/api/v2/logs',
      body: logs.map((entry) => ({
        message: entry.message,
        service: entry.service,
        ddsource: entry.ddsource,
        ddtags: entry.ddtags,
        timestamp: entry.timestamp,
        ...entry.attributes,
      })),
    });
  }

  async submitMetrics(metrics: MetricSubmission[]): Promise<void> {
    await this.request({
      method: 'POST',
      path: '/api/v1/series',
      body: {
        series: metrics.map((metric) => ({
          metric: metric.metric,
          type: metric.type,
          points: metric.points.map((point) => [point.timestamp, point.value]),
          tags: metric.tags ?? [],
        })),
      },
    });
  }

  async submitCIPipelineEvent(pipeline: CIPipelineSubmission): Promise<void> {
    await this.request({
      method: 'POST',
      path: '/api/v2/ci/pipeline-events',
      body: {
        data: {
          type: 'pipeline_event',
          attributes: {
            pipeline_id: pipeline.pipelineId,
            status: pipeline.status,
            ref: pipeline.ref,
            duration_seconds: pipeline.durationSeconds,
            project: pipeline.project,
            tags: pipeline.tags ?? [],
          },
        },
      },
    });
  }
}
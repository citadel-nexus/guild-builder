export type DatadogBridgeConfig = {
  apiKey: string;
  appKey: string;
  site: string;
  natsUrl: string;
  subjectPrefix: string;
  pollIntervalMs: number;
};

export type DatadogEventKind =
  | 'monitor.alert'
  | 'monitor.warn'
  | 'monitor.ok'
  | 'monitor.nodata'
  | 'host.up'
  | 'host.down'
  | 'metric.anomaly'
  | 'metric.threshold'
  | 'log.pattern'
  | 'log.spike'
  | 'deployment.detected'
  | 'agent.heartbeat';

export type DatadogSeverity = 'critical' | 'warning' | 'info' | 'ok';

export type DatadogEvent = {
  kind: DatadogEventKind;
  source: string;
  title: string;
  detail?: string;
  tags: Record<string, string>;
  severity: DatadogSeverity;
  timestamp: string;
  raw?: Record<string, unknown>;
};

export type DatadogCommandAction =
  | 'query.metric'
  | 'query.logs'
  | 'query.monitors'
  | 'create.monitor'
  | 'mute.monitor'
  | 'snapshot.dashboard'
  | 'list.services';

export type DatadogCommand = {
  action: DatadogCommandAction;
  requestId: string;
  params: Record<string, unknown>;
  replySubject?: string;
};

export type DatadogCommandResult = {
  requestId: string;
  status: 'ok' | 'error';
  data?: Record<string, unknown>;
  error?: string;
  durationMs: number;
};

export type DatadogApiResult<T> =
  | {
      ok: true;
      statusCode: number;
      data: T;
    }
  | {
      ok: false;
      statusCode: number;
      error: string;
      payload?: Record<string, unknown>;
    };

export type DatadogMonitorSummary = {
  id: number;
  name: string;
  overallState: string;
  message?: string;
  tags: string[];
  raw: Record<string, unknown>;
};

export type DatadogMetricPoint = {
  timestamp: number;
  value: number | null;
};

export type DatadogMetricSeries = {
  metric?: string;
  scope?: string;
  expression?: string;
  tags: string[];
  points: DatadogMetricPoint[];
  raw: Record<string, unknown>;
};

export type DatadogMetricQueryData = {
  from: number;
  to: number;
  query: string;
  series: DatadogMetricSeries[];
  raw: Record<string, unknown>;
};

export type DatadogLogEvent = {
  id: string;
  timestamp?: string;
  message?: string;
  service?: string;
  status?: string;
  tags: string[];
  raw: Record<string, unknown>;
};

export type DatadogLogSearchData = {
  events: DatadogLogEvent[];
  raw: Record<string, unknown>;
};

export type DatadogHostSummary = {
  name: string;
  aliases: string[];
  up?: boolean;
  lastReportedTime?: number;
  tagsBySource: Record<string, string[]>;
  raw: Record<string, unknown>;
};

export type DatadogHostsData = {
  hosts: DatadogHostSummary[];
  raw: Record<string, unknown>;
};

export type DatadogMuteMonitorOptions = {
  end?: number;
  scope?: string[];
  override?: boolean;
  [key: string]: unknown;
};

export type DatadogServiceDefinition = {
  id: string;
  name?: string;
  team?: string;
  languages: string[];
  raw: Record<string, unknown>;
};

export type DatadogServiceDefinitionsData = {
  services: DatadogServiceDefinition[];
  raw: Record<string, unknown>;
};

export type DatadogDashboardSnapshot = {
  id: string;
  title?: string;
  description?: string;
  raw: Record<string, unknown>;
};

export type DatadogNatsMessage = {
  subject: string;
  data: Uint8Array;
  reply?: string;
};

export type DatadogNatsSubscription = AsyncIterable<DatadogNatsMessage> & {
  unsubscribe: () => void;
};

export type DatadogNatsClient = {
  subscribe: (subject: string) => DatadogNatsSubscription;
  publish: (subject: string, data: Uint8Array) => void;
};

export type DatadogBridgeClient = {
  fetchMonitorStatuses: () => Promise<DatadogApiResult<DatadogMonitorSummary[]>>;
  queryMetric: (
    query: string,
    from: number,
    to: number,
  ) => Promise<DatadogApiResult<DatadogMetricQueryData>>;
  searchLogs: (
    query: string,
    from: string,
    to: string,
  ) => Promise<DatadogApiResult<DatadogLogSearchData>>;
  listHosts: () => Promise<DatadogApiResult<DatadogHostsData>>;
  getMonitor: (
    monitorId: number,
  ) => Promise<DatadogApiResult<DatadogMonitorSummary>>;
  createMonitor: (
    monitor: Record<string, unknown>,
  ) => Promise<DatadogApiResult<DatadogMonitorSummary>>;
  muteMonitor: (
    monitorId: number,
    options: DatadogMuteMonitorOptions,
  ) => Promise<DatadogApiResult<DatadogMonitorSummary>>;
  snapshotDashboard: (
    dashboardId: string,
  ) => Promise<DatadogApiResult<DatadogDashboardSnapshot>>;
  listServices: () => Promise<DatadogApiResult<DatadogServiceDefinitionsData>>;
};
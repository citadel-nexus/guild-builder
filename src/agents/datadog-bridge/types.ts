export type JsonRecord = Record<string, unknown>;

export type Watcher = {
  name: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
};

export type Integration = {
  name: string;
  inboundSubject: string;
  handle: (payload: Record<string, unknown>) => Promise<void>;
};

export type DatadogBridgeConfig = {
  apiKey: string;
  appKey: string;
  site: string;
  natsUrl: string;
  subjectPrefix: string;
  pollIntervalMs: number;
  securityEnabled: boolean;
  llmEnabled: boolean;
  automationEnabled: boolean;
  integrationsEnabled: boolean;
  debug: boolean;
};

export type DatadogBridgeBootstrapConfig = DatadogBridgeConfig & {
  bridgeEnabled: boolean;
  natsToken?: string;
  llmLatencyThresholdMs: number;
  llmErrorRateThreshold: number;
  llmThroughputDropRatio: number;
  llmPromptTokenCostUsd: number;
  llmCompletionTokenCostUsd: number;
  llmModel?: string;
  llmApplication?: string;
};

export type DatadogEvent = {
  kind: string;
  timestamp: string;
  source: string;
  title?: string;
  message?: string;
  monitorId?: number;
  requestId?: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
};

export type DatadogCommandAction =
  | 'query.metric'
  | 'security.signals'
  | 'security.findings'
  | 'automation.mute'
  | 'automation.create-monitor'
  | 'automation.snapshot'
  | 'automation.downtime';

export type DatadogCommand = {
  requestId: string;
  action: DatadogCommandAction;
  payload?: Record<string, unknown>;
  replyTo?: string;
  timestamp?: string;
};

export type SecuritySignal = DatadogEvent & {
  kind: 'security.signal';
  id: string;
  rule?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  attributes?: Record<string, unknown>;
};

export type SecurityFinding = DatadogEvent & {
  kind: 'security.finding';
  id: string;
  findingType: 'vulnerability' | 'misconfiguration' | 'secret' | 'identity_risk';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  resource?: string;
  remediation?: string;
};

export type PostureSummary = {
  timestamp: string;
  totalFindings: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  score?: number;
};

export type LlmTraceEvent = DatadogEvent & {
  kind: 'llm.trace' | 'llm.error' | 'llm.latency';
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  mlApp?: string;
};

export type CostEvent = {
  timestamp: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  mlApp?: string;
};

export type MuteCommand = {
  monitorId: number;
  scope?: string;
  endTs?: number;
  reason?: string;
  requestId?: string;
  replyTo?: string;
};

export type CreateMonitorCommand = {
  name: string;
  type: string;
  query: string;
  message?: string;
  tags?: string[];
  thresholds?: Record<string, number>;
  requestId?: string;
  replyTo?: string;
};

export type DowntimeCommand = {
  scope: string;
  startTs: number;
  endTs: number;
  message?: string;
  monitorTags?: string[];
  requestId?: string;
  replyTo?: string;
};

export type SnapshotCommand = {
  dashboardId: string;
  timeframe: string;
  requestId?: string;
  replyTo?: string;
};

export type PostHogInboundEvent = {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
};

export type CustomerIoWebhook = {
  event_type: string;
  campaign_id?: number;
  customer_id?: string;
  template_id?: number;
  timestamp: number;
};

export type GitLabPipelineEvent = {
  pipelineId: number;
  status: string;
  ref: string;
  duration?: number;
  stages?: string[];
  project?: string;
};

export type StripePaymentEvent = {
  eventType: string;
  amount: number;
  currency: string;
  customerId?: string;
  plan?: string;
  timestamp: string;
};

export type HeartbeatEvent = {
  agent: string;
  timestamp: string;
  uptime: number;
  watchers: Array<{ name: string; running: boolean; lastPoll?: string }>;
  pollCount: number;
  errorCount: number;
};

export type NatsLikeMessage = {
  subject: string;
  data: Uint8Array;
  respond?: (data: Uint8Array) => void;
};

export type NatsLikeSubscription = AsyncIterable<NatsLikeMessage> & {
  unsubscribe: () => void;
};

export type NatsLikeConnection = {
  publish: (subject: string, data: Uint8Array) => void;
  subscribe: (subject: string) => NatsLikeSubscription;
  drain?: () => Promise<void>;
  close?: () => void | Promise<void>;
};

export type SecuritySignalRecord = {
  id: string;
  severity: SecuritySignal['severity'];
  rule?: string;
  attributes: Record<string, unknown>;
};

export type SecurityFindingRecord = {
  id: string;
  findingType: SecurityFinding['findingType'];
  severity: SecurityFinding['severity'];
  resource?: string;
  remediation?: string;
  attributes: Record<string, unknown>;
};

export type SecuritySignalResponse = {
  signals: SecuritySignalRecord[];
};

export type FindingsResponse = {
  findings: SecurityFindingRecord[];
};

export type MetricPoint = {
  timestamp: number;
  value: number;
};

export type MetricSeries = {
  metric: string;
  tags: string[];
  points: MetricPoint[];
};

export type MetricResponse = {
  from: number;
  to: number;
  series: MetricSeries[];
};

export type MuteOptions = {
  scope?: string;
  endTs?: number;
};

export type MonitorDefinition = {
  name: string;
  type: string;
  query: string;
  message?: string;
  tags?: string[];
  thresholds?: Record<string, number>;
};

export type MonitorResponse = {
  id: number;
  name: string;
  type: string;
  query: string;
};

export type DowntimeSpec = {
  scope: string;
  startTs: number;
  endTs: number;
  message?: string;
  monitorTags?: string[];
};

export type DowntimeResponse = {
  id: string;
  scope: string;
  startTs: number;
  endTs: number;
};

export type SnapshotResponse = {
  snapshotUrl: string;
};

export type DatadogEventSubmission = {
  title: string;
  text?: string;
  tags?: string[];
  dateHappened?: number;
};

export type LogEntry = {
  message: string;
  service: string;
  ddsource: string;
  ddtags?: string;
  timestamp?: string;
  attributes?: Record<string, unknown>;
};

export type MetricSubmission = {
  metric: string;
  type: 'gauge' | 'count';
  points: Array<{ timestamp: number; value: number }>;
  tags?: string[];
};

export type CIPipelineSubmission = {
  pipelineId: number;
  status: string;
  ref: string;
  durationSeconds?: number;
  project?: string;
  tags?: string[];
};

export type DatadogBridgeSubjects = {
  monitorAlert: string;
  monitorWarn: string;
  monitorOk: string;
  monitorNodata: string;
  heartbeat: string;
  securitySignal: string;
  securityFinding: string;
  securityPosture: string;
  llmTrace: string;
  llmError: string;
  llmCost: string;
  llmLatency: string;
  commandWildcard: string;
  automationMute: string;
  automationCreateMonitor: string;
  automationSnapshot: string;
  automationDowntime: string;
  automationResultPrefix: string;
  integrationPosthogEvent: string;
  integrationCustomerIoWebhook: string;
  integrationGitLabPipeline: string;
  integrationStripePayment: string;
};
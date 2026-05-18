export type DatadogMonitorStatusToken = 'alert' | 'warn' | 'ok' | 'nodata';

export type DatadogBridgeSubjects = {
  commandWildcard: string;
  heartbeat: string;
  resultPrefix: string;
  monitor: Record<DatadogMonitorStatusToken, string>;
};

export function makeDatadogBridgeSubjects(prefix: string): DatadogBridgeSubjects {
  return {
    commandWildcard: `${prefix}.command.>`,
    heartbeat: `${prefix}.heartbeat`,
    resultPrefix: `${prefix}.result`,
    monitor: {
      alert: `${prefix}.monitor.alert`,
      warn: `${prefix}.monitor.warn`,
      ok: `${prefix}.monitor.ok`,
      nodata: `${prefix}.monitor.nodata`,
    },
  };
}

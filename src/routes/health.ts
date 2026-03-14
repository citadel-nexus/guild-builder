type HealthCheckOptions = {
  guild?: string;
  natsPrefix?: string;
};

export function healthCheck(options: HealthCheckOptions = {}) {
  return {
    guild: options.guild || 'builder',
    status: 'healthy',
    version: '0.1.0',
    nats_prefix: options.natsPrefix || 'citadel.builder.*',
    timestamp: new Date().toISOString(),
  };
}

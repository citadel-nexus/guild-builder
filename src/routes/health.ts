export function healthCheck() {
  return {
    guild: 'builder',
    status: 'healthy',
    version: '0.1.0',
    nats_prefix: 'citadel.builder.*',
    timestamp: new Date().toISOString(),
  };
}

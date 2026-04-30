/**
 * Subject formatter for ProvisionEvent → NATS subject mapping.
 *
 * Subjects are NEVER hardcoded — the prefix arrives from configuration
 * (env / orchestrator wiring). The default formatter matches the pattern
 * laid out in dispatch §6.F.1 and §A.5:
 *
 *   {prefix}.{tenantId}.provision.started
 *   {prefix}.{tenantId}.provision.{stage}.started
 *   {prefix}.{tenantId}.provision.{stage}.done
 *   {prefix}.{tenantId}.provision.{stage}.failed
 *   {prefix}.{tenantId}.provision.complete
 *   {prefix}.{tenantId}.provision.failed
 *
 * Override the formatter when wiring the bridge to use a different
 * subject convention.
 */
import type { ProvisionEvent } from './types.js';

export type SubjectFormatter = (event: ProvisionEvent, prefix: string) => string;

export const defaultSubjectFormatter: SubjectFormatter = (event, prefix) => {
  const base = `${prefix}.${event.tenantId}.provision`;
  switch (event.kind) {
    case 'started':
      return `${base}.started`;
    case 'complete':
      return `${base}.complete`;
    case 'failed':
      return `${base}.failed`;
    case 'stage.started':
      return `${base}.${event.stage}.started`;
    case 'stage.done':
      return `${base}.${event.stage}.done`;
    case 'stage.failed':
      return `${base}.${event.stage}.failed`;
  }
};

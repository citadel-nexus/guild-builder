/**
 * Default stage registry for TENANT-PROVISION-FABRIC-001.
 *
 * Each entry is a stub that returns status: 'stub' so the orchestrator
 * can be exercised end-to-end in this repo without depending on
 * Cal.com / Mautic / Twenty / Customer.io / Stalwart / Stripe / etc.
 *
 * Concrete implementations live in their own service repos and replace
 * these stubs by passing a custom stage list into ProvisionOrchestrator.
 *
 * Order matches dispatch §6.F.1.
 */
import type { Stage, TenantContext } from '../types.js';

export const DEFAULT_STAGE_NAMES = [
  'calcom',
  'mautic',
  'twenty',
  'customer_io',
  'email_bank',
  'tenant_agent',
  'tenant_mcp',
  'cockpit_ui',
  'workflow_mesh',
] as const;

export type DefaultStageName = (typeof DEFAULT_STAGE_NAMES)[number];

export function makeStubStage(name: string): Stage {
  return {
    name,
    run: async (ctx: TenantContext) => ({
      status: 'stub',
      detail: `${name} stub — replace with concrete provisioner for tenant=${ctx.tenantId}`,
      data: { tenantId: ctx.tenantId, industry: ctx.industry, tier: ctx.tier },
    }),
  };
}

export function defaultStageRegistry(): Stage[] {
  return DEFAULT_STAGE_NAMES.map((name) => makeStubStage(name));
}

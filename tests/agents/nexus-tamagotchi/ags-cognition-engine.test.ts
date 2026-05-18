import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AGSBaseIntegrationClient,
  AGSIntegrationCategory,
  AGSIntegrationConfig,
  AGSIntegrationOrchestrator,
  AGSIntegrationRegistry,
  AGSIntegrationStatus,
  AGSSystemConfig,
  AGSSystemFactory,
  EgressFormat,
  SapientPacketType,
} from "../../../src/agents/nexus-tamagotchi/ags-cognition-engine.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeStorageDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nexus-ags-"));
  tempDirs.push(dir);
  return dir;
}

class DummyIntegrationClient extends AGSBaseIntegrationClient {
  constructor(name: string) {
    super({
      name,
      category: AGSIntegrationCategory.ANALYTICS,
      config: new AGSIntegrationConfig({ enabled: true, retryCount: 1 }),
    });
  }

  protected async executeRequest(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    return {
      ok: true,
      operation,
      params,
    };
  }

  async healthCheck() {
    return {
      ...this.getHealth(),
      status: AGSIntegrationStatus.HEALTHY,
    };
  }
}

describe("ags-cognition-engine", () => {
  it("processes query packets through the full AGS system", async () => {
    const config = new AGSSystemConfig({
      storageDir: makeStorageDir(),
      egressFormat: EgressFormat.MARKDOWN,
      maxQueueSize: 50,
      maxOutcomes: 100,
    });
    const system = AGSSystemFactory.create({ config });

    const result = await system.process(
      "Explain AGS governance routing behavior",
      {
        packetType: SapientPacketType.QUERY,
        context: { scope: "test" },
      },
    );

    expect(result.packetId).toBeDefined();
    expect(typeof result.status).toBe("string");

    const stats = system.getStats() as {
      processedCount: number;
      outcomes: { total: number };
    };
    expect(stats.processedCount).toBe(1);
    expect(stats.outcomes.total).toBe(1);
  });

  it("supports learning cycle and integration orchestration", async () => {
    const config = new AGSSystemConfig({
      storageDir: makeStorageDir(),
      egressFormat: EgressFormat.JSON,
    });
    const system = AGSSystemFactory.create({ config });

    const first = await system.process("Run emergency response simulation", {
      packetType: SapientPacketType.EMERGENCY,
      severity: "critical",
    });
    expect(first.packetId).toBeDefined();

    const feedbackOk = system.addFeedback(
      first.packetId as string,
      0.75,
      "Good response",
    );
    expect(feedbackOk).toBe(true);

    const learning = await system.runLearningCycle();
    expect(learning).toHaveProperty("signalsDetected");

    const registry = new AGSIntegrationRegistry();
    registry.register(new DummyIntegrationClient("analytics-edge"));
    const orchestrator = new AGSIntegrationOrchestrator({ registry });
    orchestrator.defineWorkflow("sync", [
      {
        integration: "analytics-edge",
        operation: "emit",
        params: {
          packet_id: "${packetId}",
        },
        onError: "abort",
      },
    ]);

    const execution = await orchestrator.executeWorkflow("sync", {
      packetId: first.packetId,
    });
    expect(execution.success).toBe(true);
  });
});

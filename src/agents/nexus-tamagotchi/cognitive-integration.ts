import { randomUUID } from "node:crypto";

import { AgentAnalytics, AutomationEngine } from "./analytics-automation.js";
import { ContextRehydrator } from "./context-rehydration.js";
import { DomainLearningEngine } from "./domain-learning.js";
import { LongTermMemory } from "./long-term-memory.js";
import { MemoryGraphRenderer } from "./memory-graph.js";
import { SelfAwarenessModule } from "./self-awareness.js";
import { ShortTermMemoryBuffer } from "./short-term-memory.js";
import { ResponseLengthConfig } from "./ui-system.js";
import { WorkshopIntegration } from "./workshop.js";

export type IntegratedCognitiveSystems = {
  stm?: ShortTermMemoryBuffer;
  ltm?: LongTermMemory;
  learningEngine?: DomainLearningEngine;
  rehydrator?: ContextRehydrator;
  selfAwareness?: SelfAwarenessModule;
  memoryRenderer?: MemoryGraphRenderer;
  workshop?: WorkshopIntegration;
  analytics?: AgentAnalytics;
  automation?: AutomationEngine;
  responseConfig?: ResponseLengthConfig;
};

export type CognitiveIntegratedAgent = {
  agentId?: string;
  agentName?: string;
  stm?: ShortTermMemoryBuffer;
  ltm?: LongTermMemory;
  learningEngine?: DomainLearningEngine;
  contextRehydrator?: ContextRehydrator;
  selfAwareness?: SelfAwarenessModule;
  memoryRenderer?: MemoryGraphRenderer;
  workshopIntegration?: WorkshopIntegration;
  analytics?: AgentAnalytics;
  automation?: AutomationEngine;
  responseConfig?: ResponseLengthConfig;
};

export function integrateCognitiveSystems(
  agent: CognitiveIntegratedAgent,
  options: {
    storageRoot?: string;
    workshopUrl?: string;
    workshopApiKey?: string;
  } = {},
): IntegratedCognitiveSystems {
  const systems: IntegratedCognitiveSystems = {};
  const agentName = agent.agentName ?? "NexusAgent";
  const agentId = agent.agentId ?? randomUUID();

  try {
    const stm = new ShortTermMemoryBuffer(
      options.storageRoot
        ? { storagePath: `${options.storageRoot}/stm/stm_buffer.jsonl` }
        : {},
    );
    agent.stm = stm;
    systems.stm = stm;
  } catch {
    systems.stm = undefined;
  }

  try {
    const ltm = new LongTermMemory(
      options.storageRoot ? { storageDir: `${options.storageRoot}/ltm` } : {},
    );
    agent.ltm = ltm;
    systems.ltm = ltm;
  } catch {
    systems.ltm = undefined;
  }

  try {
    const learningEngine = new DomainLearningEngine(
      options.storageRoot
        ? {
            storageDir: `${options.storageRoot}/learning`,
            ltm: systems.ltm,
          }
        : {
            ltm: systems.ltm,
          },
    );
    agent.learningEngine = learningEngine;
    systems.learningEngine = learningEngine;
  } catch {
    systems.learningEngine = undefined;
  }

  if (systems.stm && systems.ltm) {
    const rehydrator = new ContextRehydrator(
      systems.stm,
      systems.ltm,
      systems.learningEngine,
      options.storageRoot ? `${options.storageRoot}/sessions` : undefined,
    );
    agent.contextRehydrator = rehydrator;
    systems.rehydrator = rehydrator;
  }

  const selfAwareness = new SelfAwarenessModule({
    agentId,
    agentName,
    stm: systems.stm,
    ltm: systems.ltm,
    learningEngine: systems.learningEngine,
  });
  agent.selfAwareness = selfAwareness;
  systems.selfAwareness = selfAwareness;

  if (systems.ltm) {
    const memoryRenderer = new MemoryGraphRenderer(systems.ltm, systems.stm);
    agent.memoryRenderer = memoryRenderer;
    systems.memoryRenderer = memoryRenderer;
  }

  const workshop = new WorkshopIntegration(agent, {
    workshopUrl: options.workshopUrl,
    apiKey: options.workshopApiKey,
  });
  agent.workshopIntegration = workshop;
  systems.workshop = workshop;

  const analytics = new AgentAnalytics({
    agentId,
    agentName,
  });
  agent.analytics = analytics;
  systems.analytics = analytics;

  const automation = new AutomationEngine(agent);
  agent.automation = automation;
  systems.automation = automation;

  const responseConfig = new ResponseLengthConfig("balanced");
  agent.responseConfig = responseConfig;
  systems.responseConfig = responseConfig;

  return systems;
}

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  EventLogger,
  EventType,
} from "../../../src/agents/nexus-tamagotchi/event-logging.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (!directory) {
      continue;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("event-logging", () => {
  it("logs events and supports filtered queries", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-events-"));
    tempDirs.push(storageDir);
    const logger = new EventLogger({
      storageDir,
      now: () => new Date("2026-01-14T00:00:00.000Z"),
    });

    logger.log(EventType.AGENT_START, { message: "Boot" });
    logger.logInteractionStart("i-1", "hello");
    logger.logInteractionEnd("i-1", 128, 42, 5);
    logger.logError("broken");

    const interactionEvents = logger.query({
      eventTypes: [EventType.INTERACTION_START, EventType.INTERACTION_END],
    });
    expect(interactionEvents.length).toBe(2);
    expect(interactionEvents[0]?.eventType).toBe(EventType.INTERACTION_END);

    const errors = logger.query({ level: "error" });
    expect(errors.length).toBe(1);
    expect(errors[0]?.success).toBe(false);

    const stats = logger.getStats();
    expect(stats.totalEntries).toBe(4);
    expect((stats.byType as Record<string, number>)[EventType.AGENT_START]).toBe(1);
  });
});

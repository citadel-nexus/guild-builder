import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ExtendedProfessorNetwork,
  ProfessorSpecialty,
} from "../../../src/agents/nexus-tamagotchi/extended-professor-network.js";

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

describe("extended-professor-network", () => {
  it("routes queries to relevant professors", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-prof-"));
    tempDirs.push(storageDir);
    const network = new ExtendedProfessorNetwork({ storageDir });

    const route = network.routeQuery(
      "How do I optimize kubernetes deployment pipelines?",
    );
    expect(route.confidence).toBeGreaterThan(0);
    expect([
      ProfessorSpecialty.DEVOPS,
      ProfessorSpecialty.CLOUD_COMPUTING,
      ProfessorSpecialty.WEB_DEVELOPMENT,
    ]).toContain(route.professor.specialty);
  });

  it("records consultations, findings, and ratings", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-prof-consult-"));
    tempDirs.push(storageDir);
    const network = new ExtendedProfessorNetwork({ storageDir });

    const response = network.consult(
      ProfessorSpecialty.DATA_SCIENCE,
      "How should I evaluate model drift?",
    );
    expect(response.success).toBe(true);
    expect(response.systemPrompt).toContain("Data Science");

    network.addFinding(
      ProfessorSpecialty.DATA_SCIENCE,
      "Drift baseline",
      "Track feature distributions and prediction confidence.",
    );
    network.addRating(ProfessorSpecialty.DATA_SCIENCE, 4);

    const stats = network.getStats();
    expect(stats.consultations).toBe(1);
    expect(stats.findings).toBe(1);
  });

  it("publishes findings and exposes professor lists/stats", () => {
    const storageDir = mkdtempSync(join(tmpdir(), "nexus-prof-meta-"));
    tempDirs.push(storageDir);
    const network = new ExtendedProfessorNetwork({ storageDir });

    const publishResult = network.publishFinding(
      ProfessorSpecialty.SOFTWARE_ENGINEERING,
      "Use typed interfaces for runtime contracts",
      { source: "test" },
    );
    expect(publishResult.success).toBe(true);
    expect(publishResult.findingId).toBeDefined();

    const ratingResult = network.rateConsultation(
      ProfessorSpecialty.SOFTWARE_ENGINEERING,
      4.6,
    );
    expect(ratingResult).toBe(true);

    const stats = network.getProfessorStats();
    expect(
      stats[ProfessorSpecialty.SOFTWARE_ENGINEERING]?.findings,
    ).toBeGreaterThan(0);
    expect(
      stats[ProfessorSpecialty.SOFTWARE_ENGINEERING]?.rating,
    ).toBeGreaterThan(0);

    const professors = network.getAllProfessors();
    expect(professors.length).toBeGreaterThan(0);
    expect(professors[0]).toMatchObject({
      key: expect.any(String),
      name: expect.any(String),
      specialty: expect.any(String),
      avatar: expect.any(String),
    });
  });
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AgentTestSuite,
  AssertionHelper,
  DataValidator,
  IntegrationTestFramework,
  MockObject,
  SchemaValidator,
  TestCategory,
  TestRunner,
  TestStatus,
  ValidationSeverity,
  createTestCase,
  createTestSuite,
} from "../../../src/agents/nexus-tamagotchi/testing-validation-framework.js";

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

describe("testing-validation-framework", () => {
  it("tracks assertions and mock call history", () => {
    const helper = new AssertionHelper();
    helper.assertEqual(1, 1);
    helper.assertTrue(true);
    helper.assertFalse(false);
    helper.assertContains("hello world", "world");
    helper.assertApproxEqual(1.001, 1, 0.01);
    expect(helper.failed).toBe(0);

    const mock = new MockObject();
    mock.setReturnValue("fetch", { ok: true });
    const output = mock.invoke("fetch", "https://example.com");
    expect(output).toEqual({ ok: true });
    expect(mock.wasCalled("fetch")).toBe(true);
    expect(mock.wasCalledWith("fetch", "https://example.com")).toBe(true);
  });

  it("executes test suites and produces aggregate summaries", async () => {
    const storagePath = mkdtempSync(join(tmpdir(), "nexus-test-runner-"));
    tempDirs.push(storagePath);

    const runner = new TestRunner(storagePath);
    const suite = createTestSuite({
      name: "runner-suite",
      tests: [
        createTestCase({
          name: "pass-case",
          category: TestCategory.UNIT,
          expectedResult: 2,
          testFn: () => 2,
        }),
        createTestCase({
          name: "fail-case",
          category: TestCategory.UNIT,
          expectedResult: 10,
          testFn: () => 1,
        }),
      ],
    });

    const report = await runner.runSuite(suite);
    expect(report.totalTests).toBe(2);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.results[0]?.status).toBe(TestStatus.PASSED);
    expect(report.results[1]?.status).toBe(TestStatus.FAILED);

    const summary = runner.getSummary();
    expect(summary.totalRuns).toBe(1);
    expect(summary.totalTests).toBe(2);
  });

  it("validates field rules and schema contracts", () => {
    const validator = new DataValidator();
    validator.registerRule(
      "user",
      validator.createRequiredRule("email", "Email Required"),
    );
    validator.registerRule(
      "user",
      validator.createPatternRule("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/),
    );
    validator.registerRule("user", validator.createRangeRule("age", 18, 99));

    const invalid = validator.validate({ email: "invalid", age: 12 }, "user");
    expect(invalid.isValid).toBe(false);
    expect(invalid.errorsCount).toBeGreaterThan(0);

    const schemaValidator = new SchemaValidator();
    schemaValidator.registerSchema("profile", {
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "string", minLength: 3 },
        name: { type: "string", minLength: 1 },
        tags: { type: "array", minItems: 1, items: { type: "string" } },
      },
    });
    const result = schemaValidator.validate(
      { id: "ab", tags: [] },
      "profile",
    );
    expect(result.isValid).toBe(false);
    expect(result.errorsCount).toBeGreaterThan(0);
    expect(
      result.issues.some((issue) => issue.severity === ValidationSeverity.ERROR),
    ).toBe(true);
  });

  it("supports integration test fixtures and agent baseline checks", async () => {
    const storagePath = mkdtempSync(join(tmpdir(), "nexus-int-tests-"));
    tempDirs.push(storagePath);
    const framework = new IntegrationTestFramework(
      "http://localhost:8000",
      storagePath,
    );
    const suite = createTestSuite({
      name: "integration-suite",
      tests: [
        framework.createApiTest({
          name: "api-health",
          method: "GET",
          endpoint: "/health",
          expectedStatus: 200,
        }),
      ],
    });
    const report = await framework.runSuite(suite);
    expect(report.passed).toBe(1);

    const agentSuite = new AgentTestSuite({
      brotherhood: {
        totalXp: 0,
        awardXp(activityType: string, options?: { baseAmount?: number }) {
          if (!activityType) {
            return { totalXp: this.totalXp };
          }
          const amount = options?.baseAmount ?? 0;
          this.totalXp = this.totalXp + amount;
          return { totalXp: this.totalXp };
        },
      },
      interact: () => "ok",
      saveState: () => undefined,
    });
    const agentReport = await agentSuite.runAll();
    expect(agentReport.totalTests).toBeGreaterThan(0);
  });
});
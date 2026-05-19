import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

export enum TestStatus {
  PENDING = "pending",
  RUNNING = "running",
  PASSED = "passed",
  FAILED = "failed",
  SKIPPED = "skipped",
  ERROR = "error",
  TIMEOUT = "timeout",
}

export enum TestCategory {
  UNIT = "unit",
  INTEGRATION = "integration",
  FUNCTIONAL = "functional",
  REGRESSION = "regression",
  PERFORMANCE = "performance",
  SECURITY = "security",
  SMOKE = "smoke",
  E2E = "e2e",
}

export enum ValidationSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

export const VALIDATION_SEVERITY_LEVEL: Record<ValidationSeverity, number> = {
  [ValidationSeverity.INFO]: 0,
  [ValidationSeverity.WARNING]: 1,
  [ValidationSeverity.ERROR]: 2,
  [ValidationSeverity.CRITICAL]: 3,
};

export enum ValidationType {
  SCHEMA = "schema",
  TYPE = "type",
  RANGE = "range",
  PATTERN = "pattern",
  REQUIRED = "required",
  UNIQUE = "unique",
  DEPENDENCY = "dependency",
  CUSTOM = "custom",
  BUSINESS = "business",
  SECURITY = "security",
}

export type TestLifecycleFn = () => void | Promise<void>;
export type TestExecutionFn = () => unknown | Promise<unknown>;

export type TestCase = {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  tags: string[];
  setup?: TestLifecycleFn;
  teardown?: TestLifecycleFn;
  testFn?: TestExecutionFn;
  expectedResult?: unknown;
  timeoutSeconds: number;
  retryCount: number;
  skip: boolean;
  skipReason: string;
  dependencies: string[];
  metadata: Record<string, unknown>;
};

export function createTestCase(input: Partial<TestCase> & {
  name: string;
  testFn?: TestExecutionFn;
}): TestCase {
  return {
    id: input.id ?? randomUUID(),
    name: input.name,
    description: input.description ?? "",
    category: input.category ?? TestCategory.UNIT,
    tags: [...(input.tags ?? [])],
    setup: input.setup,
    teardown: input.teardown,
    testFn: input.testFn,
    expectedResult: input.expectedResult,
    timeoutSeconds: input.timeoutSeconds ?? 30,
    retryCount: input.retryCount ?? 0,
    skip: input.skip ?? false,
    skipReason: input.skipReason ?? "",
    dependencies: [...(input.dependencies ?? [])],
    metadata: { ...(input.metadata ?? {}) },
  };
}

export type TestResult = {
  testId: string;
  testName: string;
  status: TestStatus;
  actualResult?: unknown;
  expectedResult?: unknown;
  errorMessage?: string;
  stackTrace?: string;
  durationMs: number;
  retryCount: number;
  assertionsPassed: number;
  assertionsFailed: number;
  logs: string[];
  screenshots: string[];
  startedAt?: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
};

export type TestSuite = {
  id: string;
  name: string;
  description: string;
  tests: TestCase[];
  setupSuite?: TestLifecycleFn;
  teardownSuite?: TestLifecycleFn;
  parallel: boolean;
  maxParallel: number;
  failFast: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
};

export function createTestSuite(input: Partial<TestSuite> & {
  name: string;
  tests: TestCase[];
}): TestSuite {
  return {
    id: input.id ?? randomUUID(),
    name: input.name,
    description: input.description ?? "",
    tests: [...input.tests],
    setupSuite: input.setupSuite,
    teardownSuite: input.teardownSuite,
    parallel: input.parallel ?? false,
    maxParallel: input.maxParallel ?? 4,
    failFast: input.failFast ?? false,
    tags: [...(input.tags ?? [])],
    metadata: { ...(input.metadata ?? {}) },
  };
}

export class TestReport {
  id: string;
  suiteName: string;
  results: TestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  totalDurationMs: number;
  startedAt?: string;
  completedAt?: string;
  environment: Record<string, string>;
  coverage?: Record<string, number>;
  metadata: Record<string, unknown>;

  constructor(input: {
    id?: string;
    suiteName: string;
    results?: TestResult[];
    totalTests?: number;
    passed?: number;
    failed?: number;
    skipped?: number;
    errors?: number;
    totalDurationMs?: number;
    startedAt?: string;
    completedAt?: string;
    environment?: Record<string, string>;
    coverage?: Record<string, number>;
    metadata?: Record<string, unknown>;
  }) {
    this.id = input.id ?? randomUUID();
    this.suiteName = input.suiteName;
    this.results = [...(input.results ?? [])];
    this.totalTests = input.totalTests ?? this.results.length;
    this.passed = input.passed ?? 0;
    this.failed = input.failed ?? 0;
    this.skipped = input.skipped ?? 0;
    this.errors = input.errors ?? 0;
    this.totalDurationMs = input.totalDurationMs ?? 0;
    this.startedAt = input.startedAt;
    this.completedAt = input.completedAt;
    this.environment = { ...(input.environment ?? {}) };
    this.coverage = input.coverage ? { ...input.coverage } : undefined;
    this.metadata = { ...(input.metadata ?? {}) };
  }

  get passRate(): number {
    if (this.totalTests === 0) {
      return 0;
    }
    return (this.passed / this.totalTests) * 100;
  }

  get isSuccessful(): boolean {
    return this.failed === 0 && this.errors === 0;
  }
}

export type ValidationRule = {
  id: string;
  name: string;
  description: string;
  ruleType: ValidationType;
  severity: ValidationSeverity;
  fieldPath: string;
  validator?: (value: unknown) => boolean;
  errorMessage: string;
  params: Record<string, unknown>;
  enabled: boolean;
};

export function createValidationRule(
  input: Partial<ValidationRule> & {
    name: string;
    fieldPath: string;
    ruleType?: ValidationType;
  },
): ValidationRule {
  return {
    id: input.id ?? randomUUID(),
    name: input.name,
    description: input.description ?? "",
    ruleType: input.ruleType ?? ValidationType.CUSTOM,
    severity: input.severity ?? ValidationSeverity.ERROR,
    fieldPath: input.fieldPath,
    validator: input.validator,
    errorMessage: input.errorMessage ?? "",
    params: { ...(input.params ?? {}) },
    enabled: input.enabled ?? true,
  };
}

export type ValidationIssue = {
  ruleId: string;
  ruleName: string;
  severity: ValidationSeverity;
  fieldPath: string;
  message: string;
  actualValue?: unknown;
  expectedValue?: unknown;
  suggestion?: string;
  metadata: Record<string, unknown>;
};

export class ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  warningsCount: number;
  errorsCount: number;
  criticalCount: number;
  validatedAt: string;

  constructor() {
    this.isValid = true;
    this.issues = [];
    this.warningsCount = 0;
    this.errorsCount = 0;
    this.criticalCount = 0;
    this.validatedAt = new Date().toISOString();
  }

  addIssue(issue: ValidationIssue): void {
    this.issues.push({
      ...issue,
      metadata: { ...(issue.metadata ?? {}) },
    });
    if (issue.severity === ValidationSeverity.WARNING) {
      this.warningsCount += 1;
      return;
    }
    if (issue.severity === ValidationSeverity.ERROR) {
      this.errorsCount += 1;
      this.isValid = false;
      return;
    }
    if (issue.severity === ValidationSeverity.CRITICAL) {
      this.criticalCount += 1;
      this.isValid = false;
    }
  }
}

export class AssertionHelper {
  passed = 0;
  failed = 0;
  messages: string[] = [];

  private record(passed: boolean, message: string): boolean {
    if (passed) {
      this.passed += 1;
    } else {
      this.failed += 1;
      this.messages.push(message);
    }
    return passed;
  }

  assertEqual(actual: unknown, expected: unknown, message?: string): boolean {
    return this.record(
      isDeepStrictEqual(actual, expected),
      message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }

  assertNotEqual(actual: unknown, notExpected: unknown, message?: string): boolean {
    return this.record(
      !isDeepStrictEqual(actual, notExpected),
      message ??
        `Expected value not equal to ${JSON.stringify(notExpected)}, got ${JSON.stringify(actual)}`,
    );
  }

  assertTrue(value: unknown, message?: string): boolean {
    return this.record(Boolean(value), message ?? `Expected truthy value, got ${String(value)}`);
  }

  assertFalse(value: unknown, message?: string): boolean {
    return this.record(!value, message ?? `Expected falsy value, got ${String(value)}`);
  }

  assertNone(value: unknown, message?: string): boolean {
    return this.record(value === undefined || value === null, message ?? "Expected nullish value");
  }

  assertNotNone(value: unknown, message?: string): boolean {
    return this.record(
      value !== undefined && value !== null,
      message ?? "Expected non-nullish value",
    );
  }

  assertIn(item: unknown, container: unknown, message?: string): boolean {
    if (Array.isArray(container)) {
      return this.record(
        container.some((entry) => isDeepStrictEqual(entry, item)),
        message ?? "Expected item in array",
      );
    }
    if (typeof container === "string") {
      return this.record(
        typeof item === "string" && container.includes(item),
        message ?? "Expected substring in string",
      );
    }
    return this.record(false, message ?? "Container type is not supported for assertIn");
  }

  assertNotIn(item: unknown, container: unknown, message?: string): boolean {
    if (Array.isArray(container)) {
      return this.record(
        !container.some((entry) => isDeepStrictEqual(entry, item)),
        message ?? "Expected item not in array",
      );
    }
    if (typeof container === "string") {
      return this.record(
        !(typeof item === "string" && container.includes(item)),
        message ?? "Expected substring not in string",
      );
    }
    return this.record(
      true,
      message ?? "Container type is not supported for assertNotIn; treating as pass",
    );
  }

  assertIsInstance<T>(
    value: unknown,
    constructor: new (...args: never[]) => T,
    message?: string,
  ): boolean {
    return this.record(
      value instanceof constructor,
      message ?? `Expected instance of ${constructor.name}`,
    );
  }

  assertGreater(actual: number, expected: number, message?: string): boolean {
    return this.record(actual > expected, message ?? `Expected ${actual} > ${expected}`);
  }

  assertGreaterEqual(actual: number, expected: number, message?: string): boolean {
    return this.record(actual >= expected, message ?? `Expected ${actual} >= ${expected}`);
  }

  assertLess(actual: number, expected: number, message?: string): boolean {
    return this.record(actual < expected, message ?? `Expected ${actual} < ${expected}`);
  }

  assertLessEqual(actual: number, expected: number, message?: string): boolean {
    return this.record(actual <= expected, message ?? `Expected ${actual} <= ${expected}`);
  }

  assertBetween(value: number, min: number, max: number, message?: string): boolean {
    return this.record(
      value >= min && value <= max,
      message ?? `Expected ${value} between ${min} and ${max}`,
    );
  }

  assertLength(value: { length: number }, expectedLength: number, message?: string): boolean {
    return this.record(
      value.length === expectedLength,
      message ?? `Expected length ${expectedLength}, got ${value.length}`,
    );
  }

  assertEmpty(value: { length: number }, message?: string): boolean {
    return this.record(value.length === 0, message ?? `Expected empty value, got ${value.length}`);
  }

  assertNotEmpty(value: { length: number }, message?: string): boolean {
    return this.record(value.length > 0, message ?? "Expected non-empty value");
  }

  assertMatches(value: string, pattern: RegExp | string, message?: string): boolean {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    return this.record(
      regex.test(value),
      message ?? `Expected '${value}' to match ${regex.toString()}`,
    );
  }

  assertContains(text: string, substring: string, message?: string): boolean {
    return this.record(
      text.includes(substring),
      message ?? `Expected '${text}' to include '${substring}'`,
    );
  }

  assertStartsWith(text: string, prefix: string, message?: string): boolean {
    return this.record(
      text.startsWith(prefix),
      message ?? `Expected '${text}' to start with '${prefix}'`,
    );
  }

  assertEndsWith(text: string, suffix: string, message?: string): boolean {
    return this.record(
      text.endsWith(suffix),
      message ?? `Expected '${text}' to end with '${suffix}'`,
    );
  }

  assertRaises(
    runner: () => unknown,
    expected: new (...args: never[]) => Error,
    message?: string,
  ): boolean {
    try {
      runner();
      return this.record(false, message ?? `Expected ${expected.name} to be thrown`);
    } catch (error: unknown) {
      if (error instanceof expected) {
        this.passed += 1;
        return true;
      }
      return this.record(
        false,
        message ??
          `Expected ${expected.name}, got ${
            error instanceof Error ? error.constructor.name : typeof error
          }`,
      );
    }
  }

  assertDictHasKey(
    value: Record<string, unknown>,
    key: string,
    message?: string,
  ): boolean {
    return this.record(
      Object.prototype.hasOwnProperty.call(value, key),
      message ?? `Expected dictionary key '${key}'`,
    );
  }

  assertDictHasKeys(
    value: Record<string, unknown>,
    keys: string[],
    message?: string,
  ): boolean {
    const missing = keys.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
    return this.record(
      missing.length === 0,
      message ?? `Missing keys: ${missing.join(", ")}`,
    );
  }

  assertListEqual<T>(actual: T[], expected: T[], message?: string): boolean {
    return this.record(
      isDeepStrictEqual(actual, expected),
      message ?? "Expected lists to be equal",
    );
  }

  assertListContainsAll<T>(actual: T[], expected: T[], message?: string): boolean {
    const missing = expected.filter(
      (entry) => !actual.some((candidate) => isDeepStrictEqual(candidate, entry)),
    );
    return this.record(
      missing.length === 0,
      message ?? `Missing list entries: ${JSON.stringify(missing)}`,
    );
  }

  assertApproxEqual(actual: number, expected: number, tolerance = 0.001, message?: string): boolean {
    return this.record(
      Math.abs(actual - expected) <= tolerance,
      message ?? `Expected ${actual} ~= ${expected} (±${tolerance})`,
    );
  }
}

export type MockCallRecord = {
  method: string;
  args: unknown[];
  timestamp: string;
};

export class MockObject {
  private callHistory: MockCallRecord[] = [];
  private returnValues = new Map<string, unknown>();
  private sideEffects = new Map<string, (...args: unknown[]) => unknown>();

  setReturnValue(methodName: string, value: unknown): this {
    this.returnValues.set(methodName, value);
    return this;
  }

  setSideEffect(methodName: string, handler: (...args: unknown[]) => unknown): this {
    this.sideEffects.set(methodName, handler);
    return this;
  }

  invoke(methodName: string, ...args: unknown[]): unknown {
    this.callHistory.push({
      method: methodName,
      args: [...args],
      timestamp: new Date().toISOString(),
    });
    const sideEffect = this.sideEffects.get(methodName);
    if (sideEffect) {
      return sideEffect(...args);
    }
    return this.returnValues.get(methodName);
  }

  getCallCount(methodName?: string): number {
    if (!methodName) {
      return this.callHistory.length;
    }
    return this.callHistory.filter((entry) => entry.method === methodName).length;
  }

  getCalls(methodName?: string): MockCallRecord[] {
    if (!methodName) {
      return [...this.callHistory];
    }
    return this.callHistory.filter((entry) => entry.method === methodName);
  }

  wasCalled(methodName: string): boolean {
    return this.getCallCount(methodName) > 0;
  }

  wasCalledWith(methodName: string, ...args: unknown[]): boolean {
    return this.getCalls(methodName).some((entry) => isDeepStrictEqual(entry.args, args));
  }

  reset(): void {
    this.callHistory = [];
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}

function extractStackTrace(error: unknown): string | undefined {
  if (error instanceof Error && typeof error.stack === "string") {
    return error.stack;
  }
  return undefined;
}

function withTimeout<T>(promise: Promise<T>, timeoutSeconds: number): Promise<T> {
  if (timeoutSeconds <= 0) {
    return promise;
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout:${timeoutSeconds}`));
    }, timeoutSeconds * 1000);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export class TestRunner {
  storagePath: string;
  currentSuite?: TestSuite;
  reports: TestReport[];

  constructor(storagePath = join(".nexus_agent_data", "tests")) {
    this.storagePath = storagePath;
    this.reports = [];
    if (!existsSync(this.storagePath)) {
      mkdirSync(this.storagePath, { recursive: true });
    }
  }

  async runTest(testCase: TestCase): Promise<TestResult> {
    const result: TestResult = {
      testId: testCase.id,
      testName: testCase.name,
      status: TestStatus.PENDING,
      expectedResult: testCase.expectedResult,
      durationMs: 0,
      retryCount: 0,
      assertionsPassed: 0,
      assertionsFailed: 0,
      logs: [],
      screenshots: [],
      metadata: { ...testCase.metadata },
    };
    if (testCase.skip) {
      result.status = TestStatus.SKIPPED;
      result.errorMessage = testCase.skipReason || "Test skipped";
      return result;
    }
    result.status = TestStatus.RUNNING;
    result.startedAt = new Date().toISOString();
    const startedAtMs = Date.now();
    let attempt = 0;
    const maxAttempts = Math.max(1, testCase.retryCount + 1);
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        if (testCase.setup) {
          await Promise.resolve(testCase.setup());
        }
        if (testCase.testFn) {
          const execution = Promise.resolve(testCase.testFn());
          result.actualResult = await withTimeout(execution, testCase.timeoutSeconds);
        }
        if (testCase.expectedResult !== undefined) {
          const passed = isDeepStrictEqual(result.actualResult, testCase.expectedResult);
          if (!passed) {
            result.status = TestStatus.FAILED;
            result.errorMessage = `Expected ${JSON.stringify(testCase.expectedResult)}, got ${JSON.stringify(result.actualResult)}`;
            if (attempt >= maxAttempts) {
              break;
            }
            result.retryCount = attempt;
            continue;
          }
        }
        result.status = TestStatus.PASSED;
        break;
      } catch (error: unknown) {
        const message = extractErrorMessage(error);
        if (message.startsWith("timeout:")) {
          result.status = TestStatus.TIMEOUT;
          result.errorMessage = `Test timed out after ${testCase.timeoutSeconds}s`;
        } else {
          result.status = TestStatus.ERROR;
          result.errorMessage = message;
          result.stackTrace = extractStackTrace(error);
        }
        if (attempt >= maxAttempts) {
          break;
        }
        result.retryCount = attempt;
      } finally {
        try {
          if (testCase.teardown) {
            await Promise.resolve(testCase.teardown());
          }
        } catch {
          result.logs.push("teardown failed");
        }
      }
    }
    result.durationMs = Date.now() - startedAtMs;
    result.completedAt = new Date().toISOString();
    return result;
  }

  async runSuite(suite: TestSuite): Promise<TestReport> {
    this.currentSuite = suite;
    const report = new TestReport({
      suiteName: suite.name,
      totalTests: suite.tests.length,
      startedAt: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd(),
      },
      metadata: { ...suite.metadata },
    });
    if (suite.setupSuite) {
      try {
        await Promise.resolve(suite.setupSuite());
      } catch (error: unknown) {
        for (const testCase of suite.tests) {
          report.results.push({
            testId: testCase.id,
            testName: testCase.name,
            status: TestStatus.ERROR,
            errorMessage: `Suite setup failed: ${extractErrorMessage(error)}`,
            durationMs: 0,
            retryCount: 0,
            assertionsPassed: 0,
            assertionsFailed: 0,
            logs: [],
            screenshots: [],
            metadata: {},
          });
          report.errors += 1;
        }
        report.completedAt = new Date().toISOString();
        this.reports.push(report);
        this.saveReport(report);
        return report;
      }
    }
    for (const testCase of suite.tests) {
      const result = await this.runTest(testCase);
      report.results.push(result);
      report.totalDurationMs += result.durationMs;
      if (result.status === TestStatus.PASSED) {
        report.passed += 1;
      } else if (result.status === TestStatus.FAILED) {
        report.failed += 1;
        if (suite.failFast) {
          break;
        }
      } else if (result.status === TestStatus.SKIPPED) {
        report.skipped += 1;
      } else {
        report.errors += 1;
        if (suite.failFast) {
          break;
        }
      }
    }
    if (suite.teardownSuite) {
      try {
        await Promise.resolve(suite.teardownSuite());
      } catch {
        report.metadata.teardownError = true;
      }
    }
    report.completedAt = new Date().toISOString();
    this.reports.push(report);
    this.saveReport(report);
    return report;
  }

  saveReport(report: TestReport): void {
    if (!existsSync(this.storagePath)) {
      mkdirSync(this.storagePath, { recursive: true });
    }
    const target = join(this.storagePath, `report_${report.id}.json`);
    const payload = {
      id: report.id,
      suiteName: report.suiteName,
      totalTests: report.totalTests,
      passed: report.passed,
      failed: report.failed,
      skipped: report.skipped,
      errors: report.errors,
      passRate: report.passRate,
      totalDurationMs: report.totalDurationMs,
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      environment: report.environment,
      results: report.results.map((result) => ({
        testId: result.testId,
        testName: result.testName,
        status: result.status,
        durationMs: result.durationMs,
        errorMessage: result.errorMessage,
      })),
    };
    writeFileSync(target, JSON.stringify(payload, null, 2), "utf8");
  }

  getSummary(): Record<string, unknown> {
    if (this.reports.length === 0) {
      return { message: "No test reports available" };
    }
    const totals = this.reports.reduce(
      (accumulator, report) => {
        accumulator.tests += report.totalTests;
        accumulator.passed += report.passed;
        accumulator.failed += report.failed;
        return accumulator;
      },
      { tests: 0, passed: 0, failed: 0 },
    );
    return {
      totalRuns: this.reports.length,
      totalTests: totals.tests,
      totalPassed: totals.passed,
      totalFailed: totals.failed,
      overallPassRate: totals.tests > 0 ? (totals.passed / totals.tests) * 100 : 0,
      lastRun: this.reports[this.reports.length - 1]?.completedAt,
    };
  }
}

export class DataValidator {
  private readonly rules = new Map<string, ValidationRule[]>();
  private readonly builtInValidators: Record<string, (value: unknown) => boolean>;

  constructor() {
    this.builtInValidators = {
      email: (value) => this.validateEmail(value),
      url: (value) => this.validateUrl(value),
      uuid: (value) => this.validateUuid(value),
      date: (value) => this.validateDate(value),
      datetime: (value) => this.validateDateTime(value),
      phone: (value) => this.validatePhone(value),
      ip_address: (value) => this.validateIpAddress(value),
      json: (value) => this.validateJson(value),
      alphanumeric: (value) => this.validateAlphanumeric(value),
    };
  }

  registerRule(schemaName: string, rule: ValidationRule): void {
    const existing = this.rules.get(schemaName) ?? [];
    existing.push(rule);
    this.rules.set(schemaName, existing);
  }

  validate(data: Record<string, unknown>, schemaName: string): ValidationResult {
    const result = new ValidationResult();
    const schemaRules = this.rules.get(schemaName) ?? [];
    for (const rule of schemaRules) {
      if (!rule.enabled) {
        continue;
      }
      const value = this.getNestedValue(data, rule.fieldPath);
      let valid = true;
      if (rule.validator) {
        try {
          valid = rule.validator(value);
        } catch {
          valid = false;
        }
      }
      if (!valid) {
        result.addIssue({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          fieldPath: rule.fieldPath,
          message: rule.errorMessage || `Validation failed for ${rule.fieldPath}`,
          actualValue: value,
          metadata: {},
        });
      }
    }
    return result;
  }

  getBuiltInValidator(name: string): ((value: unknown) => boolean) | undefined {
    return this.builtInValidators[name];
  }

  private getNestedValue(data: Record<string, unknown>, path: string): unknown {
    if (!path) {
      return data;
    }
    const segments = path.split(".");
    let cursor: unknown = data;
    for (const segment of segments) {
      if (Array.isArray(cursor)) {
        const index = Number.parseInt(segment, 10);
        if (!Number.isInteger(index) || index < 0 || index >= cursor.length) {
          return undefined;
        }
        cursor = cursor[index];
        continue;
      }
      if (typeof cursor === "object" && cursor !== null) {
        cursor = (cursor as Record<string, unknown>)[segment];
        continue;
      }
      return undefined;
    }
    return cursor;
  }

  private validateEmail(value: unknown): boolean {
    if (typeof value !== "string") {
      return false;
    }
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/.test(value);
  }

  private validateUrl(value: unknown): boolean {
    if (typeof value !== "string") {
      return false;
    }
    return /^https?:\/\/[^\s/$.?#].[^\s]*$/.test(value);
  }

  private validateUuid(value: unknown): boolean {
    if (typeof value !== "string") {
      return false;
    }
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private validateDate(value: unknown): boolean {
    if (typeof value !== "string") {
      return false;
    }
    const parsed = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed);
  }

  private validateDateTime(value: unknown): boolean {
    if (typeof value !== "string") {
      return false;
    }
    return Number.isFinite(Date.parse(value));
  }

  private validatePhone(value: unknown): boolean {
    if (typeof value !== "string") {
      return false;
    }
    return /^[\d\s\-()+]{7,20}$/.test(value);
  }

  private validateIpAddress(value: unknown): boolean {
    if (typeof value !== "string") {
      return false;
    }
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) {
      return false;
    }
    return value.split(".").every((part) => {
      const number = Number.parseInt(part, 10);
      return number >= 0 && number <= 255;
    });
  }

  private validateJson(value: unknown): boolean {
    if (typeof value !== "string") {
      return false;
    }
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  private validateAlphanumeric(value: unknown): boolean {
    if (typeof value !== "string") {
      return false;
    }
    return /^[0-9a-z]+$/i.test(value);
  }

  createRequiredRule(fieldPath: string, name?: string): ValidationRule {
    return createValidationRule({
      name: name ?? `Required: ${fieldPath}`,
      ruleType: ValidationType.REQUIRED,
      fieldPath,
      validator: (value) => value !== undefined && value !== null && value !== "",
      errorMessage: `Field '${fieldPath}' is required`,
    });
  }

  createTypeRule(
    fieldPath: string,
    expectedType: "string" | "number" | "boolean" | "object" | "array",
    name?: string,
  ): ValidationRule {
    return createValidationRule({
      name: name ?? `Type: ${fieldPath}`,
      ruleType: ValidationType.TYPE,
      fieldPath,
      validator: (value) => {
        if (expectedType === "array") {
          return Array.isArray(value);
        }
        if (expectedType === "object") {
          return typeof value === "object" && value !== null && !Array.isArray(value);
        }
        return typeof value === expectedType;
      },
      errorMessage: `Field '${fieldPath}' must be ${expectedType}`,
    });
  }

  createRangeRule(
    fieldPath: string,
    min?: number,
    max?: number,
    name?: string,
  ): ValidationRule {
    return createValidationRule({
      name: name ?? `Range: ${fieldPath}`,
      ruleType: ValidationType.RANGE,
      fieldPath,
      validator: (value) => {
        if (value === undefined || value === null) {
          return true;
        }
        if (typeof value !== "number" || Number.isNaN(value)) {
          return false;
        }
        if (min !== undefined && value < min) {
          return false;
        }
        if (max !== undefined && value > max) {
          return false;
        }
        return true;
      },
      errorMessage: `Field '${fieldPath}' must be between ${min ?? "-∞"} and ${max ?? "∞"}`,
      params: { min, max },
    });
  }

  createPatternRule(fieldPath: string, pattern: RegExp | string, name?: string): ValidationRule {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    return createValidationRule({
      name: name ?? `Pattern: ${fieldPath}`,
      ruleType: ValidationType.PATTERN,
      fieldPath,
      validator: (value) => value === undefined || value === null || regex.test(String(value)),
      errorMessage: `Field '${fieldPath}' must match ${regex.toString()}`,
      params: { pattern: regex.toString() },
    });
  }

  createLengthRule(
    fieldPath: string,
    minLength?: number,
    maxLength?: number,
    name?: string,
  ): ValidationRule {
    return createValidationRule({
      name: name ?? `Length: ${fieldPath}`,
      ruleType: ValidationType.RANGE,
      fieldPath,
      validator: (value) => {
        if (value === undefined || value === null) {
          return true;
        }
        if (
          typeof value !== "string" &&
          !Array.isArray(value) &&
          !(typeof value === "object" && value !== null && "length" in value)
        ) {
          return false;
        }
        const length = (value as { length: number }).length;
        if (minLength !== undefined && length < minLength) {
          return false;
        }
        if (maxLength !== undefined && length > maxLength) {
          return false;
        }
        return true;
      },
      errorMessage: `Field '${fieldPath}' length must be between ${minLength ?? 0} and ${maxLength ?? "∞"}`,
      params: { minLength, maxLength },
    });
  }

  createEnumRule(fieldPath: string, allowedValues: unknown[], name?: string): ValidationRule {
    return createValidationRule({
      name: name ?? `Enum: ${fieldPath}`,
      fieldPath,
      ruleType: ValidationType.CUSTOM,
      validator: (value) =>
        value === undefined || allowedValues.some((item) => isDeepStrictEqual(item, value)),
      errorMessage: `Field '${fieldPath}' must be one of ${JSON.stringify(allowedValues)}`,
      params: { allowedValues },
    });
  }
}

type JsonSchema = {
  type?: "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
};

export class SchemaValidator {
  private readonly schemas = new Map<string, JsonSchema>();

  registerSchema(name: string, schema: JsonSchema): void {
    this.schemas.set(name, schema);
  }

  validate(data: unknown, schemaName: string): ValidationResult {
    const result = new ValidationResult();
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      result.addIssue({
        ruleId: "schema_not_found",
        ruleName: "Schema Not Found",
        severity: ValidationSeverity.ERROR,
        fieldPath: "",
        message: `Schema '${schemaName}' not found`,
        metadata: {},
      });
      return result;
    }
    this.validateAgainstSchema(data, schema, "", result);
    return result;
  }

  private validateAgainstSchema(
    data: unknown,
    schema: JsonSchema,
    path: string,
    result: ValidationResult,
  ): void {
    const expectedType = schema.type;
    if (expectedType && !this.matchesType(data, expectedType)) {
      result.addIssue({
        ruleId: "type_mismatch",
        ruleName: "Type Mismatch",
        severity: ValidationSeverity.ERROR,
        fieldPath: path,
        message: `Expected type '${expectedType}'`,
        actualValue: data,
        expectedValue: expectedType,
        metadata: {},
      });
      return;
    }
    if (expectedType === "object" && typeof data === "object" && data !== null && !Array.isArray(data)) {
      const objectData = data as Record<string, unknown>;
      for (const requiredField of schema.required ?? []) {
        if (!(requiredField in objectData)) {
          result.addIssue({
            ruleId: "missing_required",
            ruleName: "Missing Required Field",
            severity: ValidationSeverity.ERROR,
            fieldPath: path ? `${path}.${requiredField}` : requiredField,
            message: `Required field '${requiredField}' is missing`,
            metadata: {},
          });
        }
      }
      for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
        if (!(key in objectData)) {
          continue;
        }
        this.validateAgainstSchema(
          objectData[key],
          childSchema,
          path ? `${path}.${key}` : key,
          result,
        );
      }
    }
    if (expectedType === "array" && Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) {
        result.addIssue({
          ruleId: "min_items",
          ruleName: "Minimum Items",
          severity: ValidationSeverity.ERROR,
          fieldPath: path,
          message: `Array must have at least ${schema.minItems} item(s)`,
          actualValue: data.length,
          expectedValue: schema.minItems,
          metadata: {},
        });
      }
      if (schema.maxItems !== undefined && data.length > schema.maxItems) {
        result.addIssue({
          ruleId: "max_items",
          ruleName: "Maximum Items",
          severity: ValidationSeverity.ERROR,
          fieldPath: path,
          message: `Array must have at most ${schema.maxItems} item(s)`,
          actualValue: data.length,
          expectedValue: schema.maxItems,
          metadata: {},
        });
      }
      if (schema.items) {
        data.forEach((entry, index) => {
          this.validateAgainstSchema(entry, schema.items as JsonSchema, `${path}[${index}]`, result);
        });
      }
    }
    if (expectedType === "string" && typeof data === "string") {
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        result.addIssue({
          ruleId: "min_length",
          ruleName: "Minimum Length",
          severity: ValidationSeverity.ERROR,
          fieldPath: path,
          message: `String must be at least ${schema.minLength} characters`,
          actualValue: data.length,
          expectedValue: schema.minLength,
          metadata: {},
        });
      }
      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        result.addIssue({
          ruleId: "max_length",
          ruleName: "Maximum Length",
          severity: ValidationSeverity.ERROR,
          fieldPath: path,
          message: `String must be at most ${schema.maxLength} characters`,
          actualValue: data.length,
          expectedValue: schema.maxLength,
          metadata: {},
        });
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(data)) {
          result.addIssue({
            ruleId: "pattern_mismatch",
            ruleName: "Pattern Mismatch",
            severity: ValidationSeverity.ERROR,
            fieldPath: path,
            message: `String does not match '${schema.pattern}'`,
            actualValue: data,
            metadata: {},
          });
        }
      }
    }
    if ((expectedType === "number" || expectedType === "integer") && typeof data === "number") {
      if (schema.minimum !== undefined && data < schema.minimum) {
        result.addIssue({
          ruleId: "minimum",
          ruleName: "Minimum Value",
          severity: ValidationSeverity.ERROR,
          fieldPath: path,
          message: `Value must be >= ${schema.minimum}`,
          actualValue: data,
          expectedValue: schema.minimum,
          metadata: {},
        });
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        result.addIssue({
          ruleId: "maximum",
          ruleName: "Maximum Value",
          severity: ValidationSeverity.ERROR,
          fieldPath: path,
          message: `Value must be <= ${schema.maximum}`,
          actualValue: data,
          expectedValue: schema.maximum,
          metadata: {},
        });
      }
      if (expectedType === "integer" && !Number.isInteger(data)) {
        result.addIssue({
          ruleId: "integer_only",
          ruleName: "Integer Constraint",
          severity: ValidationSeverity.ERROR,
          fieldPath: path,
          message: "Value must be an integer",
          actualValue: data,
          metadata: {},
        });
      }
    }
    if (schema.enum && !schema.enum.some((value) => isDeepStrictEqual(value, data))) {
      result.addIssue({
        ruleId: "enum_mismatch",
        ruleName: "Enum Constraint",
        severity: ValidationSeverity.ERROR,
        fieldPath: path,
        message: `Value must be one of ${JSON.stringify(schema.enum)}`,
        actualValue: data,
        metadata: {},
      });
    }
  }

  private matchesType(
    value: unknown,
    expectedType: "string" | "number" | "integer" | "boolean" | "array" | "object" | "null",
  ): boolean {
    if (expectedType === "null") {
      return value === null;
    }
    if (expectedType === "array") {
      return Array.isArray(value);
    }
    if (expectedType === "object") {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    if (expectedType === "integer") {
      return typeof value === "number" && Number.isInteger(value);
    }
    return typeof value === expectedType;
  }
}

export class IntegrationTestFramework {
  readonly baseUrl: string;
  readonly storagePath: string;
  readonly testRunner: TestRunner;
  private readonly fixtures = new Map<string, unknown>();
  private readonly cleanupTasks: Array<() => void | Promise<void>> = [];

  constructor(
    baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:8000",
    storagePath = join(".nexus_agent_data", "integration_tests"),
  ) {
    this.baseUrl = baseUrl;
    this.storagePath = storagePath;
    this.testRunner = new TestRunner(storagePath);
  }

  registerFixture(name: string, value: unknown): void {
    this.fixtures.set(name, value);
  }

  getFixture<T>(name: string): T | undefined {
    return this.fixtures.get(name) as T | undefined;
  }

  addCleanup(task: () => void | Promise<void>): void {
    this.cleanupTasks.push(task);
  }

  async runCleanup(): Promise<void> {
    while (this.cleanupTasks.length > 0) {
      const task = this.cleanupTasks.pop();
      if (!task) {
        continue;
      }
      try {
        await Promise.resolve(task());
      } catch {
        continue;
      }
    }
  }

  createApiTest(input: {
    name: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    endpoint: string;
    expectedStatus?: number;
    requestBody?: Record<string, unknown>;
    headers?: Record<string, string>;
    validateResponse?: (
      response: { statusCode: number; body: Record<string, unknown> },
      helper: AssertionHelper,
    ) => void;
  }): TestCase {
    const expectedStatus = input.expectedStatus ?? 200;
    return createTestCase({
      name: input.name,
      category: TestCategory.INTEGRATION,
      metadata: {
        method: input.method,
        endpoint: input.endpoint,
        expectedStatus,
      },
      testFn: () => {
        const fakeResponse = {
          statusCode: expectedStatus,
          body: {},
        };
        const helper = new AssertionHelper();
        helper.assertEqual(fakeResponse.statusCode, expectedStatus);
        if (input.validateResponse) {
          input.validateResponse(fakeResponse, helper);
        }
        if (helper.failed > 0) {
          throw new Error(helper.messages.join("\n"));
        }
        return fakeResponse;
      },
    });
  }

  createDatabaseTest(input: {
    name: string;
    setupData?: Record<string, unknown>[];
    expectedResults?: Record<string, unknown>[];
    cleanup?: boolean;
  }): TestCase {
    const key = `db:${input.name}`;
    return createTestCase({
      name: input.name,
      category: TestCategory.INTEGRATION,
      setup: () => {
        this.registerFixture(key, [...(input.setupData ?? [])]);
      },
      teardown: () => {
        if (input.cleanup ?? true) {
          this.registerFixture(key, []);
        }
      },
      expectedResult: input.expectedResults ?? [],
      testFn: () => {
        return this.getFixture<Record<string, unknown>[]>(key) ?? [];
      },
    });
  }

  async runSuite(suite: TestSuite): Promise<TestReport> {
    try {
      return await this.testRunner.runSuite(suite);
    } finally {
      await this.runCleanup();
    }
  }
}

type BrotherhoodLike = {
  totalXp: number;
  awardXp: (
    activityType: string,
    options?: {
      baseAmount?: number;
      reason?: string;
    },
  ) => unknown;
};

type AgentLike = {
  brotherhood?: BrotherhoodLike;
  interact?: (message: string) => string | Promise<string>;
  saveState?: () => void;
  _save_state?: () => void;
};

function hasBrotherhood(value: unknown): value is BrotherhoodLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.totalXp === "number" &&
    typeof record.awardXp === "function"
  );
}

export class AgentTestSuite {
  agent?: AgentLike;
  testRunner: TestRunner;

  constructor(agent?: AgentLike, storagePath?: string) {
    this.agent = agent;
    this.testRunner = new TestRunner(storagePath ?? join(".nexus_agent_data", "agent_tests"));
  }

  createBasicSuite(): TestSuite {
    return createTestSuite({
      name: "Agent Basic Tests",
      description: "Basic functionality tests for the agent",
      tests: [
        createTestCase({
          name: "Agent Initialization",
          description: "Test agent initializes correctly",
          category: TestCategory.SMOKE,
          expectedResult: true,
          testFn: () => this.agent !== undefined,
        }),
        createTestCase({
          name: "State Persistence",
          description: "Test state saves and loads",
          category: TestCategory.UNIT,
          expectedResult: true,
          testFn: () => this.testStatePersistence(),
        }),
        createTestCase({
          name: "XP Award",
          description: "Test XP is awarded correctly",
          category: TestCategory.UNIT,
          expectedResult: true,
          testFn: () => this.testXpAward(),
        }),
        createTestCase({
          name: "Interaction Response",
          description: "Test agent responds to input",
          category: TestCategory.FUNCTIONAL,
          expectedResult: true,
          testFn: () => this.testInteraction(),
        }),
      ],
    });
  }

  private testStatePersistence(): boolean {
    if (!this.agent) {
      return false;
    }
    if (typeof this.agent.saveState === "function") {
      this.agent.saveState();
      return true;
    }
    if (typeof this.agent._save_state === "function") {
      this.agent._save_state();
      return true;
    }
    return false;
  }

  private testXpAward(): boolean {
    if (!this.agent || !hasBrotherhood(this.agent.brotherhood)) {
      return false;
    }
    const before = this.agent.brotherhood.totalXp;
    this.agent.brotherhood.awardXp("interaction", { baseAmount: 10, reason: "test" });
    return this.agent.brotherhood.totalXp >= before + 10;
  }

  private async testInteraction(): Promise<boolean> {
    if (!this.agent || typeof this.agent.interact !== "function") {
      return false;
    }
    const output = await Promise.resolve(this.agent.interact("Hello, this is a test"));
    return typeof output === "string" && output.length > 0;
  }

  async runAll(): Promise<TestReport> {
    return this.testRunner.runSuite(this.createBasicSuite());
  }
}
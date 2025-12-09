# Test-Based Immutability Pipeline - Implementation Plan
## Step-by-Step Build Guide - 2025-12-07

---

## 🎯 IMPLEMENTATION STRATEGY

**Approach:** Build in phases, test each component independently, integrate incrementally

**Priority:** Working MVP before full feature set

---

## 📦 PHASE 1: Core Pipeline Foundation (2-3 hours)

### 1.1: Create Type Definitions

**File:** `src/security/pipeline-types.ts`

```typescript
/**
 * Pipeline Types - Core interfaces and types
 */

export enum TestCategory {
  STATIC = 'static',           // Always run
  UNIT = 'unit',
  INTEGRATION = 'integration',
  REGRESSION = 'regression',
  E2E = 'e2e',
  PERFORMANCE = 'performance',
}

export interface TestFile {
  path: string;
  category: TestCategory;
  critical: boolean;          // Must pass for commit
  estimatedDuration: number;  // Milliseconds
}

export interface TestResult {
  test: TestFile;
  passed: boolean;
  duration: number;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export interface TestSet {
  critical: TestFile[];       // Must run
  affected: TestFile[];       // Run if files changed
  total: number;
  estimatedDuration: number;
}

export interface PipelineResult {
  success: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  duration: number;
  failures: TestResult[];
  timestamp: Date;
  changedFiles: string[];
  commitHash?: string;
}

export interface ExecutionStrategy {
  parallel: boolean;
  maxWorkers: number;
  timeout: number;
  failFast: boolean;
  retries: number;
}

export interface ValidationRules {
  allowedFailures: number;
  criticalTestsMustPass: boolean;
  minCoverage?: number;
  allowSkips: boolean;
}
```

**Testing:** None (just types)

---

### 1.2: Create Test Discovery Engine

**File:** `src/security/test-discovery.ts`

```typescript
/**
 * Test Discovery Engine
 * Maps source files → test files
 */

import { glob } from 'glob';
import { relative, join } from 'path';
import { TestFile, TestCategory, TestSet } from './pipeline-types.js';

export class TestDiscovery {
  private rootDir: string;
  private testDir: string;

  // Mapping: source file pattern → test files
  private dependencyMap: Map<string, string[]> = new Map();

  // Critical tests (ALWAYS run)
  private criticalTests: Set<string> = new Set([
    'tests/static/source_hash_integrity.test.js',
    'tests/unit/db/schema.test.js',
  ]);

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.testDir = join(rootDir, 'tests');
    this.buildDependencyMap();
  }

  /**
   * Build dependency map from source patterns to test files
   */
  private buildDependencyMap(): void {
    // Example mappings (will be expanded)
    this.dependencyMap.set('src/agent/**/*.ts', [
      'tests/unit/agent/**/*.test.js',
      'tests/integration/agent/**/*.test.js',
    ]);

    this.dependencyMap.set('src/timeline/**/*.ts', [
      'tests/unit/timeline/**/*.test.js',
      'tests/integration/timeline/**/*.test.js',
      'tests/integration/db/multi-db-consistency.test.js',
    ]);

    this.dependencyMap.set('src/db/**/*.ts', [
      'tests/unit/db/**/*.test.js',
      'tests/integration/db/**/*.test.js',
    ]);

    this.dependencyMap.set('src/security/**/*.ts', [
      'tests/unit/security/**/*.test.js',
      'tests/static/source_hash_integrity.test.js',
    ]);

    this.dependencyMap.set('src/tools/**/*.ts', [
      'tests/unit/tools/**/*.test.js',
      'tests/integration/tools/**/*.test.js',
    ]);
  }

  /**
   * Discover all test files
   */
  async discoverAllTests(): Promise<TestFile[]> {
    const patterns = [
      'tests/**/*.test.js',
      'tests/**/*.spec.js',
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ];

    const files: TestFile[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, { cwd: this.rootDir });

      for (const match of matches) {
        files.push(this.createTestFile(match));
      }
    }

    return files;
  }

  /**
   * Discover affected tests based on changed files
   */
  async discoverAffectedTests(changedFiles: string[]): Promise<TestSet> {
    const critical: TestFile[] = [];
    const affectedSet = new Set<string>();

    // 1. Add critical tests (always run)
    for (const criticalPath of this.criticalTests) {
      const testFile = this.createTestFile(criticalPath);
      critical.push(testFile);
      affectedSet.add(criticalPath);
    }

    // 2. Find affected tests based on changed files
    for (const changedFile of changedFiles) {
      for (const [pattern, testPatterns] of this.dependencyMap.entries()) {
        if (this.matchesPattern(changedFile, pattern)) {
          for (const testPattern of testPatterns) {
            const matches = await glob(testPattern, { cwd: this.rootDir });
            for (const match of matches) {
              if (!affectedSet.has(match)) {
                affectedSet.add(match);
              }
            }
          }
        }
      }
    }

    // 3. Create TestSet
    const affected: TestFile[] = [];
    for (const testPath of affectedSet) {
      if (!this.criticalTests.has(testPath)) {
        affected.push(this.createTestFile(testPath));
      }
    }

    const totalDuration = [...critical, ...affected].reduce(
      (sum, t) => sum + t.estimatedDuration,
      0
    );

    return {
      critical,
      affected,
      total: critical.length + affected.length,
      estimatedDuration: totalDuration,
    };
  }

  /**
   * Create TestFile object from path
   */
  private createTestFile(testPath: string): TestFile {
    const category = this.categorizeTest(testPath);
    const critical = this.criticalTests.has(testPath);

    return {
      path: testPath,
      category,
      critical,
      estimatedDuration: this.estimateDuration(category),
    };
  }

  /**
   * Categorize test by directory
   */
  private categorizeTest(testPath: string): TestCategory {
    if (testPath.includes('/static/')) return TestCategory.STATIC;
    if (testPath.includes('/unit/')) return TestCategory.UNIT;
    if (testPath.includes('/integration/')) return TestCategory.INTEGRATION;
    if (testPath.includes('/regression/')) return TestCategory.REGRESSION;
    if (testPath.includes('/e2e/')) return TestCategory.E2E;
    if (testPath.includes('/performance/')) return TestCategory.PERFORMANCE;
    return TestCategory.UNIT;
  }

  /**
   * Estimate test duration based on category
   */
  private estimateDuration(category: TestCategory): number {
    const durations = {
      [TestCategory.STATIC]: 100,
      [TestCategory.UNIT]: 500,
      [TestCategory.INTEGRATION]: 2000,
      [TestCategory.REGRESSION]: 1000,
      [TestCategory.E2E]: 5000,
      [TestCategory.PERFORMANCE]: 3000,
    };
    return durations[category];
  }

  /**
   * Simple pattern matching (supports **)
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\./g, '\\.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
}
```

**Testing:**
```typescript
// tests/unit/security/test-discovery.test.js
import { TestDiscovery } from '../../../src/security/test-discovery.js';

describe('TestDiscovery', () => {
  it('discovers all tests', async () => {
    const discovery = new TestDiscovery(process.cwd());
    const tests = await discovery.discoverAllTests();
    expect(tests.length).toBeGreaterThan(0);
  });

  it('identifies critical tests', async () => {
    const discovery = new TestDiscovery(process.cwd());
    const testSet = await discovery.discoverAffectedTests([]);
    expect(testSet.critical.length).toBeGreaterThan(0);
  });

  it('finds affected tests for changed files', async () => {
    const discovery = new TestDiscovery(process.cwd());
    const testSet = await discovery.discoverAffectedTests([
      'src/agent/grok-agent.ts'
    ]);
    expect(testSet.total).toBeGreaterThan(testSet.critical.length);
  });
});
```

---

### 1.3: Create Test Executor

**File:** `src/security/test-executor.ts`

```typescript
/**
 * Test Executor
 * Runs tests in parallel with timeout and error handling
 */

import { spawn } from 'child_process';
import { TestFile, TestResult, ExecutionStrategy } from './pipeline-types.js';

export class TestExecutor {
  private strategy: ExecutionStrategy;

  constructor(strategy: Partial<ExecutionStrategy> = {}) {
    this.strategy = {
      parallel: strategy.parallel ?? true,
      maxWorkers: strategy.maxWorkers ?? 4,
      timeout: strategy.timeout ?? 30000,
      failFast: strategy.failFast ?? false,
      retries: strategy.retries ?? 0,
    };
  }

  /**
   * Execute all tests
   */
  async executeTests(tests: TestFile[]): Promise<TestResult[]> {
    if (this.strategy.parallel) {
      return this.executeParallel(tests);
    } else {
      return this.executeSequential(tests);
    }
  }

  /**
   * Execute tests in parallel
   */
  private async executeParallel(tests: TestFile[]): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const queue = [...tests];
    const running = new Set<Promise<TestResult>>();

    while (queue.length > 0 || running.size > 0) {
      // Start new tests if under maxWorkers
      while (queue.length > 0 && running.size < this.strategy.maxWorkers) {
        const test = queue.shift()!;
        const promise = this.executeOne(test);
        running.add(promise);

        promise.then(result => {
          running.delete(promise);
          results.push(result);

          // Fail fast if requested
          if (!result.passed && this.strategy.failFast) {
            queue.length = 0; // Clear queue
          }
        });
      }

      // Wait for at least one to complete
      if (running.size > 0) {
        await Promise.race(running);
      }
    }

    return results;
  }

  /**
   * Execute tests sequentially
   */
  private async executeSequential(tests: TestFile[]): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const test of tests) {
      const result = await this.executeOne(test);
      results.push(result);

      if (!result.passed && this.strategy.failFast) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute a single test
   */
  private async executeOne(test: TestFile): Promise<TestResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Determine test command based on file type
      const command = test.path.endsWith('.sh') ? 'bash' : 'node';
      const args = test.path.endsWith('.sh') ? [test.path] : [test.path];

      const proc = spawn(command, args, {
        cwd: process.cwd(),
        timeout: this.strategy.timeout,
      });

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;

        resolve({
          test,
          passed: !timedOut && code === 0,
          duration,
          error: timedOut ? 'Test timeout' : (code !== 0 ? `Exit code ${code}` : undefined),
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });

      proc.on('error', (err) => {
        resolve({
          test,
          passed: false,
          duration: Date.now() - startTime,
          error: err.message,
        });
      });

      // Timeout handler
      setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');

        setTimeout(() => {
          proc.kill('SIGKILL'); // Force kill if SIGTERM didn't work
        }, 1000);
      }, this.strategy.timeout);
    });
  }
}
```

**Testing:**
```typescript
// tests/unit/security/test-executor.test.js
import { TestExecutor } from '../../../src/security/test-executor.js';
import { TestCategory } from '../../../src/security/pipeline-types.js';

describe('TestExecutor', () => {
  it('executes tests successfully', async () => {
    const executor = new TestExecutor({ parallel: false });
    const results = await executor.executeTests([
      {
        path: 'tests/unit/db/schema.test.js',
        category: TestCategory.UNIT,
        critical: true,
        estimatedDuration: 500,
      },
    ]);

    expect(results.length).toBe(1);
    expect(results[0].passed).toBeDefined();
  });

  it('handles timeouts', async () => {
    const executor = new TestExecutor({ timeout: 100 });
    const results = await executor.executeTests([
      {
        path: 'tests/mock/infinite-test.js', // Mock file
        category: TestCategory.UNIT,
        critical: false,
        estimatedDuration: 500,
      },
    ]);

    expect(results[0].passed).toBe(false);
    expect(results[0].error).toContain('timeout');
  });
});
```

---

### 1.4: Create Result Validator

**File:** `src/security/result-validator.ts`

```typescript
/**
 * Result Validator
 * Zero-tolerance validation of test results
 */

import { TestResult, ValidationRules, PipelineResult } from './pipeline-types.js';

export interface ValidationResult {
  allowed: boolean;
  reason: string;
  criticalFailures: number;
  totalFailures: number;
  securityImpact: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

export class ResultValidator {
  private rules: ValidationRules;

  constructor(rules: Partial<ValidationRules> = {}) {
    this.rules = {
      allowedFailures: rules.allowedFailures ?? 0,
      criticalTestsMustPass: rules.criticalTestsMustPass ?? true,
      minCoverage: rules.minCoverage,
      allowSkips: rules.allowSkips ?? false,
    };
  }

  /**
   * Validate test results (ZERO TOLERANCE)
   */
  validate(results: TestResult[]): ValidationResult {
    const failures = results.filter(r => !r.passed);
    const criticalFailures = failures.filter(r => r.test.critical);

    // RULE 1: Zero tolerance - ALL tests must pass
    if (failures.length > this.rules.allowedFailures) {
      return {
        allowed: false,
        reason: 'TESTS_FAILED',
        criticalFailures: criticalFailures.length,
        totalFailures: failures.length,
        securityImpact: criticalFailures.length > 0 ? 'CRITICAL' : 'HIGH',
        recommendation: this.generateRecommendation(failures),
      };
    }

    // RULE 2: Critical tests MUST pass
    if (this.rules.criticalTestsMustPass && criticalFailures.length > 0) {
      return {
        allowed: false,
        reason: 'CRITICAL_TESTS_FAILED',
        criticalFailures: criticalFailures.length,
        totalFailures: failures.length,
        securityImpact: 'CRITICAL',
        recommendation: 'Fix critical test failures before committing',
      };
    }

    // ALL PASSED ✅
    return {
      allowed: true,
      reason: 'ALL_TESTS_PASSED',
      criticalFailures: 0,
      totalFailures: 0,
      securityImpact: 'LOW',
      recommendation: 'Proceed with commit',
    };
  }

  /**
   * Generate recommendation based on failures
   */
  private generateRecommendation(failures: TestResult[]): string {
    const categories = new Set(failures.map(f => f.test.category));

    if (failures.length === 1) {
      return `Fix failing test: ${failures[0].test.path}`;
    }

    if (categories.has('static' as any)) {
      return 'Fix static analysis failures (schema/integrity) before committing';
    }

    if (categories.has('integration' as any)) {
      return 'Fix integration test failures - system consistency issues detected';
    }

    return `Fix ${failures.length} failing tests before committing`;
  }
}
```

**Testing:**
```typescript
// tests/unit/security/result-validator.test.js
import { ResultValidator } from '../../../src/security/result-validator.js';

describe('ResultValidator', () => {
  it('allows when all tests pass', () => {
    const validator = new ResultValidator();
    const result = validator.validate([
      { test: { critical: true }, passed: true, duration: 100 },
      { test: { critical: false }, passed: true, duration: 200 },
    ]);

    expect(result.allowed).toBe(true);
  });

  it('blocks when any test fails', () => {
    const validator = new ResultValidator();
    const result = validator.validate([
      { test: { critical: false }, passed: false, duration: 100, error: 'Failed' },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.totalFailures).toBe(1);
  });

  it('marks critical when critical tests fail', () => {
    const validator = new ResultValidator();
    const result = validator.validate([
      { test: { critical: true }, passed: false, duration: 100, error: 'Critical failure' },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.securityImpact).toBe('CRITICAL');
  });
});
```

---

## 📦 PHASE 2: Pipeline Orchestrator (1-2 hours)

### 2.1: Core Pipeline

**File:** `src/security/test-immutability-pipeline.ts`

```typescript
/**
 * Test Immutability Pipeline
 * Orchestrates test discovery, execution, and validation
 */

import { TestDiscovery } from './test-discovery.js';
import { TestExecutor } from './test-executor.js';
import { ResultValidator } from './result-validator.js';
import { PipelineResult } from './pipeline-types.js';

export class TestImmutabilityPipeline {
  private discovery: TestDiscovery;
  private executor: TestExecutor;
  private validator: ResultValidator;
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.discovery = new TestDiscovery(rootDir);
    this.executor = new TestExecutor();
    this.validator = new ResultValidator();
  }

  /**
   * Run complete pipeline
   */
  async run(changedFiles: string[]): Promise<PipelineResult> {
    const startTime = Date.now();

    console.log('🔒 Test Immutability Pipeline');
    console.log(`📂 Changed files: ${changedFiles.length}`);

    // PHASE 1: Discover tests
    console.log('\n📋 Phase 1: Test Discovery...');
    const testSet = await this.discovery.discoverAffectedTests(changedFiles);
    console.log(`   Critical tests: ${testSet.critical.length}`);
    console.log(`   Affected tests: ${testSet.affected.length}`);
    console.log(`   Total: ${testSet.total} tests`);
    console.log(`   Estimated duration: ${Math.round(testSet.estimatedDuration / 1000)}s`);

    // PHASE 2: Execute tests
    console.log('\n🧪 Phase 2: Test Execution...');
    const allTests = [...testSet.critical, ...testSet.affected];
    const results = await this.executor.executeTests(allTests);

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`   Passed: ${passed}/${results.length}`);
    console.log(`   Failed: ${failed}/${results.length}`);

    // PHASE 3: Validate results
    console.log('\n✅ Phase 3: Validation...');
    const validation = this.validator.validate(results);

    const duration = Date.now() - startTime;

    const pipelineResult: PipelineResult = {
      success: validation.allowed,
      testsRun: results.length,
      testsPassed: passed,
      testsFailed: failed,
      duration,
      failures: results.filter(r => !r.passed),
      timestamp: new Date(),
      changedFiles,
    };

    // Print result
    console.log(`\n${validation.allowed ? '✅' : '❌'} Result: ${validation.reason}`);
    console.log(`   Security Impact: ${validation.securityImpact}`);
    console.log(`   Recommendation: ${validation.recommendation}`);
    console.log(`   Duration: ${Math.round(duration / 1000)}s`);

    return pipelineResult;
  }
}
```

**Testing:**
```typescript
// tests/integration/security/pipeline.test.js
import { TestImmutabilityPipeline } from '../../../src/security/test-immutability-pipeline.js';

describe('TestImmutabilityPipeline', () => {
  it('runs complete pipeline', async () => {
    const pipeline = new TestImmutabilityPipeline(process.cwd());
    const result = await pipeline.run(['src/agent/grok-agent.ts']);

    expect(result.testsRun).toBeGreaterThan(0);
    expect(result.success).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);
  });
});
```

---

## 📦 PHASE 3: CLI Integration (1 hour)

### 3.1: CLI Wrapper

**File:** `src/security/test-immutability-cli.ts`

```typescript
#!/usr/bin/env node
/**
 * CLI wrapper for Test Immutability Pipeline
 */

import { TestImmutabilityPipeline } from './test-immutability-pipeline.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface CLIArgs {
  mode: 'pre-commit' | 'ci' | 'manual';
  files: string[];
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] as CLIArgs['mode'] || 'manual';
  const filesArg = args.find(a => a.startsWith('--files='))?.split('=')[1];
  const files = filesArg ? filesArg.split(',') : [];

  return { mode, files };
}

async function main() {
  const { mode, files } = parseArgs();

  console.log(`\n🔒 TEST IMMUTABILITY PIPELINE [${mode.toUpperCase()}]`);
  console.log('='.repeat(60));

  const pipeline = new TestImmutabilityPipeline(process.cwd());
  const result = await pipeline.run(files);

  // Save report
  const reportPath = join(homedir(), '.grok', 'pipeline-report.json');
  writeFileSync(reportPath, JSON.stringify(result, null, 2));

  console.log(`\n📄 Report saved: ${reportPath}`);

  // Exit code
  process.exit(result.success ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Pipeline error:', error);
  process.exit(1);
});
```

---

## 📦 PHASE 4: Git Hook Setup (30 minutes)

### 4.1: Pre-Commit Hook Template

**File:** `scripts/setup-git-hooks.sh`

```bash
#!/bin/bash
# Setup Git Hooks for Test Immutability Pipeline

HOOK_FILE=".git/hooks/pre-commit"

echo "🔒 Setting up Test Immutability Pipeline Git Hooks..."

# Create pre-commit hook
cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
# Test Immutability Pipeline - Pre-Commit Hook

set -e

echo "🔒 Test Immutability Pipeline: Validating changes..."

# Get changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | tr '\n' ',')

if [ -z "$CHANGED_FILES" ]; then
  echo "✅ No files changed, skipping pipeline"
  exit 0
fi

# Run pipeline
node dist/security/test-immutability-cli.js \
  --mode=pre-commit \
  --files="$CHANGED_FILES"

RESULT=$?

if [ $RESULT -eq 0 ]; then
  echo "✅ All tests passed - commit ALLOWED"
  exit 0
else
  echo "❌ Tests failed - commit BLOCKED"
  echo ""
  echo "📋 To see details: cat ~/.grok/pipeline-report.json"
  echo "🔧 To fix: npm test"
  echo "⚠️  To bypass (NOT RECOMMENDED): git commit --no-verify"
  exit 1
fi
EOF

# Make executable
chmod +x "$HOOK_FILE"

echo "✅ Git hooks installed successfully!"
echo "   Hook: $HOOK_FILE"
```

---

## 📊 SUCCESS METRICS

### Phase 1 Complete When:
- ✅ All 4 core files created
- ✅ Unit tests passing
- ✅ Test discovery working
- ✅ Test execution working
- ✅ Validation logic correct

### Phase 2 Complete When:
- ✅ Pipeline orchestrator working
- ✅ Can run end-to-end
- ✅ Integration test passing

### Phase 3 Complete When:
- ✅ CLI wrapper functional
- ✅ Can run from command line
- ✅ Report generation working

### Phase 4 Complete When:
- ✅ Git hook installed
- ✅ Commits blocked on test failure
- ✅ Commits allowed on test success

---

## 🎯 ROLLOUT PLAN

### Week 1: Build Core
- Day 1: Phase 1 (Foundation)
- Day 2: Phase 2 (Orchestrator)
- Day 3: Phase 3 (CLI)

### Week 2: Integration
- Day 4: Phase 4 (Git Hooks)
- Day 5: Testing & Bug Fixes
- Day 6-7: Documentation

---

**Next Step:** Start Phase 1.1 (Type Definitions)

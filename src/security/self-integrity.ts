/**
 * 🛡️ SELF-INTEGRITY PROTECTION
 * 
 * Les watchers se protègent eux-mêmes contre les altérations.
 * 
 * CONCEPT:
 * 1. Chaque watcher vérifie son propre hash au démarrage
 * 2. Hashes attendus embarqués dans le code (baseline)
 * 3. Vérification mutuelle entre watchers
 * 4. Chain of trust : daemon → IntegrityWatcher → LLMGuard
 * 5. Fail-safe : Arrêt immédiat si altération détectée
 * 
 * PROTECTION:
 * - Contre remplacement fichier avant exécution
 * - Contre modification "on the fly"
 * - Contre injection code malveillant
 * 
 * LIMITATIONS (pour plus tard):
 * - Ne protège pas contre modification EN MÉMOIRE (runtime)
 * - Solution future : V8 isolates, memory sealing, runtime checksums
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Baseline hashes (EMBEDDED IN CODE)
 * 
 * ⚠️  IMPORTANT: Ces hashes doivent être mis à jour après chaque modification
 *                légitime des fichiers watchers.
 * 
 * Pour regénérer: npm run security:update-baseline
 */
const EXPECTED_HASHES: Record<string, string> = {
  // 📁 SOURCE FILES (src/security/)
  'src/security/integrity-watcher.ts': 'PENDING_FIRST_RUN',
  'src/security/llm-guard.ts': 'PENDING_FIRST_RUN',
  'src/security/watcher-daemon.ts': 'PENDING_FIRST_RUN',
  'src/security/self-integrity.ts': 'PENDING_FIRST_RUN',
  'src/security/watcher-cli.ts': 'PENDING_FIRST_RUN',
  'src/security/llm-guard-cli.ts': 'PENDING_FIRST_RUN',
  'src/security/watcher-daemon-cli.ts': 'PENDING_FIRST_RUN',
  
  // 🔧 FIX: Add dist/ protection (ChatGPT feedback - CRITICAL)
  // Ces fichiers sont RÉELLEMENT EXÉCUTÉS, donc critiques !
  'dist/security/integrity-watcher.js': 'PENDING_FIRST_RUN',
  'dist/security/llm-guard.js': 'PENDING_FIRST_RUN',
  'dist/security/watcher-daemon.js': 'PENDING_FIRST_RUN',
  'dist/security/self-integrity.js': 'PENDING_FIRST_RUN',
  'dist/security/watcher-cli.js': 'PENDING_FIRST_RUN',
  'dist/security/llm-guard-cli.js': 'PENDING_FIRST_RUN',
  'dist/security/watcher-daemon-cli.js': 'PENDING_FIRST_RUN',
};

// 🔧 FIX: SIGNATURE_FILE removed (ChatGPT feedback - unused code)

export interface SelfIntegrityResult {
  success: boolean;
  file: string;
  expectedHash?: string;
  actualHash: string;
  status: 'OK' | 'MISMATCH' | 'MISSING' | 'PENDING_VALIDATION';
  message: string;
  inode?: number;
  timestamp: Date;
}

export class SelfIntegrityChecker {
  private rootDir: string;
  private results: SelfIntegrityResult[] = [];

  constructor(rootDir?: string) {
    this.rootDir = rootDir || process.cwd();
  }

  /**
   * Verify single file integrity
   * 🔧 FIX: filename now includes full path (src/security/ or dist/security/)
   */
  private verifyFile(filename: string): SelfIntegrityResult {
    // filename is now full path (e.g., 'src/security/integrity-watcher.ts')
    const filePath = join(this.rootDir, filename);
    const timestamp = new Date();

    // Check file exists
    if (!existsSync(filePath)) {
      return {
        success: false,
        file: filename,
        actualHash: '',
        status: 'MISSING',
        message: `File not found: ${filePath}`,
        timestamp,
      };
    }

    // Calculate actual hash
    const content = readFileSync(filePath, 'utf-8');
    const actualHash = createHash('sha256').update(content).digest('hex');

    // Get inode (for replacement detection)
    const stats = statSync(filePath);
    const inode = stats.ino;

    // Get expected hash
    const expectedHash = EXPECTED_HASHES[filename];

    // First run or pending validation
    if (expectedHash === 'PENDING_FIRST_RUN') {
      return {
        success: true,
        file: filename,
        expectedHash,
        actualHash,
        status: 'PENDING_VALIDATION',
        message: `First run - hash recorded: ${actualHash.substring(0, 16)}...`,
        inode,
        timestamp,
      };
    }

    // Verify hash match
    if (actualHash !== expectedHash) {
      return {
        success: false,
        file: filename,
        expectedHash,
        actualHash,
        status: 'MISMATCH',
        message: `CRITICAL: Hash mismatch! File may be altered or replaced!`,
        inode,
        timestamp,
      };
    }

    // All good
    return {
      success: true,
      file: filename,
      expectedHash,
      actualHash,
      status: 'OK',
      message: `File integrity verified`,
      inode,
      timestamp,
    };
  }

  /**
   * Verify all security files
   */
  async verifyAll(): Promise<SelfIntegrityResult[]> {
    this.results = [];

    const filesToCheck = Object.keys(EXPECTED_HASHES);

    for (const filename of filesToCheck) {
      const result = this.verifyFile(filename);
      this.results.push(result);
    }

    return this.results;
  }

  /**
   * Verify specific watcher before execution
   * 🔧 FIX CRITIQUE (ChatGPT feedback): Use full paths matching EXPECTED_HASHES
   */
  async verifyBeforeExecution(watcherName: 'integrity' | 'llm-guard' | 'daemon'): Promise<boolean> {
    // 🔧 FIX: Chemins complets pour correspondre à EXPECTED_HASHES
    const fileMap = {
      integrity: [
        'src/security/integrity-watcher.ts',
        'src/security/watcher-cli.ts',
        'src/security/self-integrity.ts',
        'dist/security/integrity-watcher.js',
        'dist/security/watcher-cli.js',
        'dist/security/self-integrity.js',
      ],
      'llm-guard': [
        'src/security/llm-guard.ts',
        'src/security/llm-guard-cli.ts',
        'src/security/self-integrity.ts',
        'dist/security/llm-guard.js',
        'dist/security/llm-guard-cli.js',
        'dist/security/self-integrity.js',
      ],
      daemon: [
        'src/security/watcher-daemon.ts',
        'src/security/watcher-daemon-cli.ts',
        'src/security/self-integrity.ts',
        'dist/security/watcher-daemon.js',
        'dist/security/watcher-daemon-cli.js',
        'dist/security/self-integrity.js',
      ],
    };

    const filesToCheck = fileMap[watcherName];
    const results: SelfIntegrityResult[] = [];

    for (const filename of filesToCheck) {
      const result = this.verifyFile(filename);
      results.push(result);

      // FAIL-SAFE: Stop immediately if alteration detected
      if (result.status === 'MISMATCH') {
        this.handleIntegrityFailure(result);
        return false;
      }
    }

    // All files OK
    return true;
  }

  /**
   * Handle integrity failure (CRITICAL)
   */
  private handleIntegrityFailure(result: SelfIntegrityResult): void {
    console.error('\n');
    console.error('╔═══════════════════════════════════════════════════════════════╗');
    console.error('║                                                               ║');
    console.error('║   🚨 CRITICAL: SELF-INTEGRITY CHECK FAILED 🚨                ║');
    console.error('║                                                               ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error(`File:          ${result.file}`);
    console.error(`Status:        ${result.status}`);
    console.error(`Message:       ${result.message}`);
    console.error('');
    console.error(`Expected hash: ${result.expectedHash?.substring(0, 64)}`);
    console.error(`Actual hash:   ${result.actualHash.substring(0, 64)}`);
    console.error('');
    console.error('⚠️  POSSIBLE SCENARIOS:');
    console.error('');
    console.error('1. File was REPLACED by adversary');
    console.error('   → Restore from Git: git checkout src/security/' + result.file);
    console.error('');
    console.error('2. File was LEGITIMATELY MODIFIED');
    console.error('   → Update baseline: npm run security:update-baseline');
    console.error('');
    console.error('3. File was INJECTED with malicious code');
    console.error('   → Investigate: git diff src/security/' + result.file);
    console.error('   → Check history: git log -p src/security/' + result.file);
    console.error('');
    console.error('🛑 EXECUTION STOPPED FOR SECURITY REASONS');
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('');

    // Save forensic evidence
    this.saveForensicEvidence(result);

    // EXIT IMMEDIATELY (FAIL-SAFE)
    process.exit(1);
  }

  /**
   * Save forensic evidence
   */
  private saveForensicEvidence(result: SelfIntegrityResult): void {
    const forensicFile = join(this.rootDir, '.security-integrity-failure.json');
    const evidence = {
      timestamp: result.timestamp.toISOString(),
      file: result.file,
      status: result.status,
      expectedHash: result.expectedHash,
      actualHash: result.actualHash,
      inode: result.inode,
      message: result.message,
      pid: process.pid,
      ppid: process.ppid,
      cwd: process.cwd(),
      argv: process.argv,
      env: {
        USER: process.env.USER,
        HOME: process.env.HOME,
        SHELL: process.env.SHELL,
        PWD: process.env.PWD,
      },
    };

    try {
      const fs = require('fs');
      fs.writeFileSync(forensicFile, JSON.stringify(evidence, null, 2));
      console.error(`📊 Forensic evidence saved: ${forensicFile}`);
    } catch (error) {
      console.error('⚠️  Failed to save forensic evidence:', error);
    }
  }

  /**
   * Generate report
   */
  generateReport(): string {
    if (this.results.length === 0) {
      return 'No verification performed yet.';
    }

    const lines: string[] = [];
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('🛡️  SELF-INTEGRITY VERIFICATION REPORT');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    const ok = this.results.filter((r) => r.status === 'OK').length;
    const mismatch = this.results.filter((r) => r.status === 'MISMATCH').length;
    const missing = this.results.filter((r) => r.status === 'MISSING').length;
    const pending = this.results.filter((r) => r.status === 'PENDING_VALIDATION').length;

    lines.push(`Total files checked:     ${this.results.length}`);
    lines.push(`✅ OK:                   ${ok}`);
    lines.push(`❌ MISMATCH:             ${mismatch}`);
    lines.push(`⚠️  MISSING:              ${missing}`);
    lines.push(`🔄 PENDING VALIDATION:   ${pending}`);
    lines.push('');

    if (mismatch > 0 || missing > 0) {
      lines.push('🚨 CRITICAL ISSUES DETECTED:');
      lines.push('');
      this.results
        .filter((r) => r.status === 'MISMATCH' || r.status === 'MISSING')
        .forEach((r) => {
          lines.push(`  ❌ ${r.file}`);
          lines.push(`     Status:  ${r.status}`);
          lines.push(`     Message: ${r.message}`);
          if (r.expectedHash) {
            lines.push(`     Expected: ${r.expectedHash.substring(0, 16)}...`);
          }
          lines.push(`     Actual:   ${r.actualHash.substring(0, 16)}...`);
          lines.push('');
        });
    }

    if (pending > 0) {
      lines.push('🔄 PENDING VALIDATION:');
      lines.push('');
      lines.push('   First run detected. Hashes recorded:');
      lines.push('');
      this.results
        .filter((r) => r.status === 'PENDING_VALIDATION')
        .forEach((r) => {
          lines.push(`   • ${r.file}: ${r.actualHash.substring(0, 16)}...`);
        });
      lines.push('');
      lines.push('   ⚠️  ACTION REQUIRED:');
      lines.push('   1. Verify files are legitimate (not altered)');
      lines.push('   2. Update baseline: npm run security:update-baseline');
      lines.push('');
    }

    if (ok === this.results.length) {
      lines.push('✅ ALL FILES VERIFIED - INTEGRITY OK');
    }

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Get current hashes (for baseline update)
   * 🔧 FIX: filename now includes full path
   */
  getCurrentHashes(): Record<string, string> {
    const hashes: Record<string, string> = {};

    for (const filename of Object.keys(EXPECTED_HASHES)) {
      // filename is full path (e.g., 'src/security/integrity-watcher.ts')
      const filePath = join(this.rootDir, filename);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        const hash = createHash('sha256').update(content).digest('hex');
        hashes[filename] = hash;
      }
    }

    return hashes;
  }
}

/**
 * Quick verification (throws if fails)
 */
export async function verifySelfIntegrityOrDie(watcherName: 'integrity' | 'llm-guard' | 'daemon'): Promise<void> {
  const checker = new SelfIntegrityChecker();
  const success = await checker.verifyBeforeExecution(watcherName);

  if (!success) {
    // handleIntegrityFailure already called process.exit(1)
    // This line should never be reached
    throw new Error('Self-integrity check failed');
  }
}

/**
 * Continuous verification (for runtime)
 * 
 * ⚠️  Note: Ceci vérifie les FICHIERS, pas la mémoire runtime.
 *           Protection mémoire = TODO futur (V8 isolates, memory sealing)
 */
export class ContinuousSelfIntegrityMonitor {
  private checker: SelfIntegrityChecker;
  private intervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  private lastHashes: Map<string, string> = new Map();

  constructor(intervalMs: number = 10000) {
    // Default: check every 10s
    this.checker = new SelfIntegrityChecker();
    this.intervalMs = intervalMs;
  }

  /**
   * Start continuous monitoring
   */
  start(): void {
    if (this.intervalId) {
      return; // Already running
    }

    console.log(`🛡️  Self-integrity continuous monitoring started (every ${this.intervalMs / 1000}s)`);

    this.intervalId = setInterval(async () => {
      await this.check();
    }, this.intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Self-integrity monitoring stopped');
    }
  }

  /**
   * Perform check
   */
  private async check(): Promise<void> {
    const results = await this.checker.verifyAll();

    // Check for changes
    for (const result of results) {
      if (result.status === 'MISMATCH' || result.status === 'MISSING') {
        console.error(`\n🚨 RUNTIME INTEGRITY VIOLATION DETECTED!`);
        console.error(`   File: ${result.file}`);
        console.error(`   Status: ${result.status}`);
        console.error(`   Watcher files were MODIFIED during execution!`);
        console.error(`   This is a CRITICAL SECURITY BREACH!\n`);

        // Save evidence
        this.checker['saveForensicEvidence'](result);

        // EXIT IMMEDIATELY
        process.exit(1);
      }

      // Track hash changes (even if status OK, to detect file rewrites)
      const prevHash = this.lastHashes.get(result.file);
      if (prevHash && prevHash !== result.actualHash) {
        console.warn(`\n⚠️  File hash changed during execution (but still matches baseline)`);
        console.warn(`   File: ${result.file}`);
        console.warn(`   This could indicate file rewrite attack!\n`);
      }

      this.lastHashes.set(result.file, result.actualHash);
    }
  }
}

/**
 * 🛡️ WATCHER DAEMON - Unified Security System Launcher
 * 
 * CONCEPT:
 * - Lancé automatiquement avec grokinou
 * - Une seule commande pour tout
 * - Processus daemon (survit à exit de grokinou)
 * - Détection "à rebours" : fichiers altérés AVANT lancement détectés
 * 
 * FONCTIONNEMENT:
 * 1. Copie signatures d'intégrité (baseline backup)
 * 2. Lance Integrity Watcher (mode dual) en background
 * 3. Lance LLM Guard en background
 * 4. Les deux survivent à l'exit de grokinou
 * 5. Restauration rapide si altérations détectées
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, copyFileSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ContinuousSelfIntegrityMonitor } from './self-integrity.js';

export interface WatcherDaemonConfig {
  mode: 'heuristic' | 'dual' | 'llm';
  enableLLMGuard?: boolean;
  llmApiKey?: string;
  baselineBackup?: boolean;
  autoStart?: boolean;
  // 🔧 FIX: Add continuous self-integrity monitoring (ChatGPT feedback)
  enableContinuousSelfIntegrity?: boolean;
  selfIntegrityIntervalMs?: number; // Default: 10000 (10s)
}

export class WatcherDaemon {
  private rootDir: string;
  private config: Required<WatcherDaemonConfig>;
  private pidFile: string;
  private integrityWatcherPid: number | null = null;
  private llmGuardPid: number | null = null;
  // 🔧 FIX: Add continuous self-integrity monitor (ChatGPT feedback)
  private selfIntegrityMonitor: ContinuousSelfIntegrityMonitor | null = null;

  constructor(rootDir: string, config: Partial<WatcherDaemonConfig> = {}) {
    this.rootDir = rootDir;
    this.pidFile = join(rootDir, '.watcher-daemon.pid');
    
    this.config = {
      mode: config.mode || 'dual',
      enableLLMGuard: config.enableLLMGuard ?? true,
      llmApiKey: config.llmApiKey || process.env.GROK_API_KEY || '',
      baselineBackup: config.baselineBackup ?? true,
      autoStart: config.autoStart ?? true,
      // 🔧 FIX: Enable continuous self-integrity by default (ChatGPT feedback)
      enableContinuousSelfIntegrity: config.enableContinuousSelfIntegrity ?? true,
      selfIntegrityIntervalMs: config.selfIntegrityIntervalMs || 10000, // 10s default
    };
  }

  /**
   * Start watcher daemon
   */
  async start(): Promise<void> {
    console.log('\n🛡️  WATCHER DAEMON STARTING...');
    console.log(`   Mode: ${this.config.mode.toUpperCase()}`);
    console.log(`   LLM Guard: ${this.config.enableLLMGuard ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Root: ${this.rootDir}`);

    // Check if already running
    if (this.isRunning()) {
      console.log('⚠️  Watcher daemon already running (PIDs in .watcher-daemon.pid)');
      return;
    }

    // 1️⃣ COPIE SIGNATURES D'INTÉGRITÉ (Baseline Backup)
    if (this.config.baselineBackup) {
      this.backupBaseline();
    }

    // 2️⃣ LANCER INTEGRITY WATCHER (Background Daemon)
    await this.startIntegrityWatcher();

    // 3️⃣ LANCER LLM GUARD (Background Daemon) - Optionnel
    if (this.config.enableLLMGuard && this.config.llmApiKey) {
      await this.startLLMGuard();
    }

    // 4️⃣ LANCER CONTINUOUS SELF-INTEGRITY MONITOR (ChatGPT fix)
    if (this.config.enableContinuousSelfIntegrity) {
      this.selfIntegrityMonitor = new ContinuousSelfIntegrityMonitor(this.config.selfIntegrityIntervalMs);
      this.selfIntegrityMonitor.start();
      console.log(`✅ Continuous self-integrity monitor started (every ${this.config.selfIntegrityIntervalMs / 1000}s)`);
    }

    // 5️⃣ SAVE PIDs
    this.savePids();

    console.log('\n✅ WATCHER DAEMON STARTED');
    console.log('   Les watchers continuent en arrière-plan même après exit de grokinou');
    if (this.config.enableContinuousSelfIntegrity) {
      console.log('   Self-integrity monitoring: ACTIVE');
    }
    console.log('   Pour arrêter: npm run watcher:stop');
    console.log('   Pour status: npm run watcher:status');
    console.log('');
  }

  /**
   * Stop watcher daemon
   */
  stop(): void {
    console.log('\n🛑 WATCHER DAEMON STOPPING...');

    const pids = this.loadPids();
    
    if (pids.integrityWatcher) {
      try {
        process.kill(pids.integrityWatcher, 'SIGTERM');
        console.log(`✅ Stopped Integrity Watcher (PID ${pids.integrityWatcher})`);
      } catch (error) {
        console.log(`⚠️  Integrity Watcher (PID ${pids.integrityWatcher}) not found`);
      }
    }

    if (pids.llmGuard) {
      try {
        process.kill(pids.llmGuard, 'SIGTERM');
        console.log(`✅ Stopped LLM Guard (PID ${pids.llmGuard})`);
      } catch (error) {
        console.log(`⚠️  LLM Guard (PID ${pids.llmGuard}) not found`);
      }
    }

    // 🔧 FIX: Stop continuous self-integrity monitor (ChatGPT feedback)
    if (this.selfIntegrityMonitor) {
      this.selfIntegrityMonitor.stop();
      console.log('✅ Stopped Continuous Self-Integrity Monitor');
      this.selfIntegrityMonitor = null;
    }

    // Remove PID file
    if (existsSync(this.pidFile)) {
      unlinkSync(this.pidFile);
    }

    console.log('✅ WATCHER DAEMON STOPPED\n');
  }

  /**
   * Check daemon status
   */
  status(): void {
    const pids = this.loadPids();
    
    console.log('\n📊 WATCHER DAEMON STATUS:\n');

    if (!pids.integrityWatcher && !pids.llmGuard) {
      console.log('❌ Daemon NOT running');
      console.log('   Start with: npm run watcher:start\n');
      return;
    }

    // Check Integrity Watcher
    if (pids.integrityWatcher) {
      const running = this.isProcessRunning(pids.integrityWatcher);
      console.log(`${running ? '✅' : '❌'} Integrity Watcher (PID ${pids.integrityWatcher}): ${running ? 'RUNNING' : 'STOPPED'}`);
    } else {
      console.log('❌ Integrity Watcher: NOT STARTED');
    }

    // Check LLM Guard
    if (pids.llmGuard) {
      const running = this.isProcessRunning(pids.llmGuard);
      console.log(`${running ? '✅' : '❌'} LLM Guard (PID ${pids.llmGuard}): ${running ? 'RUNNING' : 'STOPPED'}`);
    } else {
      console.log('❌ LLM Guard: NOT STARTED');
    }

    // 🔧 FIX: Show continuous self-integrity monitor status (ChatGPT feedback)
    if (this.selfIntegrityMonitor) {
      console.log('✅ Continuous Self-Integrity Monitor: RUNNING');
    } else {
      console.log('❌ Continuous Self-Integrity Monitor: NOT STARTED');
    }

    console.log('\nCommands:');
    console.log('  View alerts: npm run watch:alerts');
    console.log('  View logs:   npm run guard:logs');
    console.log('  Stop daemon: npm run watcher:stop');
    console.log('');
  }

  /**
   * Backup baseline (signatures d'intégrité)
   */
  private backupBaseline(): void {
    const baselineFile = join(this.rootDir, '.integrity-baseline.json');
    
    if (!existsSync(baselineFile)) {
      console.log('⚠️  No baseline found, creating new one...');
      // Baseline will be created by Integrity Watcher on first run
      return;
    }

    // Create backups directory
    const backupDir = join(this.rootDir, '.integrity-backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    // Backup with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = join(backupDir, `baseline-${timestamp}.json`);
    
    try {
      copyFileSync(baselineFile, backupFile);
      console.log(`✅ Baseline backed up: ${backupFile}`);
      
      // Keep only last 10 backups
      this.cleanupOldBackups(backupDir);
    } catch (error) {
      console.error(`❌ Failed to backup baseline:`, error);
    }
  }

  /**
   * Clean up old backups (keep last 10)
   */
  private cleanupOldBackups(backupDir: string): void {
    try {
      const { readdirSync, statSync } = require('fs');
      const files = readdirSync(backupDir)
        .filter((f: string) => f.startsWith('baseline-') && f.endsWith('.json'))
        .map((f: string) => ({
          name: f,
          path: join(backupDir, f),
          time: statSync(join(backupDir, f)).mtime.getTime(),
        }))
        .sort((a: any, b: any) => b.time - a.time);

      // Remove old backups (keep last 10)
      if (files.length > 10) {
        files.slice(10).forEach((f: any) => {
          unlinkSync(f.path);
        });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Start Integrity Watcher in background
   */
  private async startIntegrityWatcher(): Promise<void> {
    console.log('🔄 Starting Integrity Watcher (background daemon)...');

    const tsxPath = join(this.rootDir, 'node_modules', '.bin', 'tsx');
    const watcherPath = join(this.rootDir, 'src', 'security', 'watcher-cli.ts');

    const args = ['--mode', this.config.mode];

    const child = spawn(tsxPath, [watcherPath, ...args], {
      detached: true,
      stdio: 'ignore',
      cwd: this.rootDir,
      env: {
        ...process.env,
        WATCHER_DAEMON: 'true', // Signal that we're running as daemon
      },
    });

    child.unref(); // Allow parent to exit

    this.integrityWatcherPid = child.pid || null;

    if (this.integrityWatcherPid) {
      console.log(`✅ Integrity Watcher started (PID ${this.integrityWatcherPid})`);
    } else {
      console.error('❌ Failed to start Integrity Watcher');
    }
  }

  /**
   * Start LLM Guard in background
   */
  private async startLLMGuard(): Promise<void> {
    console.log('🔄 Starting LLM Guard (background daemon)...');

    const tsxPath = join(this.rootDir, 'node_modules', '.bin', 'tsx');
    const guardPath = join(this.rootDir, 'src', 'security', 'llm-guard-cli.ts');

    const child = spawn(tsxPath, [guardPath], {
      detached: true,
      stdio: 'ignore',
      cwd: this.rootDir,
      env: {
        ...process.env,
        GROK_API_KEY: this.config.llmApiKey,
        WATCHER_DAEMON: 'true',
      },
    });

    child.unref(); // Allow parent to exit

    this.llmGuardPid = child.pid || null;

    if (this.llmGuardPid) {
      console.log(`✅ LLM Guard started (PID ${this.llmGuardPid})`);
    } else {
      console.error('❌ Failed to start LLM Guard');
    }
  }

  /**
   * Save PIDs to file
   */
  private savePids(): void {
    const pids = {
      integrityWatcher: this.integrityWatcherPid,
      llmGuard: this.llmGuardPid,
      timestamp: new Date().toISOString(),
    };

    writeFileSync(this.pidFile, JSON.stringify(pids, null, 2));
  }

  /**
   * Load PIDs from file
   */
  private loadPids(): { integrityWatcher: number | null; llmGuard: number | null } {
    if (!existsSync(this.pidFile)) {
      return { integrityWatcher: null, llmGuard: null };
    }

    try {
      const data = JSON.parse(readFileSync(this.pidFile, 'utf-8'));
      return {
        integrityWatcher: data.integrityWatcher || null,
        llmGuard: data.llmGuard || null,
      };
    } catch {
      return { integrityWatcher: null, llmGuard: null };
    }
  }

  /**
   * Check if daemon is running
   */
  private isRunning(): boolean {
    const pids = this.loadPids();
    
    const integrityRunning = pids.integrityWatcher ? this.isProcessRunning(pids.integrityWatcher) : false;
    const llmRunning = pids.llmGuard ? this.isProcessRunning(pids.llmGuard) : false;

    return integrityRunning || llmRunning;
  }

  /**
   * Check if process is running
   */
  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0); // Signal 0 = test if process exists
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Auto-start watcher daemon if GROK_AUTO_WATCHER=true
 */
export async function autoStartWatcher(rootDir: string): Promise<void> {
  // Check if auto-start is enabled
  const autoStart = process.env.GROK_AUTO_WATCHER === 'true' || process.env.GROK_AUTO_WATCHER === '1';
  
  if (!autoStart) {
    return;
  }

  const daemon = new WatcherDaemon(rootDir, {
    mode: (process.env.GROK_WATCHER_MODE as any) || 'dual',
    enableLLMGuard: process.env.GROK_LLM_GUARD !== 'false',
    llmApiKey: process.env.GROK_API_KEY,
    baselineBackup: true,
    autoStart: true,
    // 🔧 FIX: Support ENV for continuous self-integrity (ChatGPT feedback)
    enableContinuousSelfIntegrity: process.env.GROK_CONTINUOUS_SELF_INTEGRITY !== 'false', // Default: true
    selfIntegrityIntervalMs: parseInt(process.env.GROK_SELF_INTEGRITY_INTERVAL || '10000'),
  });

  await daemon.start();
}

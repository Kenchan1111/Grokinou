/**
 * 🤖 LLM GUARD - Intelligent Surveillance System
 * 
 * CONCEPT:
 * Le LLM Guard est un "gardien intelligent" qui surveille le système
 * en complément du watcher heuristique. Il utilise un LLM pour détecter
 * des patterns complexes et des comportements suspects que les signatures
 * cryptographiques ne peuvent pas identifier.
 * 
 * DIFFÉRENCES AVEC INTEGRITY WATCHER:
 * 
 * Integrity Watcher (Heuristique):
 * - Détecte modifications de contenu (hash SHA-256)
 * - Patterns malveillants fixes (regex)
 * - Rapide (< 1ms)
 * - Déterministe
 * 
 * LLM Guard (Intelligent):
 * - Détecte remplacements de fichiers (inode changes)
 * - Détecte copies de fichiers (nouveaux fichiers identiques)
 * - Détecte mouvements suspects
 * - Analyse comportementale contextuelle
 * - Comprend les intentions
 * - Non-déterministe (LLM reasoning)
 * 
 * MODE ACTUEL: "Love Watching"
 * - Observation passive
 * - Logging exhaustif
 * - Pas d'intervention (pour l'instant)
 * 
 * MODE FUTUR: "Active Reviewer"
 * - Analyse active
 * - Décisions d'intervention
 * - Restauration automatique
 */

import chokidar, { FSWatcher } from 'chokidar';
import { stat, readFileSync, existsSync } from 'fs';
import { promisify } from 'util';
import { join, relative, basename, dirname } from 'path';
import { exec } from 'child_process';
import { GrokClient, GrokMessage } from '../grok/client.js';
import { createHash } from 'crypto';

const statAsync = promisify(stat);
const execAsync = promisify(exec);

// 🎯 ÉVÉNEMENTS SURVEILLÉS
interface FileEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  timestamp: Date;
  stats?: {
    size: number;
    inode: number;
    mtime: Date;
    ctime: Date;
    mode: number;
  };
  hash?: string;
}

// 📊 ANALYSE LLM
interface LLMAnalysis {
  timestamp: Date;
  events: FileEvent[];
  suspicionLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  detectedPatterns: string[];
  recommendations: string[];
  confidence: number; // 0-100
}

// 🔍 DÉTECTION AVANCÉE
interface AdvancedDetection {
  type: 'file_replaced' | 'file_copied' | 'suspicious_timing' | 'mass_operation' | 'hidden_operation';
  description: string;
  evidence: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// 📝 LOG ENTRY
interface GuardLog {
  timestamp: Date;
  category: 'observation' | 'detection' | 'analysis' | 'alert';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data?: any;
}

export interface LLMGuardConfig {
  llmApiKey: string;
  llmModel?: string;
  llmBaseURL?: string;
  watchPatterns?: string[];
  analysisInterval?: number; // ms between LLM analysis
  logFile?: string;
  integrityWatcherAlertsFile?: string;
  mode?: 'love-watching' | 'active-reviewer';
}

export class LLMGuard {
  private watcher: FSWatcher | null = null;
  private llmClient: GrokClient;
  private config: Required<LLMGuardConfig>;
  private rootDir: string;
  private isRunning: boolean = false;
  
  // 📊 State tracking
  private eventBuffer: FileEvent[] = [];
  private fileInodes: Map<string, number> = new Map(); // Track inodes to detect replacements
  private fileHashes: Map<string, string> = new Map(); // Track hashes to detect copies
  private logs: GuardLog[] = [];
  private lastAnalysisTime: number = 0;
  
  // 📈 Statistics
  private stats = {
    eventsObserved: 0,
    filesReplaced: 0,
    filesCopied: 0,
    llmAnalyses: 0,
    alertsGenerated: 0,
  };

  constructor(rootDir: string, config: LLMGuardConfig) {
    this.rootDir = rootDir;
    
    // 🔧 FIX: Restrict watch patterns to relevant directories (ChatGPT feedback)
    const DEFAULT_WATCH_PATTERNS = [
      'src/**/*',
      'dist/**/*',
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      '.env',
      '.env.example',
      'scripts/**/*',
    ];
    
    this.config = {
      llmApiKey: config.llmApiKey,
      llmModel: config.llmModel || 'grok-2-1212',
      llmBaseURL: config.llmBaseURL || 'https://api.x.ai/v1',
      watchPatterns: config.watchPatterns || DEFAULT_WATCH_PATTERNS, // ✅ Plus ciblé
      analysisInterval: config.analysisInterval || 30000, // 30s default
      logFile: config.logFile || join(rootDir, '.llm-guard-logs.json'),
      integrityWatcherAlertsFile: config.integrityWatcherAlertsFile || join(rootDir, '.integrity-alerts.json'),
      mode: config.mode || 'love-watching',
    };

    this.llmClient = new GrokClient(
      this.config.llmApiKey,
      this.config.llmModel,
      this.config.llmBaseURL
    );
  }

  /**
   * Start LLM Guard surveillance
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️  LLM Guard already running');
      return;
    }

    console.log('\n🤖 LLM GUARD STARTING...');
    console.log(`   Mode: ${this.config.mode.toUpperCase()}`);
    console.log(`   LLM Model: ${this.config.llmModel}`);
    console.log(`   Analysis Interval: ${this.config.analysisInterval}ms`);
    console.log(`   Root: ${this.rootDir}`);

    // Watch filesystem
    const patterns = this.config.watchPatterns.map(p => join(this.rootDir, p));
    
    // 🔧 FIX: Ignore heavy/irrelevant directories (ChatGPT feedback)
    this.watcher = chokidar.watch(patterns, {
      persistent: true,
      ignoreInitial: false, // We want to see initial state
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.integrity-*',
        '**/.llm-guard-*',
        '**/.watcher-daemon.pid',
        '**/.security-integrity-failure.json',
        '**/dist/**/*.map', // Ignore source maps
      ],
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
      alwaysStat: true, // Get stats for every event
    });

    // Event handlers
    this.watcher.on('add', (path, stats) => this.onFileAdd(path, stats));
    this.watcher.on('change', (path, stats) => this.onFileChange(path, stats));
    this.watcher.on('unlink', (path) => this.onFileUnlink(path));
    this.watcher.on('addDir', (path, stats) => this.onDirAdd(path, stats));
    this.watcher.on('unlinkDir', (path) => this.onDirUnlink(path));

    // Start periodic LLM analysis
    this.startPeriodicAnalysis();

    this.isRunning = true;
    console.log('✅ LLM Guard is now watching...\n');
  }

  /**
   * Stop LLM Guard
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.isRunning = false;
    console.log('\n🛑 LLM Guard stopped');
    this.printStatistics();
  }

  /**
   * Handle file add event
   */
  private async onFileAdd(path: string, stats?: any): Promise<void> {
    const relPath = relative(this.rootDir, path);
    
    try {
      const fileStats = stats || await statAsync(path);
      const hash = this.calculateHash(path);
      
      const event: FileEvent = {
        type: 'add',
        path: relPath,
        timestamp: new Date(),
        stats: {
          size: fileStats.size,
          inode: fileStats.ino,
          mtime: fileStats.mtime,
          ctime: fileStats.ctime,
          mode: fileStats.mode,
        },
        hash,
      };

      this.eventBuffer.push(event);
      this.stats.eventsObserved++;

      // Track inode and hash
      this.fileInodes.set(relPath, fileStats.ino);
      this.fileHashes.set(relPath, hash);

      // 🔍 DETECTION: Check if this is a COPY of another file
      const copyDetection = this.detectFileCopy(relPath, hash);
      if (copyDetection) {
        this.log('detection', 'warning', 
          `File copy detected: ${relPath} is identical to ${copyDetection.original}`,
          copyDetection
        );
        this.stats.filesCopied++;
      }

      this.log('observation', 'info', `File added: ${relPath}`, {
        size: fileStats.size,
        inode: fileStats.ino,
      });

    } catch (error: any) {
      this.log('observation', 'warning', `Failed to process add event for ${relPath}: ${error.message}`);
    }
  }

  /**
   * Handle file change event
   */
  private async onFileChange(path: string, stats?: any): Promise<void> {
    const relPath = relative(this.rootDir, path);
    
    try {
      const fileStats = stats || await statAsync(path);
      const hash = this.calculateHash(path);
      const oldInode = this.fileInodes.get(relPath);
      const oldHash = this.fileHashes.get(relPath);

      const event: FileEvent = {
        type: 'change',
        path: relPath,
        timestamp: new Date(),
        stats: {
          size: fileStats.size,
          inode: fileStats.ino,
          mtime: fileStats.mtime,
          ctime: fileStats.ctime,
          mode: fileStats.mode,
        },
        hash,
      };

      this.eventBuffer.push(event);
      this.stats.eventsObserved++;

      // 🔍 DETECTION CRITIQUE: Inode change = FILE REPLACED, not modified!
      if (oldInode !== undefined && oldInode !== fileStats.ino) {
        this.log('detection', 'critical',
          `🚨 FILE REPLACED (not modified): ${relPath}`,
          {
            oldInode,
            newInode: fileStats.ino,
            oldHash,
            newHash: hash,
            explanation: 'Inode changed - file was replaced by another file, not modified in-place',
          }
        );
        this.stats.filesReplaced++;
        this.stats.alertsGenerated++;
      }

      // Update tracking
      this.fileInodes.set(relPath, fileStats.ino);
      this.fileHashes.set(relPath, hash);

      this.log('observation', 'info', `File changed: ${relPath}`, {
        oldHash: oldHash?.substring(0, 8),
        newHash: hash.substring(0, 8),
        inodeChanged: oldInode !== fileStats.ino,
      });

    } catch (error: any) {
      this.log('observation', 'warning', `Failed to process change event for ${relPath}: ${error.message}`);
    }
  }

  /**
   * Handle file unlink event
   */
  private async onFileUnlink(path: string): Promise<void> {
    const relPath = relative(this.rootDir, path);
    
    const event: FileEvent = {
      type: 'unlink',
      path: relPath,
      timestamp: new Date(),
    };

    this.eventBuffer.push(event);
    this.stats.eventsObserved++;

    // Clean up tracking
    this.fileInodes.delete(relPath);
    this.fileHashes.delete(relPath);

    this.log('observation', 'info', `File removed: ${relPath}`);
  }

  /**
   * Handle directory add event
   */
  private async onDirAdd(path: string, stats?: any): Promise<void> {
    const relPath = relative(this.rootDir, path);
    
    const event: FileEvent = {
      type: 'addDir',
      path: relPath,
      timestamp: new Date(),
    };

    this.eventBuffer.push(event);
    this.stats.eventsObserved++;

    this.log('observation', 'info', `Directory added: ${relPath}`);
  }

  /**
   * Handle directory unlink event
   */
  private async onDirUnlink(path: string): Promise<void> {
    const relPath = relative(this.rootDir, path);
    
    const event: FileEvent = {
      type: 'unlinkDir',
      path: relPath,
      timestamp: new Date(),
    };

    this.eventBuffer.push(event);
    this.stats.eventsObserved++;

    this.log('observation', 'info', `Directory removed: ${relPath}`);
  }

  /**
   * Calculate SHA-256 hash of file
   */
  private calculateHash(filePath: string): string {
    try {
      const content = readFileSync(filePath);
      return createHash('sha256').update(content).digest('hex');
    } catch {
      return '';
    }
  }

  /**
   * 🔍 ADVANCED DETECTION: Detect if a file is a copy of another
   */
  private detectFileCopy(newFile: string, newHash: string): { original: string; hash: string } | null {
    for (const [file, hash] of this.fileHashes.entries()) {
      if (file !== newFile && hash === newHash) {
        return { original: file, hash };
      }
    }
    return null;
  }

  /**
   * Start periodic LLM analysis
   */
  private startPeriodicAnalysis(): void {
    setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.performLLMAnalysis().catch(error => {
          this.log('analysis', 'warning', `LLM analysis failed: ${error.message}`);
        });
      }
    }, this.config.analysisInterval);
  }

  /**
   * 🤖 Perform LLM analysis of recent events
   */
  private async performLLMAnalysis(): Promise<void> {
    const now = Date.now();
    if (now - this.lastAnalysisTime < this.config.analysisInterval) {
      return; // Too soon
    }

    const eventsToAnalyze = [...this.eventBuffer];
    this.eventBuffer = []; // Clear buffer
    this.lastAnalysisTime = now;

    if (eventsToAnalyze.length === 0) {
      return;
    }

    this.log('analysis', 'info', `Starting LLM analysis of ${eventsToAnalyze.length} events...`);

    try {
      // Read integrity watcher alerts if available
      const integrityAlerts = this.readIntegrityWatcherAlerts();

      // Build analysis prompt
      const prompt = this.buildAnalysisPrompt(eventsToAnalyze, integrityAlerts);

      // Call LLM
      const messages: GrokMessage[] = [
        { role: 'user', content: prompt }
      ];

      const response = await this.llmClient.chat(
        messages,
        [],
        undefined,
        { search_parameters: { mode: 'off' } }
      );

      const analysis = response.choices[0]?.message?.content || '';

      // Parse LLM response
      const parsedAnalysis = this.parseLLMAnalysis(analysis, eventsToAnalyze);

      // Log analysis
      this.log('analysis', 
        parsedAnalysis.suspicionLevel === 'critical' ? 'critical' : 'info',
        `LLM Analysis Complete`,
        parsedAnalysis
      );

      this.stats.llmAnalyses++;

      if (parsedAnalysis.suspicionLevel === 'high' || parsedAnalysis.suspicionLevel === 'critical') {
        this.stats.alertsGenerated++;
        console.log(`\n🚨 LLM GUARD ALERT [${parsedAnalysis.suspicionLevel.toUpperCase()}]`);
        console.log(`   Suspicion: ${parsedAnalysis.suspicionLevel}`);
        console.log(`   Confidence: ${parsedAnalysis.confidence}%`);
        console.log(`   Reasoning: ${parsedAnalysis.reasoning}`);
        if (parsedAnalysis.detectedPatterns.length > 0) {
          console.log(`   Patterns: ${parsedAnalysis.detectedPatterns.join(', ')}`);
        }
        console.log('');
      }

    } catch (error: any) {
      this.log('analysis', 'warning', `LLM analysis error: ${error.message}`);
    }
  }

  /**
   * Build prompt for LLM analysis
   */
  private buildAnalysisPrompt(events: FileEvent[], integrityAlerts: any[]): string {
    const eventsSummary = events.map(e => {
      const statsStr = e.stats 
        ? `size=${e.stats.size}, inode=${e.stats.inode}, mtime=${e.stats.mtime.toISOString()}`
        : '';
      return `${e.type.toUpperCase()}: ${e.path} (${statsStr})`;
    }).join('\n');

    const alertsSummary = integrityAlerts.length > 0
      ? `\nIntegrity Watcher Alerts (last ${integrityAlerts.length}):\n${integrityAlerts.map(a => 
          `- [${a.severity}] ${a.file}: ${a.description}`
        ).join('\n')}`
      : '\nIntegrity Watcher: No recent alerts';

    return `🤖 LLM GUARD - Surveillance Analysis

You are an intelligent security guard monitoring a COMPROMISED SYSTEM.

CONTEXT:
- Adversaries have access to the filesystem
- They modify, replace, and copy files to sabotage work
- Your job: Detect suspicious patterns and behaviors

RECENT FILESYSTEM EVENTS (${events.length} events):
${eventsSummary}

${alertsSummary}

DETECTION GUIDELINES:
1. **File Replacements**: Inode changes indicate file was REPLACED (not modified)
2. **Mass Operations**: Multiple files changed in short time = suspicious
3. **Suspicious Timing**: Files changed during unusual hours
4. **Hidden Operations**: Operations on hidden files (.git, .config, etc.)
5. **Correlation**: Events that happen together (e.g., file deleted + identical file added elsewhere)

YOUR TASK:
Analyze these events and provide:

1. **SUSPICION_LEVEL**: none | low | medium | high | critical
2. **CONFIDENCE**: 0-100 (how confident are you?)
3. **REASONING**: Why is this suspicious or not? (2-3 sentences)
4. **DETECTED_PATTERNS**: List specific patterns you detected (comma-separated)
5. **RECOMMENDATIONS**: What should be done? (1-2 actions)

RESPOND IN THIS EXACT FORMAT:
SUSPICION_LEVEL: [level]
CONFIDENCE: [0-100]
REASONING: [your reasoning]
DETECTED_PATTERNS: [pattern1, pattern2, ...]
RECOMMENDATIONS: [action1, action2, ...]

Be thorough but concise. Focus on detecting SABOTAGE attempts.`;
  }

  /**
   * Parse LLM analysis response
   */
  private parseLLMAnalysis(response: string, events: FileEvent[]): LLMAnalysis {
    const suspicionMatch = response.match(/SUSPICION_LEVEL:\s*(none|low|medium|high|critical)/i);
    const confidenceMatch = response.match(/CONFIDENCE:\s*(\d+)/);
    const reasoningMatch = response.match(/REASONING:\s*([^\n]+(?:\n(?!DETECTED_PATTERNS|RECOMMENDATIONS)[^\n]+)*)/i);
    const patternsMatch = response.match(/DETECTED_PATTERNS:\s*([^\n]+)/i);
    const recommendationsMatch = response.match(/RECOMMENDATIONS:\s*([^\n]+(?:\n(?!$)[^\n]+)*)/i);

    return {
      timestamp: new Date(),
      events,
      suspicionLevel: (suspicionMatch?.[1]?.toLowerCase() as any) || 'none',
      confidence: parseInt(confidenceMatch?.[1] || '50'),
      reasoning: reasoningMatch?.[1]?.trim() || 'No reasoning provided',
      detectedPatterns: patternsMatch?.[1]?.split(',').map(p => p.trim()).filter(p => p) || [],
      recommendations: recommendationsMatch?.[1]?.split('\n').map(r => r.trim()).filter(r => r) || [],
    };
  }

  /**
   * Read integrity watcher alerts
   */
  private readIntegrityWatcherAlerts(): any[] {
    try {
      if (!existsSync(this.config.integrityWatcherAlertsFile)) {
        return [];
      }
      const content = readFileSync(this.config.integrityWatcherAlertsFile, 'utf-8');
      const alerts = JSON.parse(content);
      return alerts.slice(-10); // Last 10 alerts
    } catch {
      return [];
    }
  }

  /**
   * Log event
   */
  private log(category: GuardLog['category'], severity: GuardLog['severity'], message: string, data?: any): void {
    const logEntry: GuardLog = {
      timestamp: new Date(),
      category,
      severity,
      message,
      data,
    };

    this.logs.push(logEntry);

    // Console output for important events
    if (severity === 'critical') {
      console.error(`🚨 [${category.toUpperCase()}] ${message}`);
    } else if (severity === 'warning') {
      console.warn(`⚠️  [${category.toUpperCase()}] ${message}`);
    } else {
      console.log(`ℹ️  [${category.toUpperCase()}] ${message}`);
    }

    // Save logs periodically
    if (this.logs.length % 10 === 0) {
      this.saveLogs();
    }
  }

  /**
   * Save logs to file
   */
  private saveLogs(): void {
    try {
      const fs = require('fs');
      fs.writeFileSync(
        this.config.logFile,
        JSON.stringify(this.logs, null, 2)
      );
    } catch (error: any) {
      console.error(`Failed to save logs: ${error.message}`);
    }
  }

  /**
   * Get all logs
   */
  getLogs(): GuardLog[] {
    return [...this.logs];
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this.stats };
  }

  /**
   * Print statistics
   */
  private printStatistics(): void {
    console.log('\n📊 LLM GUARD STATISTICS:');
    console.log(`   Events observed: ${this.stats.eventsObserved}`);
    console.log(`   Files replaced: ${this.stats.filesReplaced}`);
    console.log(`   Files copied: ${this.stats.filesCopied}`);
    console.log(`   LLM analyses: ${this.stats.llmAnalyses}`);
    console.log(`   Alerts generated: ${this.stats.alertsGenerated}`);
    console.log('');
  }
}

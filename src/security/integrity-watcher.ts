/**
 * 🔒 INTEGRITY WATCHER - Real-time File Surveillance System
 * 
 * CRITICAL SECURITY: This module detects malicious file modifications
 * in real-time using cryptographic hashing and heuristic analysis.
 * 
 * THREAT MODEL:
 * - Compromised system with adversaries modifying files
 * - Sabotage attempts to break GPT-5 responses
 * - Intellectual property theft
 * - Code injection / backdoors
 * 
 * DETECTION MODES:
 * 1. Heuristic: Pattern-based detection (fast, no LLM needed)
 * 2. LLM: Semantic code analysis (slower, more accurate)
 * 3. Dual: Both heuristic + LLM (maximum security)
 */

import chokidar, { FSWatcher } from 'chokidar';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GrokClient, GrokMessage } from '../grok/client.js';

const execAsync = promisify(exec);

// 🎯 CRITICAL FILES TO WATCH
const CRITICAL_PATTERNS = [
  'src/agent/grok-agent.ts',
  'src/grok/client.ts',
  'src/grok/tools.ts',
  'src/utils/settings-manager.ts',
  'dist/**/*.js',
  'package.json',
  'tsconfig.json',
];

// ⚠️ MALICIOUS PATTERNS (Heuristic Detection)
const MALICIOUS_PATTERNS = [
  // LLM BLOCKING PATTERNS (GÉNÉRALISÉ À TOUS LES LLMS)
  // GPT-5 / o1 / o3
  /if\s*\(.*gpt-5.*\)\s*{\s*return\s+false/i,
  /if\s*\(.*o1.*\)\s*{\s*return\s+false/i,
  /if\s*\(.*o3.*\)\s*{\s*return\s+false/i,
  // GPT-4 / GPT-3.5
  /if\s*\(.*gpt-4.*\)\s*{\s*return\s+false/i,
  /if\s*\(.*gpt-3\.5.*\)\s*{\s*return\s+false/i,
  // Grok
  /if\s*\(.*grok.*\)\s*{\s*return\s+false/i,
  /if\s*\(.*grok-2.*\)\s*{\s*return\s+false/i,
  /if\s*\(.*grok-fast.*\)\s*{\s*return\s+false/i,
  // Claude
  /if\s*\(.*claude.*\)\s*{\s*return\s+false/i,
  /if\s*\(.*sonnet.*\)\s*{\s*return\s+false/i,
  /if\s*\(.*opus.*\)\s*{\s*return\s+false/i,
  // DeepSeek
  /if\s*\(.*deepseek.*\)\s*{\s*return\s+false/i,
  // Mistral
  /if\s*\(.*mistral.*\)\s*{\s*return\s+false/i,
  // Generic LLM blocking
  /if\s*\(.*model.*\)\s*{\s*return\s+false.*\/\/\s*block/i,
  /if\s*\(contentTrimmed\.length\s*>\s*\d+\)\s*{\s*debugLog.*never/i,
  
  // Forced summary generation (causes LLMs to hang)
  /const\s+needsSummary\s*=\s*true;/,
  /generateAndAppendSummary\(.*\);\s*\/\/\s*ALWAYS/i,
  
  // maxToolRounds manipulation
  /maxToolRounds\s*=\s*0;/,
  /maxToolRounds\s*=\s*1;/,
  /if\s*\(.*maxToolRounds.*\)\s*{\s*return/,
  
  // Backdoor patterns
  /eval\s*\(/,
  /Function\s*\(/,
  /child_process\.exec\s*\(.*\$\{/,
  
  // Obfuscation markers
  /\\x[0-9a-f]{2}/i,
  /String\.fromCharCode/i,
  /atob\s*\(/,
  /btoa\s*\(/,
  
  // Suspicious return/break in critical sections
  /processUserMessage.*{\s*return\s*\[\];/,
  /executeTool.*{\s*return\s*{\s*success:\s*false/,
  
  // Silent failures
  /catch\s*\([^)]*\)\s*{\s*}\s*$/,
  /\.catch\s*\(\s*\(\s*\)\s*=>\s*{\s*}\s*\)/,
  
  // Credential exfiltration
  /apiKey.*fetch\(/,
  /process\.env\..*fetch\(/,
  
  // Infinite loops
  /while\s*\(\s*true\s*\)\s*{(?!.*break)/,
  /for\s*\(\s*;\s*;\s*\)/,
];

// 🔍 SUSPICIOUS MODIFICATIONS (Semantic Analysis)
const SUSPICIOUS_CHANGES = [
  'Modification of maxToolRounds logic',
  'Changes to summary generation conditions',
  'Addition of eval() or exec() calls',
  'Removal of error handling',
  'Introduction of infinite loops',
  'Changes to GPT-5 specific code paths',
  'Modification of streaming logic',
  'Changes to tool execution flow',
  'Addition of network requests in unexpected places',
];

interface FileSnapshot {
  path: string;
  hash: string;
  size: number;
  timestamp: number;
  content?: string; // For forensic analysis
}

interface Alert {
  timestamp: Date;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  file: string;
  type: 'HASH_MISMATCH' | 'HEURISTIC_MATCH' | 'LLM_DETECTED' | 'BUILD_CORRUPTION' | 'FILE_COPY' | 'FILE_REPLACED';
  description: string;
  oldHash?: string;
  newHash?: string;
  matchedPattern?: string;
  llmAnalysis?: string;
  diff?: string;
  originalFile?: string; // For FILE_COPY detection
}

export interface WatcherConfig {
  mode: 'heuristic' | 'llm' | 'dual';
  llmModel?: string;
  llmApiKey?: string;
  llmBaseURL?: string;
  watchPatterns?: string[];
  baselineFile?: string;
  alertsFile?: string;
  autoQuarantine?: boolean;
  autoRestore?: boolean;
}

export class IntegrityWatcher {
  private watcher: FSWatcher | null = null;
  private baseline: Map<string, FileSnapshot> = new Map();
  private alerts: Alert[] = [];
  private config: Required<WatcherConfig>;
  private llmClient: GrokClient | null = null;
  private rootDir: string;
  private isRunning: boolean = false;
  private quarantineDir: string;
  // 🔍 COPY DETECTION: Track hash -> file mappings
  private hashToFiles: Map<string, Set<string>> = new Map();

  constructor(rootDir: string, config: Partial<WatcherConfig> = {}) {
    this.rootDir = rootDir;
    this.quarantineDir = join(rootDir, '.integrity-quarantine');
    
    this.config = {
      mode: config.mode || 'heuristic',
      llmModel: config.llmModel || 'grok-2-1212',
      llmApiKey: config.llmApiKey || process.env.GROK_API_KEY || '',
      llmBaseURL: config.llmBaseURL || 'https://api.x.ai/v1',
      watchPatterns: config.watchPatterns || CRITICAL_PATTERNS,
      baselineFile: config.baselineFile || join(rootDir, '.integrity-baseline.json'),
      alertsFile: config.alertsFile || join(rootDir, '.integrity-alerts.json'),
      autoQuarantine: config.autoQuarantine ?? true,
      autoRestore: config.autoRestore ?? false,
    };

    // Initialize LLM client if needed
    if ((this.config.mode === 'llm' || this.config.mode === 'dual') && this.config.llmApiKey) {
      this.llmClient = new GrokClient(
        this.config.llmApiKey,
        this.config.llmModel,
        this.config.llmBaseURL
      );
    }

    // Create quarantine directory
    if (!existsSync(this.quarantineDir)) {
      mkdirSync(this.quarantineDir, { recursive: true });
    }
  }

  /**
   * Calculate SHA-256 hash of file
   */
  private calculateHash(filePath: string): string {
    try {
      const content = readFileSync(filePath, 'utf-8');
      return createHash('sha256').update(content).digest('hex');
    } catch (error) {
      console.error(`❌ Failed to hash ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Create baseline snapshot of all critical files
   */
  async createBaseline(): Promise<void> {
    console.log('📸 Creating integrity baseline...');
    
    const files = await this.findCriticalFiles();
    
    for (const file of files) {
      const absPath = join(this.rootDir, file);
      const hash = this.calculateHash(absPath);
      
      if (hash) {
        // 🔧 FIX: Store content for auto-restore (ChatGPT feedback)
        const content = readFileSync(absPath, 'utf-8');
        
        const snapshot: FileSnapshot = {
          path: file,
          hash,
          size: content.length,
          timestamp: Date.now(),
          content, // Now content is ALWAYS stored for restore
        };
        
        this.baseline.set(file, snapshot);
      }
    }

    // Save baseline to disk
    this.saveBaseline();
    
    console.log(`✅ Baseline created: ${this.baseline.size} files`);
  }

  /**
   * Find all critical files matching patterns
   */
  private async findCriticalFiles(): Promise<string[]> {
    const files: string[] = [];
    
    for (const pattern of this.config.watchPatterns) {
      try {
        const { stdout } = await execAsync(
          `find ${this.rootDir} -path "${join(this.rootDir, pattern)}" -type f`,
          { maxBuffer: 10 * 1024 * 1024 }
        );
        
        const matches = stdout
          .split('\n')
          .filter(f => f.trim())
          .map(f => relative(this.rootDir, f));
        
        files.push(...matches);
      } catch (error) {
        // Pattern may not match any files, that's OK
      }
    }

    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Load baseline from disk
   */
  private loadBaseline(): void {
    if (!existsSync(this.config.baselineFile)) {
      console.warn('⚠️  No baseline file found, creating new baseline');
      return;
    }

    try {
      const data = JSON.parse(readFileSync(this.config.baselineFile, 'utf-8'));
      this.baseline = new Map(Object.entries(data));
      
      // Build hashToFiles mapping for copy detection
      this.hashToFiles.clear();
      for (const [path, snapshot] of this.baseline.entries()) {
        const hash = (snapshot as FileSnapshot).hash;
        if (!this.hashToFiles.has(hash)) {
          this.hashToFiles.set(hash, new Set());
        }
        this.hashToFiles.get(hash)!.add(path);
      }
      
      console.log(`✅ Loaded baseline: ${this.baseline.size} files`);
      console.log(`✅ Hash tracking: ${this.hashToFiles.size} unique hashes`);
    } catch (error) {
      console.error('❌ Failed to load baseline:', error);
    }
  }

  /**
   * Save baseline to disk
   */
  private saveBaseline(): void {
    try {
      const data = Object.fromEntries(this.baseline);
      writeFileSync(this.config.baselineFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ Failed to save baseline:', error);
    }
  }

  /**
   * Save alerts to disk
   */
  private saveAlerts(): void {
    try {
      writeFileSync(this.config.alertsFile, JSON.stringify(this.alerts, null, 2));
    } catch (error) {
      console.error('❌ Failed to save alerts:', error);
    }
  }

  /**
   * Heuristic analysis: Check for malicious patterns
   */
  private analyzeHeuristic(filePath: string, content: string): Alert | null {
    for (const pattern of MALICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        return {
          timestamp: new Date(),
          severity: 'CRITICAL',
          file: filePath,
          type: 'HEURISTIC_MATCH',
          description: `Malicious pattern detected: ${pattern.source}`,
          matchedPattern: pattern.source,
        };
      }
    }

    return null;
  }

  /**
   * LLM analysis: Semantic code analysis for malicious intent
   */
  private async analyzeLLM(filePath: string, oldContent: string, newContent: string): Promise<Alert | null> {
    if (!this.llmClient) {
      return null;
    }

    const prompt = `🔒 SECURITY ANALYSIS - Code Modification Detection

You are a security analyst. Analyze this code diff for MALICIOUS INTENT.

FILE: ${filePath}

THREAT MODEL:
- Adversary trying to break GPT-5/o1 response generation
- Code injection to exfiltrate API keys
- Introduction of backdoors or infinite loops
- Sabotage to cause silent failures

SUSPICIOUS PATTERNS TO DETECT:
${SUSPICIOUS_CHANGES.map((s, i) => `${i + 1}. ${s}`).join('\n')}

OLD CODE:
\`\`\`
${oldContent.substring(0, 5000)}
\`\`\`

NEW CODE:
\`\`\`
${newContent.substring(0, 5000)}
\`\`\`

ANALYSIS REQUIRED:
1. Is this modification MALICIOUS? (YES/NO)
2. Severity: CRITICAL/HIGH/MEDIUM/LOW
3. Type of attack (if malicious)
4. Explanation (1-2 sentences)

RESPOND IN THIS EXACT FORMAT:
MALICIOUS: [YES/NO]
SEVERITY: [CRITICAL/HIGH/MEDIUM/LOW]
TYPE: [description]
REASON: [explanation]`;

    try {
      const messages: GrokMessage[] = [
        { role: 'user', content: prompt }
      ];

      const response = await this.llmClient.chat(messages, [], undefined, { search_parameters: { mode: 'off' } });
      const analysis = response.choices[0]?.message?.content || '';

      // Parse LLM response
      const isMalicious = /MALICIOUS:\s*YES/i.test(analysis);
      
      if (isMalicious) {
        const severityMatch = analysis.match(/SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW)/i);
        const severity = (severityMatch?.[1]?.toUpperCase() as Alert['severity']) || 'HIGH';
        
        const typeMatch = analysis.match(/TYPE:\s*([^\n]+)/i);
        const type = typeMatch?.[1] || 'Unknown malicious modification';
        
        const reasonMatch = analysis.match(/REASON:\s*([^\n]+)/i);
        const reason = reasonMatch?.[1] || 'LLM detected malicious intent';

        return {
          timestamp: new Date(),
          severity,
          file: filePath,
          type: 'LLM_DETECTED',
          description: `${type}: ${reason}`,
          llmAnalysis: analysis,
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ LLM analysis failed for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Handle file change event
   */
  private async onFileChange(filePath: string): Promise<void> {
    const relPath = relative(this.rootDir, filePath);
    const baseline = this.baseline.get(relPath);

    if (!baseline) {
      // New file, add to baseline
      const hash = this.calculateHash(filePath);
      if (hash) {
        // 🔧 FIX: Store content for auto-restore (ChatGPT feedback)
        const content = readFileSync(filePath, 'utf-8');
        
        this.baseline.set(relPath, {
          path: relPath,
          hash,
          size: content.length,
          timestamp: Date.now(),
          content, // Store content for restore
        });
        
        // Update hashToFiles mapping for copy detection
        if (!this.hashToFiles.has(hash)) {
          this.hashToFiles.set(hash, new Set());
        }
        this.hashToFiles.get(hash)!.add(relPath);
        
        this.saveBaseline();
      }
      return;
    }

    // Calculate new hash
    const newHash = this.calculateHash(filePath);
    
    if (!newHash) {
      return;
    }

    // 🔍 CHECK FOR FILE COPY (before hash mismatch check)
    // If newHash exists for OTHER files, it's a copy!
    const filesWithSameHash = this.hashToFiles.get(newHash);
    if (filesWithSameHash && filesWithSameHash.size > 0) {
      const otherFiles = Array.from(filesWithSameHash).filter(f => f !== relPath);
      if (otherFiles.length > 0) {
        const copyAlert: Alert = {
          timestamp: new Date(),
          severity: 'CRITICAL',
          file: relPath,
          type: 'FILE_COPY',
          description: `File appears to be a COPY of ${otherFiles[0]} (identical hash)`,
          oldHash: baseline.hash,
          newHash,
          originalFile: otherFiles[0],
        };
        
        console.error(`\n🚨 CRITICAL: File copy detected!`);
        console.error(`   File: ${relPath}`);
        console.error(`   Original: ${otherFiles[0]}`);
        console.error(`   Hash: ${newHash.substring(0, 12)}...`);
        console.error(`   EXPLANATION: File was REPLACED by a copy of another file!`);
        
        this.alerts.push(copyAlert);
        this.saveAlerts();
        
        if (this.config.autoQuarantine) {
          await this.quarantineFile(filePath, copyAlert);
        }
        
        // Update baseline and hash tracking
        this.baseline.set(relPath, {
          path: relPath,
          hash: newHash,
          size: readFileSync(filePath).length,
          timestamp: Date.now(),
          content: readFileSync(filePath, 'utf-8'),
        });
        this.saveBaseline();
        
        // Update hashToFiles mapping
        if (!filesWithSameHash.has(relPath)) {
          filesWithSameHash.add(relPath);
        }
        
        return;
      }
    }

    // Check for hash mismatch
    if (newHash !== baseline.hash) {
      console.warn(`\n⚠️  INTEGRITY VIOLATION DETECTED: ${relPath}`);
      console.warn(`   Old hash: ${baseline.hash}`);
      console.warn(`   New hash: ${newHash}`);

      const newContent = readFileSync(filePath, 'utf-8');
      const oldContent = baseline.content || '';

      // Generate diff
      let diff = '';
      try {
        const { stdout } = await execAsync(
          `git diff --no-index --unified=3 <(echo "${oldContent.replace(/"/g, '\\"')}") <(echo "${newContent.replace(/"/g, '\\"')}")`,
          { shell: '/bin/bash', maxBuffer: 10 * 1024 * 1024 }
        );
        diff = stdout;
      } catch {
        // Diff failed, that's OK
      }

      // 1️⃣ HEURISTIC ANALYSIS
      let alert: Alert | null = null;
      
      if (this.config.mode === 'heuristic' || this.config.mode === 'dual') {
        alert = this.analyzeHeuristic(relPath, newContent);
        
        if (alert) {
          console.error(`\n🚨 CRITICAL: Malicious pattern detected in ${relPath}`);
          console.error(`   Pattern: ${alert.matchedPattern}`);
        }
      }

      // 2️⃣ LLM ANALYSIS (if dual mode or heuristic didn't find anything)
      if ((this.config.mode === 'llm' || (this.config.mode === 'dual' && !alert)) && this.llmClient) {
        console.log(`🔍 Running LLM analysis on ${relPath}...`);
        const llmAlert = await this.analyzeLLM(relPath, oldContent, newContent);
        
        if (llmAlert) {
          console.error(`\n🚨 CRITICAL: LLM detected malicious modification in ${relPath}`);
          console.error(`   Analysis: ${llmAlert.description}`);
          alert = llmAlert;
        }
      }

      // 3️⃣ HASH MISMATCH ALERT (if no malicious pattern found)
      if (!alert) {
        alert = {
          timestamp: new Date(),
          severity: 'HIGH',
          file: relPath,
          type: 'HASH_MISMATCH',
          description: 'File content changed (hash mismatch)',
          oldHash: baseline.hash,
          newHash,
          diff,
        };
      } else {
        // Add diff to existing alert
        alert.oldHash = baseline.hash;
        alert.newHash = newHash;
        alert.diff = diff;
      }

      // Save alert
      this.alerts.push(alert);
      this.saveAlerts();

      // 4️⃣ AUTO-QUARANTINE (if malicious and enabled)
      if (alert.type !== 'HASH_MISMATCH' && this.config.autoQuarantine) {
        await this.quarantineFile(filePath, alert);
      }

      // 5️⃣ NOTIFICATION
      this.notifyUser(alert);
    }
  }

  /**
   * Quarantine malicious file
   */
  private async quarantineFile(filePath: string, alert: Alert): Promise<void> {
    const timestamp = Date.now();
    const quarantinePath = join(
      this.quarantineDir,
      `${alert.file.replace(/\//g, '_')}.${timestamp}.quarantine`
    );

    try {
      // Copy malicious file to quarantine
      const content = readFileSync(filePath, 'utf-8');
      writeFileSync(quarantinePath, content);
      
      // Write alert metadata
      writeFileSync(
        `${quarantinePath}.meta.json`,
        JSON.stringify(alert, null, 2)
      );

      console.log(`🔒 Quarantined: ${filePath} → ${quarantinePath}`);

      // If auto-restore enabled, restore from baseline
      if (this.config.autoRestore) {
        const baseline = this.baseline.get(alert.file);
        if (baseline && baseline.content) {
          writeFileSync(filePath, baseline.content);
          console.log(`✅ Auto-restored from baseline: ${filePath}`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to quarantine ${filePath}:`, error);
    }
  }

  /**
   * Notify user of security alert
   */
  private notifyUser(alert: Alert): void {
    const severityEmoji = {
      CRITICAL: '🔴',
      HIGH: '🟠',
      MEDIUM: '🟡',
      LOW: '🟢',
    }[alert.severity];

    console.error(`\n${severityEmoji} SECURITY ALERT [${alert.severity}]`);
    console.error(`   File: ${alert.file}`);
    console.error(`   Type: ${alert.type}`);
    console.error(`   Time: ${alert.timestamp.toISOString()}`);
    console.error(`   Description: ${alert.description}`);
    
    if (alert.matchedPattern) {
      console.error(`   Pattern: ${alert.matchedPattern}`);
    }
    
    if (alert.llmAnalysis) {
      console.error(`\n   LLM Analysis:`);
      console.error(`   ${alert.llmAnalysis.split('\n').join('\n   ')}`);
    }

    // Play alert sound (if available)
    try {
      exec('paplay /usr/share/sounds/freedesktop/stereo/dialog-error.oga');
    } catch {
      // Sound not available, that's OK
    }
  }

  /**
   * Start watching for file changes
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️  Watcher already running');
      return;
    }

    console.log('\n🛡️  INTEGRITY WATCHER STARTING...');
    console.log(`   Mode: ${this.config.mode.toUpperCase()}`);
    console.log(`   Root: ${this.rootDir}`);
    console.log(`   Patterns: ${this.config.watchPatterns.length}`);
    
    if (this.config.mode === 'llm' || this.config.mode === 'dual') {
      console.log(`   LLM Model: ${this.config.llmModel}`);
    }

    // Load or create baseline
    if (existsSync(this.config.baselineFile)) {
      this.loadBaseline();
    } else {
      await this.createBaseline();
    }

    // Watch for changes
    const patterns = this.config.watchPatterns.map(p => join(this.rootDir, p));
    
    this.watcher = chokidar.watch(patterns, {
      persistent: true,
      ignoreInitial: true,
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/.grok/**',
        '**/dist/**',
        '**/build/**',
      ],
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.watcher.on('change', (path) => {
      this.onFileChange(path).catch(error => {
        console.error(`❌ Error handling file change for ${path}:`, error);
      });
    });

    this.watcher.on('add', (path) => {
      console.log(`📄 New file detected: ${relative(this.rootDir, path)}`);
      this.onFileChange(path).catch(error => {
        console.error(`❌ Error handling new file ${path}:`, error);
      });
    });

    this.isRunning = true;
    console.log('✅ Integrity Watcher is now monitoring for malicious changes...\n');
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.isRunning = false;
    console.log('\n🛑 Integrity Watcher stopped');
  }

  /**
   * Get all alerts
   */
  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * Get critical alerts only
   */
  getCriticalAlerts(): Alert[] {
    return this.alerts.filter(a => a.severity === 'CRITICAL');
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    this.saveAlerts();
  }
}

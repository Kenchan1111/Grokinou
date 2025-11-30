#!/usr/bin/env node
/**
 * 🛡️ INTEGRITY WATCHER CLI
 * 
 * Command-line interface for the real-time file integrity monitoring system.
 * 
 * USAGE:
 *   npm run watch-integrity                    # Heuristic mode (default)
 *   npm run watch-integrity -- --mode llm      # LLM mode
 *   npm run watch-integrity -- --mode dual     # Both heuristic + LLM
 *   npm run watch-integrity -- --baseline      # Create baseline only
 *   npm run watch-integrity -- --alerts        # Show alerts
 */

import { IntegrityWatcher, WatcherConfig } from './integrity-watcher.js';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { verifySelfIntegrityOrDie } from './self-integrity.js';

// 🛡️ SELF-INTEGRITY CHECK (before ANY execution)
// Vérifie que les fichiers du watcher n'ont pas été altérés
await verifySelfIntegrityOrDie('integrity');

// Parse command-line arguments
const args = process.argv.slice(2);
const mode = args.includes('--mode') 
  ? (args[args.indexOf('--mode') + 1] as 'heuristic' | 'llm' | 'dual')
  : 'heuristic';

const createBaseline = args.includes('--baseline');
const showAlerts = args.includes('--alerts');
const autoQuarantine = !args.includes('--no-quarantine');
const autoRestore = args.includes('--auto-restore');

// Detect root directory
const rootDir = process.cwd();

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🛡️  INTEGRITY WATCHER - Real-time Security Monitoring       ║
╠═══════════════════════════════════════════════════════════════╣
║  THREAT MODEL: Compromised system with adversaries           ║
║  DETECTION: Cryptographic hashing + Heuristic/LLM analysis   ║
║  PROTECTION: Auto-quarantine + Auto-restore capabilities     ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Configuration
const config: Partial<WatcherConfig> = {
  mode,
  autoQuarantine,
  autoRestore,
};

// Initialize watcher
const watcher = new IntegrityWatcher(rootDir, config);

// Handle different commands
if (createBaseline) {
  console.log('📸 Creating integrity baseline...');
  await watcher.createBaseline();
  console.log('✅ Baseline created successfully');
  process.exit(0);
}

if (showAlerts) {
  console.log('📋 Loading alerts...');
  const alerts = watcher.getAlerts();
  
  if (alerts.length === 0) {
    console.log('✅ No alerts found');
  } else {
    console.log(`\n🚨 Total alerts: ${alerts.length}\n`);
    
    const critical = alerts.filter(a => a.severity === 'CRITICAL');
    const high = alerts.filter(a => a.severity === 'HIGH');
    const medium = alerts.filter(a => a.severity === 'MEDIUM');
    const low = alerts.filter(a => a.severity === 'LOW');
    
    console.log(`   🔴 CRITICAL: ${critical.length}`);
    console.log(`   🟠 HIGH: ${high.length}`);
    console.log(`   🟡 MEDIUM: ${medium.length}`);
    console.log(`   🟢 LOW: ${low.length}`);
    
    console.log('\n📄 Recent alerts:\n');
    
    alerts.slice(-10).reverse().forEach(alert => {
      const emoji = {
        CRITICAL: '🔴',
        HIGH: '🟠',
        MEDIUM: '🟡',
        LOW: '🟢',
      }[alert.severity];
      
      console.log(`${emoji} [${alert.severity}] ${alert.file}`);
      console.log(`   Type: ${alert.type}`);
      console.log(`   Time: ${alert.timestamp.toISOString()}`);
      console.log(`   Description: ${alert.description}`);
      
      if (alert.matchedPattern) {
        console.log(`   Pattern: ${alert.matchedPattern}`);
      }
      
      console.log('');
    });
  }
  
  process.exit(0);
}

// Start watching
console.log('🚀 Starting Integrity Watcher...\n');

await watcher.start();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down...');
  await watcher.stop();
  
  const alerts = watcher.getCriticalAlerts();
  if (alerts.length > 0) {
    console.log(`\n⚠️  Session ended with ${alerts.length} CRITICAL alert(s)`);
    console.log('   Review with: npm run watch-integrity -- --alerts');
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await watcher.stop();
  process.exit(0);
});

// Keep process alive
console.log('Press Ctrl+C to stop\n');

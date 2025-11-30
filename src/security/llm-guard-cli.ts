#!/usr/bin/env node
/**
 * 🤖 LLM GUARD CLI - Intelligent Surveillance Interface
 * 
 * USAGE:
 *   npm run guard:start                         # Start LLM Guard (love-watching mode)
 *   npm run guard:start -- --llm grok-2-1212    # Specify LLM model
 *   npm run guard:start -- --interval 60000     # Analysis every 60s
 *   npm run guard:logs                          # View logs
 *   npm run guard:stats                         # View statistics
 */

import { LLMGuard, LLMGuardConfig } from './llm-guard.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { verifySelfIntegrityOrDie } from './self-integrity.js';

// 🛡️ SELF-INTEGRITY CHECK (before ANY execution)
// Vérifie que les fichiers du watcher n'ont pas été altérés
await verifySelfIntegrityOrDie('llm-guard');

// Parse command-line arguments
const args = process.argv.slice(2);

const getLLMApiKey = (): string => {
  // Check CLI argument
  const apiKeyIndex = args.indexOf('--apikey');
  if (apiKeyIndex !== -1 && args[apiKeyIndex + 1]) {
    return args[apiKeyIndex + 1];
  }

  // Check environment variable
  if (process.env.GROK_API_KEY) {
    return process.env.GROK_API_KEY;
  }

  // Check environment variable (alternative)
  if (process.env.LLM_GUARD_API_KEY) {
    return process.env.LLM_GUARD_API_KEY;
  }

  throw new Error('No API key provided. Set GROK_API_KEY or LLM_GUARD_API_KEY env var, or use --apikey flag.');
};

const getLLMModel = (): string => {
  const modelIndex = args.indexOf('--llm');
  if (modelIndex !== -1 && args[modelIndex + 1]) {
    return args[modelIndex + 1];
  }
  return process.env.LLM_GUARD_MODEL || 'grok-2-1212';
};

const getAnalysisInterval = (): number => {
  const intervalIndex = args.indexOf('--interval');
  if (intervalIndex !== -1 && args[intervalIndex + 1]) {
    return parseInt(args[intervalIndex + 1]);
  }
  return 30000; // 30s default
};

const getMode = (): 'love-watching' | 'active-reviewer' => {
  if (args.includes('--active-reviewer')) {
    return 'active-reviewer';
  }
  return 'love-watching'; // Default
};

const showLogs = args.includes('--logs');
const showStats = args.includes('--stats');

// Detect root directory
const rootDir = process.cwd();

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🤖 LLM GUARD - Intelligent Surveillance System              ║
╠═══════════════════════════════════════════════════════════════╣
║  CONCEPT: LLM-powered security guard that watches for        ║
║           suspicious behaviors that signatures can't detect   ║
╠═══════════════════════════════════════════════════════════════╣
║  DETECTS:                                                     ║
║  ✓ File replacements (inode changes)                         ║
║  ✓ File copies (identical content)                           ║
║  ✓ Mass operations                                           ║
║  ✓ Suspicious timing                                         ║
║  ✓ Behavioral patterns                                       ║
║  ✓ Context-aware anomalies                                   ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Handle different commands
if (showLogs) {
  console.log('📋 Loading LLM Guard logs...');
  const logsFile = join(rootDir, '.llm-guard-logs.json');
  
  if (!existsSync(logsFile)) {
    console.log('✅ No logs found (guard not run yet)');
    process.exit(0);
  }

  try {
    const logs = JSON.parse(readFileSync(logsFile, 'utf-8'));
    
    console.log(`\n🤖 LLM GUARD LOGS (${logs.length} entries)\n`);
    
    // Group by category
    const categories: Record<string, any[]> = {};
    for (const log of logs) {
      if (!categories[log.category]) {
        categories[log.category] = [];
      }
      categories[log.category].push(log);
    }

    // Show recent logs by category
    for (const [category, categoryLogs] of Object.entries(categories)) {
      console.log(`\n📂 ${category.toUpperCase()} (${categoryLogs.length} entries):`);
      
      const recent = categoryLogs.slice(-10);
      for (const log of recent) {
        const emoji = log.severity === 'critical' ? '🔴' : 
                      log.severity === 'warning' ? '🟡' : '🟢';
        console.log(`  ${emoji} [${log.timestamp}] ${log.message}`);
        if (log.data && category === 'detection') {
          console.log(`     → ${JSON.stringify(log.data, null, 2).split('\n').join('\n     ')}`);
        }
      }
    }
    
  } catch (error: any) {
    console.error(`❌ Failed to read logs: ${error.message}`);
    process.exit(1);
  }
  
  process.exit(0);
}

if (showStats) {
  console.log('📊 Loading LLM Guard statistics...');
  const logsFile = join(rootDir, '.llm-guard-logs.json');
  
  if (!existsSync(logsFile)) {
    console.log('✅ No stats yet (guard not run)');
    process.exit(0);
  }

  try {
    const logs = JSON.parse(readFileSync(logsFile, 'utf-8'));
    
    // Calculate stats from logs
    const stats = {
      totalLogs: logs.length,
      observations: logs.filter((l: any) => l.category === 'observation').length,
      detections: logs.filter((l: any) => l.category === 'detection').length,
      analyses: logs.filter((l: any) => l.category === 'analysis').length,
      alerts: logs.filter((l: any) => l.category === 'alert').length,
      critical: logs.filter((l: any) => l.severity === 'critical').length,
      warnings: logs.filter((l: any) => l.severity === 'warning').length,
    };

    console.log('\n📊 LLM GUARD STATISTICS:\n');
    console.log(`   Total logs: ${stats.totalLogs}`);
    console.log(`   Observations: ${stats.observations}`);
    console.log(`   Detections: ${stats.detections}`);
    console.log(`   LLM Analyses: ${stats.analyses}`);
    console.log(`   Alerts: ${stats.alerts}`);
    console.log(`   Critical: ${stats.critical}`);
    console.log(`   Warnings: ${stats.warnings}`);
    console.log('');
    
    // Recent detections
    const recentDetections = logs
      .filter((l: any) => l.category === 'detection')
      .slice(-5);
    
    if (recentDetections.length > 0) {
      console.log('🔍 RECENT DETECTIONS:\n');
      for (const det of recentDetections) {
        console.log(`   ${det.message}`);
        console.log(`   → ${det.timestamp}`);
        console.log('');
      }
    }
    
  } catch (error: any) {
    console.error(`❌ Failed to read stats: ${error.message}`);
    process.exit(1);
  }
  
  process.exit(0);
}

// Start LLM Guard
console.log('🚀 Starting LLM Guard...\n');

try {
  const apiKey = getLLMApiKey();
  const model = getLLMModel();
  const interval = getAnalysisInterval();
  const mode = getMode();

  console.log(`   API Key: ${apiKey.substring(0, 10)}...`);
  console.log(`   LLM Model: ${model}`);
  console.log(`   Analysis Interval: ${interval}ms (${interval / 1000}s)`);
  console.log(`   Mode: ${mode}`);
  console.log(`   Root Directory: ${rootDir}`);
  console.log('');

  const config: LLMGuardConfig = {
    llmApiKey: apiKey,
    llmModel: model,
    analysisInterval: interval,
    mode,
  };

  const guard = new LLMGuard(rootDir, config);

  // Start guard
  guard.start().catch(error => {
    console.error(`❌ Failed to start LLM Guard: ${error.message}`);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down LLM Guard...');
    await guard.stop();
    
    const stats = guard.getStatistics();
    console.log('\n📊 SESSION STATISTICS:');
    console.log(`   Events observed: ${stats.eventsObserved}`);
    console.log(`   Files replaced: ${stats.filesReplaced}`);
    console.log(`   Files copied: ${stats.filesCopied}`);
    console.log(`   LLM analyses: ${stats.llmAnalyses}`);
    console.log(`   Alerts generated: ${stats.alertsGenerated}`);
    console.log('');
    
    console.log('💾 Logs saved to: .llm-guard-logs.json');
    console.log('📖 View logs: npm run guard:logs');
    console.log('📊 View stats: npm run guard:stats');
    console.log('');
    
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await guard.stop();
    process.exit(0);
  });

  // Keep process alive
  console.log('Press Ctrl+C to stop\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

} catch (error: any) {
  console.error(`❌ Error: ${error.message}`);
  console.error('\nUSAGE:');
  console.error('  export GROK_API_KEY="your-api-key"');
  console.error('  npm run guard:start');
  console.error('\nOR:');
  console.error('  npm run guard:start -- --apikey your-key --llm grok-2-1212 --interval 60000');
  console.error('');
  process.exit(1);
}

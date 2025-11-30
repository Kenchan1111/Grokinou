#!/usr/bin/env node
/**
 * 🛡️ WATCHER DAEMON CLI - Unified Security System Control
 * 
 * USAGE:
 *   npm run watcher:start    # Start daemon
 *   npm run watcher:stop     # Stop daemon
 *   npm run watcher:status   # Check status
 *   npm run watcher:restart  # Restart daemon
 */

import { WatcherDaemon } from './watcher-daemon.js';
import { verifySelfIntegrityOrDie } from './self-integrity.js';

// 🛡️ SELF-INTEGRITY CHECK (before ANY execution)
// Vérifie que les fichiers du watcher n'ont pas été altérés
await verifySelfIntegrityOrDie('daemon');

const args = process.argv.slice(2);
const command = args[0] || 'status';
const rootDir = process.cwd();

const daemon = new WatcherDaemon(rootDir, {
  mode: (process.env.GROK_WATCHER_MODE as any) || 'dual',
  enableLLMGuard: process.env.GROK_LLM_GUARD !== 'false',
  llmApiKey: process.env.GROK_API_KEY || process.env.LLM_GUARD_API_KEY,
  baselineBackup: true,
});

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║         🛡️  WATCHER DAEMON - Security System Control        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

async function main() {
  switch (command) {
    case 'start':
      await daemon.start();
      break;

    case 'stop':
      daemon.stop();
      break;

    case 'status':
      daemon.status();
      break;

    case 'restart':
      daemon.stop();
      // Wait a bit for processes to stop
      await new Promise(resolve => setTimeout(resolve, 1000));
      await daemon.start();
      break;

    default:
      console.log('Unknown command:', command);
      console.log('');
      console.log('Usage:');
      console.log('  npm run watcher:start    # Start daemon');
      console.log('  npm run watcher:stop     # Stop daemon');
      console.log('  npm run watcher:status   # Check status');
      console.log('  npm run watcher:restart  # Restart daemon');
      console.log('');
      process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

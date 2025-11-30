import chalk from 'chalk';
import { GrokAgent } from '../agent/grok-agent.js';
import { sessionManager } from './session-manager-sqlite.js';

/**
 * Modern help formatter with beautiful tables and colors
 * Dashboard Style (Option 5) - 2025 Edition
 */
export class HelpFormatter {
  /**
   * Generate the main help dashboard
   */
  static generateHelp(agent?: GrokAgent): string {
    const currentSession = sessionManager.getCurrentSession();
    const currentModel = agent?.getCurrentModel() || 'N/A';
    const currentCwd = process.cwd();
    
    // Session info
    const sessionInfo = currentSession 
      ? `#${currentSession.id} (${currentSession.message_count || 0} msg)`
      : 'No session';
    
    let help = '';
    
    // ╔═══════════════════════════════════════════════════════════════════════════╗
    // ║                    HEADER WITH STATUS BAR                                  ║
    // ╚═══════════════════════════════════════════════════════════════════════════╝
    help += chalk.cyan('╔════════════════════════════════════════════════════════════════════════════╗\n');
    help += chalk.cyan('║') + chalk.yellow.bold('                    🚀 GROKINOU CLI v2.0 - COMMAND CENTER                   ') + chalk.cyan('║\n');
    help += chalk.cyan('║') + chalk.yellow('                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                      ') + chalk.cyan('║\n');
    help += chalk.cyan('║') + chalk.gray(`  Session: ${sessionInfo} │ Model: ${currentModel}              `) + chalk.cyan('║\n');
    help += chalk.cyan('╚════════════════════════════════════════════════════════════════════════════╝\n');
    help += '\n';
    
    // ╭────────────────────────────────────────────────────────────────────────────╮
    // │ QUICK START                                                                │
    // ╰────────────────────────────────────────────────────────────────────────────╯
    help += chalk.cyan('╭────────────────────────────────────────────────────────────────────────────╮\n');
    help += chalk.cyan('│') + chalk.yellow.bold(' 📚 QUICK START                                                             ') + chalk.cyan('│\n');
    help += chalk.cyan('├────────────────────────────────────────────────────────────────────────────┤\n');
    help += chalk.cyan('│') + chalk.white('  💬 Chat normally                    → Just type your message              ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.white('  📂 New project                      → /new-session ~/project --clone-git  ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.white('  ⏰ Time travel                      → /rewind "2025-11-28T10:00:00Z"      ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.white('  🔍 Search history                   → /search <query>                     ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.white('  🤖 Change model                     → /models                             ') + chalk.cyan('│\n');
    help += chalk.cyan('╰────────────────────────────────────────────────────────────────────────────╯\n');
    help += '\n';
    
    // ╭────────────────────────────────────────────────────────────────────────────╮
    // │ CORE COMMANDS                                                              │
    // ╰────────────────────────────────────────────────────────────────────────────╯
    help += chalk.cyan('╭────────────────────────────────────────────────────────────────────────────╮\n');
    help += chalk.cyan('│') + chalk.yellow.bold(' 🔧 CORE COMMANDS                                                           ') + chalk.cyan('│\n');
    help += chalk.cyan('├──────────────────┬─────────────────────────────────────────────────────────┤\n');
    help += chalk.cyan('│') + chalk.green(' Command          ') + chalk.cyan('│') + chalk.white(' What it does                                            ') + chalk.cyan('│\n');
    help += chalk.cyan('├──────────────────┼─────────────────────────────────────────────────────────┤\n');
    help += chalk.cyan('│') + chalk.green(' /help [cmd]      ') + chalk.cyan('│') + chalk.white(' Show help (this screen) or specific command help       ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' /status          ') + chalk.cyan('│') + chalk.white(' Current config (model, provider, session, API keys)    ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' /clear           ') + chalk.cyan('│') + chalk.white(' Clear chat history (memory + disk)                     ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' /exit            ') + chalk.cyan('│') + chalk.white(' Quit Grokinou                                           ') + chalk.cyan('│\n');
    help += chalk.cyan('╰──────────────────┴─────────────────────────────────────────────────────────╯\n');
    help += '\n';
    
    // ╭────────────────────────────────────────────────────────────────────────────╮
    // │ SESSIONS (Git-like branches for conversations)                            │
    // ╰────────────────────────────────────────────────────────────────────────────╯
    help += chalk.cyan('╭────────────────────────────────────────────────────────────────────────────╮\n');
    help += chalk.cyan('│') + chalk.yellow.bold(' 🗂️  SESSIONS (Git-like branches for conversations)                        ') + chalk.cyan('│\n');
    help += chalk.cyan('├──────────────────┬─────────────────────────────────────────────────────────┤\n');
    help += chalk.cyan('│') + chalk.green(' /list_sessions   ') + chalk.cyan('│') + chalk.white(' List all sessions in current directory                 ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' /switch-session  ') + chalk.cyan('│') + chalk.white(' Switch to different session: /switch-session 5          ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' /rename_session  ') + chalk.cyan('│') + chalk.white(' Rename current session: /rename_session my-project     ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' /new-session     ') + chalk.cyan('│') + chalk.white(' Create new session (see full options below)            ') + chalk.cyan('│\n');
    help += chalk.cyan('╰──────────────────┴─────────────────────────────────────────────────────────╯\n');
    help += '\n';
    
    // ┌──────────────────────────────────────────────────────────────────────┐
    // │ 📦 /new-session - Full Options                                      │
    // └──────────────────────────────────────────────────────────────────────┘
    help += chalk.blue('   ┌──────────────────────────────────────────────────────────────────────┐\n');
    help += chalk.blue('   │') + chalk.magenta.bold(' 📦 /new-session - Full Options                                      ') + chalk.blue('│\n');
    help += chalk.blue('   ├──────────────┬───────────────────────────────────────────────────────┤\n');
    help += chalk.blue('   │') + chalk.yellow(' Init Mode    ') + chalk.blue('│') + chalk.white(' --clone-git │ --copy-files │ --from-rewind <time>  ') + chalk.blue('│\n');
    help += chalk.blue('   │') + chalk.yellow(' History      ') + chalk.blue('│') + chalk.white(' --import-history --from-session <id> --date-range   ') + chalk.blue('│\n');
    help += chalk.blue('   │') + chalk.yellow(' Model        ') + chalk.blue('│') + chalk.white(' --model <name> --provider <name>                     ') + chalk.blue('│\n');
    help += chalk.blue('   └──────────────┴───────────────────────────────────────────────────────┘\n');
    help += '\n';
    
    // ╭────────────────────────────────────────────────────────────────────────────╮
    // │ TIMELINE & TIME MACHINE (Event Sourcing)                                  │
    // ╰────────────────────────────────────────────────────────────────────────────╯
    help += chalk.cyan('╭────────────────────────────────────────────────────────────────────────────╮\n');
    help += chalk.cyan('│') + chalk.yellow.bold(' ⏰ TIMELINE & TIME MACHINE (Event Sourcing)                                ') + chalk.cyan('│\n');
    help += chalk.cyan('├──────────────────┬─────────────────────────────────────────────────────────┤\n');
    help += chalk.cyan('│') + chalk.green(' /timeline        ') + chalk.cyan('│') + chalk.white(' Query events: /timeline --type FILE --since today      ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' /rewind          ') + chalk.cyan('│') + chalk.white(' Time travel: /rewind "2025-11-28T10:00:00Z"            ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' /snapshots       ') + chalk.cyan('│') + chalk.white(' List available rewind points                           ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' /rewind-history  ') + chalk.cyan('│') + chalk.white(' Show past rewind operations                            ') + chalk.cyan('│\n');
    help += chalk.cyan('╰──────────────────┴─────────────────────────────────────────────────────────╯\n');
    help += '\n';
    
    // ┌──────────────────────────────────────────────────────────────────────┐
    // │ ⚙️  /rewind Git Modes Compared                                       │
    // └──────────────────────────────────────────────────────────────────────┘
    help += chalk.blue('   ┌──────────────────────────────────────────────────────────────────────┐\n');
    help += chalk.blue('   │') + chalk.magenta.bold(' ⚙️  /rewind Git Modes Compared                                       ') + chalk.blue('│\n');
    help += chalk.blue('   ├──────────┬────────────┬─────────────────┬─────────────────────────────┤\n');
    help += chalk.blue('   │') + chalk.yellow(' Mode     ') + chalk.blue('│') + chalk.yellow(' Speed      ') + chalk.blue('│') + chalk.yellow(' What you get    ') + chalk.blue('│') + chalk.yellow(' Best for                 ') + chalk.blue('│\n');
    help += chalk.blue('   ├──────────┼────────────┼─────────────────┼─────────────────────────────┤\n');
    help += chalk.blue('   │') + chalk.white(' none     ') + chalk.blue('│') + chalk.green(' ⚡⚡⚡     ') + chalk.blue('│') + chalk.white(' Files only      ') + chalk.blue('│') + chalk.white(' Quick preview            ') + chalk.blue('│\n');
    help += chalk.blue('   │') + chalk.white(' metadata ') + chalk.blue('│') + chalk.green(' ⚡⚡       ') + chalk.blue('│') + chalk.white(' + git state     ') + chalk.blue('│') + chalk.cyan(' Audit trail (default ✓) ') + chalk.blue('│\n');
    help += chalk.blue('   │') + chalk.white(' full     ') + chalk.blue('│') + chalk.yellow(' ⚡         ') + chalk.blue('│') + chalk.white(' + complete .git ') + chalk.blue('│') + chalk.white(' Continue development     ') + chalk.blue('│\n');
    help += chalk.blue('   └──────────┴────────────┴─────────────────┴─────────────────────────────┘\n');
    help += '\n';
    
    // ╭────────────────────────────────────────────────────────────────────────────╮
    // │ KEYBOARD SHORTCUTS                                                         │
    // ╰────────────────────────────────────────────────────────────────────────────╯
    help += chalk.cyan('╭────────────────────────────────────────────────────────────────────────────╮\n');
    help += chalk.cyan('│') + chalk.yellow.bold(' ⌨️  KEYBOARD SHORTCUTS                                                     ') + chalk.cyan('│\n');
    help += chalk.cyan('├──────────────────┬─────────────────────────────────────────────────────────┤\n');
    help += chalk.cyan('│') + chalk.green(' Ctrl+E           ') + chalk.cyan('│') + chalk.white(' Toggle Execution Viewer (hide/split/fullscreen)        ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' Ctrl+F           ') + chalk.cyan('│') + chalk.white(' Fullscreen Execution Viewer                            ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' Ctrl+C           ') + chalk.cyan('│') + chalk.white(' Cancel / Clear input                                   ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' ↑ / ↓            ') + chalk.cyan('│') + chalk.white(' Navigate command history                               ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' Tab              ') + chalk.cyan('│') + chalk.white(' Autocomplete commands                                  ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.green(' Shift+Tab        ') + chalk.cyan('│') + chalk.white(' Toggle auto-edit mode (bypass confirmations)           ') + chalk.cyan('│\n');
    help += chalk.cyan('╰──────────────────┴─────────────────────────────────────────────────────────╯\n');
    help += '\n';
    
    // ╭────────────────────────────────────────────────────────────────────────────╮
    // │ 💡 TIPS                                                                    │
    // ╰────────────────────────────────────────────────────────────────────────────╯
    help += chalk.cyan('╭────────────────────────────────────────────────────────────────────────────╮\n');
    help += chalk.cyan('│') + chalk.yellow.bold(' 💡 TIPS                                                                    ') + chalk.cyan('│\n');
    help += chalk.cyan('├────────────────────────────────────────────────────────────────────────────┤\n');
    help += chalk.cyan('│') + chalk.white('  • Full docs: cat HELP.md or visit github.com/zackbeyond/grok-cli         ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.white('  • Execution Viewer: Press Ctrl+E to see LLM\'s thinking + command output ') + chalk.cyan('│\n');
    help += chalk.cyan('│') + chalk.white('  • Need help? Type: /help <command> (ex: /help rewind)                   ') + chalk.cyan('│\n');
    help += chalk.cyan('╰────────────────────────────────────────────────────────────────────────────╯\n');
    
    return help;
  }
  
  /**
   * Generate help for a specific command
   */
  static generateCommandHelp(command: string): string {
    switch (command) {
      case 'rewind':
        return this.generateRewindHelp();
      case 'timeline':
        return this.generateTimelineHelp();
      case 'new-session':
        return this.generateNewSessionHelp();
      case 'snapshots':
        return this.generateSnapshotsHelp();
      default:
        return chalk.red(`❌ No detailed help available for: ${command}\n\n`) +
               chalk.gray(`Use /help to see all commands`);
    }
  }
  
  /**
   * Generate detailed help for /rewind command
   */
  private static generateRewindHelp(): string {
    let help = '';
    
    help += chalk.cyan('╔════════════════════════════════════════════════════════════════════════════╗\n');
    help += chalk.cyan('║') + chalk.yellow.bold('                         ⏰ /REWIND - TIME MACHINE                          ') + chalk.cyan('║\n');
    help += chalk.cyan('╚════════════════════════════════════════════════════════════════════════════╝\n');
    help += '\n';
    
    help += chalk.white('Reconstruct your project\'s exact state at any point in time.\n');
    help += chalk.white('Non-destructive: creates a new directory with the rewinded state.\n\n');
    
    help += chalk.yellow('📋 Usage:\n');
    help += chalk.gray('  /rewind <timestamp> [options]\n\n');
    
    help += chalk.yellow('🔧 Options:\n');
    help += chalk.green('  <timestamp>         ') + chalk.white('Target time (ISO: "2025-11-28T12:00:00Z")\n');
    help += chalk.green('  --output <dir>      ') + chalk.white('Custom output directory (default: .rewind_*)\n');
    help += chalk.green('  --git-mode <mode>   ') + chalk.white('Git materialization:\n');
    help += chalk.gray('      none            ') + chalk.white('No git (just files + conversations)\n');
    help += chalk.gray('      metadata        ') + chalk.white('git_state.json only (fast, default)\n');
    help += chalk.gray('      full            ') + chalk.white('Complete .git repo you can work with (slow)\n');
    help += chalk.green('  --auto-checkout     ') + chalk.white('Automatically cd to rewinded directory after rewind\n');
    help += chalk.green('  --compare-with <dir>') + chalk.white('Compare rewinded state with another directory\n');
    help += chalk.green('  --no-files          ') + chalk.white('Don\'t restore file contents\n');
    help += chalk.green('  --no-conversations  ') + chalk.white('Don\'t restore chat history\n\n');
    
    help += chalk.yellow('📚 Examples:\n');
    help += chalk.gray('  /rewind "2025-11-28T10:00:00Z"\n');
    help += chalk.gray('  /rewind "2025-11-27T18:00:00Z" --output ~/recovered\n');
    help += chalk.gray('  /rewind "2025-11-28T12:00:00Z" --git-mode full --auto-checkout\n');
    help += chalk.gray('  /rewind "2025-11-28T12:00:00Z" --compare-with ~/current-project\n\n');
    
    help += chalk.blue('💡 See /snapshots for available rewind points\n');
    
    return help;
  }
  
  /**
   * Generate detailed help for /timeline command
   */
  private static generateTimelineHelp(): string {
    let help = '';
    
    help += chalk.cyan('╔════════════════════════════════════════════════════════════════════════════╗\n');
    help += chalk.cyan('║') + chalk.yellow.bold('                       📅 /TIMELINE - EVENT QUERY                           ') + chalk.cyan('║\n');
    help += chalk.cyan('╚════════════════════════════════════════════════════════════════════════════╝\n');
    help += '\n';
    
    help += chalk.white('Query the complete event log of your project.\n\n');
    
    help += chalk.yellow('📋 Usage:\n');
    help += chalk.gray('  /timeline [options]\n\n');
    
    help += chalk.yellow('🔧 Options:\n');
    help += chalk.green('  --start <time>      ') + chalk.white('Start time (ISO or relative: "2 hours ago")\n');
    help += chalk.green('  --end <time>        ') + chalk.white('End time\n');
    help += chalk.green('  --category <cat>    ') + chalk.white('Filter: SESSION, LLM, TOOL, FILE, GIT, REWIND\n');
    help += chalk.green('  --session <id>      ') + chalk.white('Filter by session ID\n');
    help += chalk.green('  --limit <n>         ') + chalk.white('Max results (default: 100)\n');
    help += chalk.green('  --search <text>     ') + chalk.white('Search text in event payloads\n');
    help += chalk.green('  --stats             ') + chalk.white('Show statistics only\n\n');
    
    help += chalk.yellow('📚 Examples:\n');
    help += chalk.gray('  /timeline --category FILE --limit 20\n');
    help += chalk.gray('  /timeline --start "2025-11-28T10:00:00Z" --category GIT\n');
    help += chalk.gray('  /timeline --session 5 --stats\n');
    help += chalk.gray('  /timeline --search "error" --limit 10\n');
    
    return help;
  }
  
  /**
   * Generate detailed help for /new-session command
   */
  private static generateNewSessionHelp(): string {
    let help = '';
    
    help += chalk.cyan('╔════════════════════════════════════════════════════════════════════════════╗\n');
    help += chalk.cyan('║') + chalk.yellow.bold('                    🗂️  /NEW-SESSION - CREATE SESSION                      ') + chalk.cyan('║\n');
    help += chalk.cyan('╚════════════════════════════════════════════════════════════════════════════╝\n');
    help += '\n';
    
    help += chalk.white('Create a new conversation session (Git-like branching).\n\n');
    
    help += chalk.yellow('📋 Usage:\n');
    help += chalk.gray('  /new-session [options]\n\n');
    
    help += chalk.yellow('📁 Directory Options:\n');
    help += chalk.green('  --directory <path>     ') + chalk.white('Create session in different directory\n\n');
    
    help += chalk.yellow('🔄 Initialization Options (choose one):\n');
    help += chalk.green('  --clone-git            ') + chalk.white('Clone current Git repository to target directory\n');
    help += chalk.green('  --copy-files           ') + chalk.white('Copy files from current directory (excluding .git)\n');
    help += chalk.green('  --from-rewind <time>   ') + chalk.white('Initialize from a rewind state (uses event sourcing)\n\n');
    
    help += chalk.yellow('💬 History Import Options:\n');
    help += chalk.green('  --import-history       ') + chalk.white('Import messages from source session\n');
    help += chalk.green('  --from-session <id>    ') + chalk.white('Import from specific session (default: current)\n');
    help += chalk.green('  --from-date <date>     ') + chalk.white('Import messages from this date onwards\n');
    help += chalk.green('  --to-date <date>       ') + chalk.white('Import messages up to this date\n');
    help += chalk.green('  --date-range <s> <e>   ') + chalk.white('Import messages between dates\n\n');
    
    help += chalk.yellow('🤖 Model Options:\n');
    help += chalk.green('  --model <name>         ') + chalk.white('Start with specific model\n');
    help += chalk.green('  --provider <name>      ') + chalk.white('Start with specific provider\n\n');
    
    help += chalk.yellow('📚 Examples:\n');
    help += chalk.gray('  /new-session --directory ~/project --clone-git\n');
    help += chalk.gray('  /new-session --copy-files --import-history\n');
    help += chalk.gray('  /new-session --from-rewind "2025-11-28T10:00:00Z" --directory ~/recovered\n');
    help += chalk.gray('  /new-session --from-session 5 --date-range 01/11/2025 03/11/2025\n');
    
    return help;
  }
  
  /**
   * Generate help for /snapshots command
   */
  private static generateSnapshotsHelp(): string {
    return chalk.cyan('╔════════════════════════════════════════════════════════════════════════════╗\n') +
           chalk.cyan('║') + chalk.yellow.bold('                      📸 /SNAPSHOTS - REWIND POINTS                         ') + chalk.cyan('║\n') +
           chalk.cyan('╚════════════════════════════════════════════════════════════════════════════╝\n') +
           '\n' +
           chalk.white('List all available time points for rewinding.\n\n') +
           chalk.yellow('📋 Usage:\n') +
           chalk.gray('  /snapshots\n\n') +
           chalk.blue('💡 Use /rewind <timestamp> to time-travel to any point\n');
  }
}

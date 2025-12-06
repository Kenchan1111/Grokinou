/**
 * Execution Utilities
 * 
 * Helper functions for execution management (copy, save, format)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ExecutionState } from './execution-manager.js';

/**
 * Format execution output as readable text
 */
export function formatExecutionOutput(execution: ExecutionState): string {
  const lines: string[] = [];
  
  lines.push('═'.repeat(60));
  lines.push(`  EXECUTION: ${execution.toolName}`);
  lines.push('═'.repeat(60));
  lines.push('');
  
  lines.push(`ID:       ${execution.id}`);
  lines.push(`Status:   ${execution.status.toUpperCase()}`);
  lines.push(`Started:  ${execution.startTime.toLocaleString()}`);
  
  if (execution.endTime) {
    const duration = execution.endTime.getTime() - execution.startTime.getTime();
    lines.push(`Ended:    ${execution.endTime.toLocaleString()}`);
    lines.push(`Duration: ${(duration / 1000).toFixed(2)}s`);
  }
  
  lines.push('');
  
  // Chain of Thought
  if (execution.cot.length > 0) {
    lines.push('─'.repeat(60));
    lines.push('  CHAIN OF THOUGHT');
    lines.push('─'.repeat(60));
    
    execution.cot.forEach((entry, i) => {
      const icon = {
        thinking: '💭',
        action: '⚡',
        observation: '👁️',
        decision: '✅'
      }[entry.type];
      
      lines.push(`${i + 1}. [${entry.type.toUpperCase()}] ${icon} ${entry.content}`);
      if (entry.duration) {
        lines.push(`   Duration: ${entry.duration}ms`);
      }
    });
    
    lines.push('');
  }
  
  // Commands
  if (execution.commands.length > 0) {
    lines.push('─'.repeat(60));
    lines.push('  COMMANDS');
    lines.push('─'.repeat(60));
    
    execution.commands.forEach((cmd, i) => {
      lines.push('');
      lines.push(`Command ${i + 1}:`);
      lines.push(`  $ ${cmd.command}`);
      lines.push(`  Status: ${cmd.status} ${cmd.status === 'success' ? '✅' : '❌'}`);
      
      if (cmd.exitCode !== undefined) {
        lines.push(`  Exit code: ${cmd.exitCode}`);
      }
      
      if (cmd.output.length > 0) {
        lines.push(`  Output (${cmd.output.length} lines):`);
        cmd.output.forEach(line => {
          lines.push(`    ${line}`);
        });
      }
      
      if (cmd.error) {
        lines.push(`  Error: ${cmd.error}`);
      }
      
      lines.push(`  Duration: ${cmd.duration}ms`);
    });
    
    lines.push('');
  }
  
  // Metadata
  if (execution.metadata) {
    lines.push('─'.repeat(60));
    lines.push('  METADATA');
    lines.push('─'.repeat(60));
    lines.push(JSON.stringify(execution.metadata, null, 2));
    lines.push('');
  }
  
  lines.push('═'.repeat(60));
  
  return lines.join('\n');
}

/**
 * Copy execution to clipboard (placeholder - requires clipboard library)
 * 
 * NOTE: This is a placeholder. Actual clipboard functionality would require
 * a library like 'clipboardy' or platform-specific commands.
 */
export function copyExecutionToClipboard(execution: ExecutionState): void {
  const output = formatExecutionOutput(execution);

  // For now, just format the output silently
  // In production, use a clipboard library:
  // import clipboardy from 'clipboardy';
  // clipboardy.writeSync(output);

  // NOTE: No console.log here to avoid polluting Ink TUI
  // Feedback is handled by the calling component (ExecutionViewer)
}

/**
 * Save execution to file
 */
export async function saveExecutionToFile(execution: ExecutionState, customPath?: string): Promise<string> {
  // Determine save location
  const executionsDir = customPath || path.join(
    process.cwd(),
    '.grokinou',
    'executions'
  );
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(executionsDir)) {
    fs.mkdirSync(executionsDir, { recursive: true });
  }
  
  // Generate filename
  const timestamp = execution.startTime.toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const sanitizedToolName = execution.toolName.replace(/[^a-z0-9]/gi, '_');
  const filename = `${timestamp}_${sanitizedToolName}_${execution.id}.txt`;
  const filepath = path.join(executionsDir, filename);
  
  // Format and write
  const content = formatExecutionOutput(execution);
  fs.writeFileSync(filepath, content, 'utf-8');
  
  return filepath;
}

/**
 * Save execution as JSON
 */
export async function saveExecutionAsJSON(execution: ExecutionState, customPath?: string): Promise<string> {
  const executionsDir = customPath || path.join(
    process.cwd(),
    '.grokinou',
    'executions'
  );
  
  if (!fs.existsSync(executionsDir)) {
    fs.mkdirSync(executionsDir, { recursive: true });
  }
  
  const timestamp = execution.startTime.toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const sanitizedToolName = execution.toolName.replace(/[^a-z0-9]/gi, '_');
  const filename = `${timestamp}_${sanitizedToolName}_${execution.id}.json`;
  const filepath = path.join(executionsDir, filename);
  
  // Serialize with proper Date handling
  const serialized = JSON.stringify(execution, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);
  
  fs.writeFileSync(filepath, serialized, 'utf-8');
  
  return filepath;
}

/**
 * Get summary statistics from execution
 */
export function getExecutionStats(execution: ExecutionState): {
  totalDuration: number;
  commandCount: number;
  successRate: number;
  cotSteps: number;
  outputLines: number;
} {
  const totalDuration = execution.endTime 
    ? execution.endTime.getTime() - execution.startTime.getTime()
    : 0;
  
  const commandCount = execution.commands.length;
  const successCount = execution.commands.filter(cmd => cmd.status === 'success').length;
  const successRate = commandCount > 0 ? (successCount / commandCount) * 100 : 0;
  
  const cotSteps = execution.cot.length;
  const outputLines = execution.commands.reduce((sum, cmd) => sum + cmd.output.length, 0);
  
  return {
    totalDuration,
    commandCount,
    successRate,
    cotSteps,
    outputLines,
  };
}

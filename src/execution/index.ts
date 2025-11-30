/**
 * Execution Module
 * 
 * Exports for execution tracking and viewing
 */

export {
  ExecutionManager,
  ExecutionStream,
  executionManager
} from './execution-manager.js';

export type {
  COTType,
  CommandStatus,
  ExecutionStatus,
  COTEntry,
  CommandExecution,
  ExecutionState
} from './execution-manager.js';

export {
  formatExecutionOutput,
  copyExecutionToClipboard,
  saveExecutionToFile,
  saveExecutionAsJSON,
  getExecutionStats
} from './execution-utils.js';

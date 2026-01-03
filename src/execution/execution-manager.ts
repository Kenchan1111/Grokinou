/**
 * Execution Manager
 * 
 * Manages LLM tool executions with real-time event streaming for the Execution Viewer.
 * Provides COT (Chain of Thought) tracking and command output streaming.
 */

import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';

// ============================================================================
// TYPES
// ============================================================================

export type COTType = 'thinking' | 'action' | 'observation' | 'decision';
export type CommandStatus = 'pending' | 'running' | 'success' | 'error';
export type ExecutionStatus = 'running' | 'success' | 'error' | 'cancelled';

export interface COTEntry {
  timestamp: Date;
  type: COTType;
  content: string;
  duration?: number;
}

export interface CommandExecution {
  command: string;
  status: CommandStatus;
  output: string[];
  error?: string;
  exitCode?: number;
  duration: number;
  timestamp: Date;
  startTime: number;
}

export interface ExecutionState {
  id: string;
  toolName: string;
  startTime: Date;
  endTime?: Date;
  status: ExecutionStatus;
  cot: COTEntry[];
  commands: CommandExecution[];
  metadata?: Record<string, any>;
}

export interface ExecutionViewerState {
  selectedCommandIndex: number;
  scrollOffset: number;
  detailsMode: boolean;
}

// ============================================================================
// EXECUTION STREAM
// ============================================================================

/**
 * Stream for a single execution
 * Emits events for COT entries, command updates, and completion
 */
export class ExecutionStream extends EventEmitter {
  public readonly id: string;
  public readonly toolName: string;
  private startTime: Date;
  private currentCommand: CommandExecution | null = null;
  private state: ExecutionState;

  constructor(toolName: string, id?: string) {
    super();
    this.id = id || nanoid(10);
    this.toolName = toolName;
    this.startTime = new Date();
    
    this.state = {
      id: this.id,
      toolName,
      startTime: this.startTime,
      status: 'running',
      cot: [],
      commands: []
    };
  }

  /**
   * Get current state snapshot
   */
  getState(): ExecutionState {
    return { ...this.state };
  }

  /**
   * Emit a Chain of Thought entry
   */
  emitCOT(type: COTType, content: string, duration?: number): void {
    const entry: COTEntry = {
      timestamp: new Date(),
      type,
      content,
      duration
    };
    
    this.state.cot.push(entry);
    this.emit('cot', entry);
    this.emit('update', this.state);
  }

  /**
   * Start a new command execution
   */
  startCommand(command: string): void {
    const cmd: CommandExecution = {
      command,
      status: 'running',
      output: [],
      timestamp: new Date(),
      startTime: Date.now(),
      duration: 0
    };
    
    this.currentCommand = cmd;
    this.state.commands.push(cmd);
    
    this.emit('command:start', cmd);
    this.emit('update', this.state);
  }

  /**
   * Add output line to current command
   */
  commandOutput(line: string): void {
    if (!this.currentCommand) {
      console.warn('commandOutput called without active command');
      return;
    }
    
    this.currentCommand.output.push(line);
    this.emit('command:output', { command: this.currentCommand, line });
    this.emit('update', this.state);
  }

  /**
   * End current command execution
   */
  endCommand(exitCode: number, error?: string): void {
    if (!this.currentCommand) {
      console.warn('endCommand called without active command');
      return;
    }
    
    this.currentCommand.exitCode = exitCode;
    this.currentCommand.status = exitCode === 0 ? 'success' : 'error';
    this.currentCommand.error = error;
    this.currentCommand.duration = Date.now() - this.currentCommand.startTime;
    
    this.emit('command:end', this.currentCommand);
    this.emit('update', this.state);
    
    this.currentCommand = null;
  }

  /**
   * Complete the execution successfully
   */
  complete(metadata?: Record<string, any>): void {
    this.state.status = 'success';
    this.state.endTime = new Date();
    this.state.metadata = metadata;
    
    this.emit('complete', this.state);
    this.emit('update', this.state);
  }

  /**
   * Mark execution as failed
   */
  fail(error: string, metadata?: Record<string, any>): void {
    this.state.status = 'error';
    this.state.endTime = new Date();
    this.state.metadata = { ...metadata, error };
    
    this.emit('error', this.state);
    this.emit('update', this.state);
  }

  /**
   * Cancel the execution
   */
  cancel(): void {
    this.state.status = 'cancelled';
    this.state.endTime = new Date();
    
    this.emit('cancel', this.state);
    this.emit('update', this.state);
  }

  /**
   * Close the stream and remove all listeners
   */
  close(): void {
    this.removeAllListeners();
  }
}

// ============================================================================
// EXECUTION MANAGER
// ============================================================================

/**
 * Global manager for all executions
 * Provides centralized access to execution streams
 */
export class ExecutionManager extends EventEmitter {
  private executions = new Map<string, ExecutionStream>();
  private activeExecutions = new Set<string>();
  private executionHistory: ExecutionState[] = [];
  private maxHistorySize = 100;
  private selectedExecutionId: string | null = null;
  private viewerState: ExecutionViewerState = {
    selectedCommandIndex: 0,
    scrollOffset: 0,
    detailsMode: false,
  };

  /**
   * Create a new execution stream
   */
  createExecution(toolName: string, id?: string): ExecutionStream {
    const stream = new ExecutionStream(toolName, id);
    
    this.executions.set(stream.id, stream);
    this.activeExecutions.add(stream.id);
    
    // Listen to stream events
    stream.on('update', (state: ExecutionState) => {
      this.emit('execution:update', state);
    });
    
    stream.on('complete', (state: ExecutionState) => {
      this.activeExecutions.delete(stream.id);
      this.addToHistory(state);
      this.emit('execution:complete', state);
      
      // Auto-cleanup after 5 minutes
      setTimeout(() => this.closeExecution(stream.id), 5 * 60 * 1000);
    });
    
    stream.on('error', (state: ExecutionState) => {
      this.activeExecutions.delete(stream.id);
      this.addToHistory(state);
      this.emit('execution:error', state);
    });
    
    stream.on('cancel', (state: ExecutionState) => {
      this.activeExecutions.delete(stream.id);
      this.addToHistory(state);
      this.emit('execution:cancel', state);
    });
    
    this.emit('execution:start', stream.getState());
    
    return stream;
  }

  /**
   * Get an execution stream by ID
   */
  getExecution(id: string): ExecutionStream | undefined {
    return this.executions.get(id);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): ExecutionState[] {
    return Array.from(this.activeExecutions)
      .map(id => this.executions.get(id)?.getState())
      .filter((state): state is ExecutionState => state !== undefined);
  }

  /**
   * Get execution history
   */
  getHistory(limit?: number): ExecutionState[] {
    const history = [...this.executionHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  getSelectedExecutionId(): string | null {
    return this.selectedExecutionId;
  }

  setSelectedExecutionId(id: string | null): void {
    this.selectedExecutionId = id;
    this.emit('execution:selected', id);
  }

  getViewerState(): ExecutionViewerState {
    return { ...this.viewerState };
  }

  setViewerState(next: Partial<ExecutionViewerState>): void {
    const updated: ExecutionViewerState = {
      ...this.viewerState,
      ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)),
    } as ExecutionViewerState;
    if (
      updated.selectedCommandIndex === this.viewerState.selectedCommandIndex &&
      updated.scrollOffset === this.viewerState.scrollOffset &&
      updated.detailsMode === this.viewerState.detailsMode
    ) {
      return;
    }
    this.viewerState = updated;
    this.emit('execution:viewer', this.viewerState);
  }

  onViewerState(callback: (state: ExecutionViewerState) => void): () => void {
    this.on('execution:viewer', callback);
    return () => this.off('execution:viewer', callback);
  }

  /**
   * Check if there are active executions
   */
  hasActiveExecutions(): boolean {
    return this.activeExecutions.size > 0;
  }

  /**
   * Subscribe to all execution updates
   */
  subscribeToAll(callback: (state: ExecutionState) => void): () => void {
    this.on('execution:update', callback);
    return () => this.off('execution:update', callback);
  }

  /**
   * Subscribe to execution lifecycle events
   */
  onExecutionStart(callback: (state: ExecutionState) => void): () => void {
    this.on('execution:start', callback);
    return () => this.off('execution:start', callback);
  }

  onExecutionEnd(callback: (state: ExecutionState) => void): () => void {
    const handler = (state: ExecutionState) => callback(state);
    this.on('execution:complete', handler);
    this.on('execution:error', handler);
    this.on('execution:cancel', handler);
    
    return () => {
      this.off('execution:complete', handler);
      this.off('execution:error', handler);
      this.off('execution:cancel', handler);
    };
  }

  /**
   * Close an execution and remove it
   */
  closeExecution(id: string): void {
    const stream = this.executions.get(id);
    if (stream) {
      stream.close();
      this.executions.delete(id);
      this.activeExecutions.delete(id);
    }
  }

  /**
   * Clear all executions
   */
  clearAll(): void {
    this.executions.forEach(stream => stream.close());
    this.executions.clear();
    this.activeExecutions.clear();
  }

  /**
   * Add execution to history
   * 
   * NOTE: Timeline.db persistence is handled by ToolHook in grok-agent.ts
   * to avoid duplication. ExecutionManager focuses on real-time UI updates.
   */
  private addToHistory(state: ExecutionState): void {
    this.executionHistory.push(state);
    
    // Trim history if too large
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const executionManager = new ExecutionManager();

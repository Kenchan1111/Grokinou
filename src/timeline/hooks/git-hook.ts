/**
 * Git Hook - Automatic Git Command Tracking
 * 
 * Captures git operations (commit, push, pull, merge, etc.) and logs them
 * to the timeline for complete version control history.
 * 
 * Features:
 * - Wrapper for common git commands
 * - Automatic commit tracking
 * - Branch and merge detection
 * - Integration with Merkle DAG
 * - Singleton pattern
 * 
 * @module timeline/hooks/git-hook
 * @version 1.0.0
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { EventBus } from '../event-bus.js';
import { EventType } from '../event-types.js';
import type { GitCommitPayload } from '../event-types.js';

const execAsync = promisify(exec);

/**
 * Git Hook Configuration
 */
export interface GitHookConfig {
  /**
   * Enable git tracking
   */
  enabled?: boolean;

  /**
   * Git repository path (default: current working directory)
   */
  repoPath?: string;

  /**
   * Commands to track (default: all)
   */
  trackCommands?: ('commit' | 'push' | 'pull' | 'merge' | 'rebase' | 'checkout')[];
}

/**
 * Git Command Result
 */
export interface GitCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Git Commit Info
 */
export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  email: string;
  timestamp: Date;
  filesChanged: number;
  insertions: number;
  deletions: number;
  branch: string;
}

/**
 * Git Hook for tracking git operations
 */
export class GitHook {
  private static instance: GitHook;
  private bus: EventBus;
  private config: Required<GitHookConfig>;
  private isEnabled: boolean = false;

  private constructor(config: GitHookConfig = {}) {
    this.bus = EventBus.getInstance();
    this.config = {
      enabled: config.enabled ?? true,
      repoPath: config.repoPath ?? process.cwd(),
      trackCommands: config.trackCommands ?? ['commit', 'push', 'pull', 'merge', 'rebase', 'checkout'],
    };
    this.isEnabled = this.config.enabled;
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: GitHookConfig): GitHook {
    if (!GitHook.instance) {
      GitHook.instance = new GitHook(config);
    }
    return GitHook.instance;
  }

  /**
   * Execute git command and capture output
   */
  private async executeGit(args: string[]): Promise<GitCommandResult> {
    const command = `git ${args.join(' ')}`;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.config.repoPath,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      
      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message || '',
        exitCode: error.code || 1,
      };
    }
  }

  /**
   * Get current branch name
   */
  private async getCurrentBranch(): Promise<string> {
    const result = await this.executeGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    return result.success ? result.stdout : 'unknown';
  }

  /**
   * Get last commit info
   */
  async getLastCommitInfo(): Promise<GitCommitInfo | null> {
    try {
      // Get commit hash
      const hashResult = await this.executeGit(['rev-parse', 'HEAD']);
      if (!hashResult.success) return null;
      const hash = hashResult.stdout;

      // Get commit details
      const detailsResult = await this.executeGit([
        'log', '-1', '--format=%s%n%an%n%ae%n%at', hash
      ]);
      if (!detailsResult.success) return null;
      
      const [message, author, email, timestamp] = detailsResult.stdout.split('\n');

      // Get stats
      const statsResult = await this.executeGit([
        'show', '--stat', '--format=', hash
      ]);
      
      let filesChanged = 0;
      let insertions = 0;
      let deletions = 0;
      
      if (statsResult.success) {
        const lines = statsResult.stdout.split('\n');
        const summaryLine = lines[lines.length - 1];
        const match = summaryLine.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
        if (match) {
          filesChanged = parseInt(match[1] || '0');
          insertions = parseInt(match[2] || '0');
          deletions = parseInt(match[3] || '0');
        }
      }

      // Get branch
      const branch = await this.getCurrentBranch();

      return {
        hash,
        message,
        author,
        email,
        timestamp: new Date(parseInt(timestamp) * 1000),
        filesChanged,
        insertions,
        deletions,
        branch,
      };
    } catch (error) {
      console.error('Failed to get commit info:', error);
      return null;
    }
  }

  /**
   * Capture git commit
   */
  async captureCommit(sessionId: number = 0): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const commitInfo = await this.getLastCommitInfo();
      if (!commitInfo) return;

      await this.bus.emit({
        event_type: EventType.GIT_COMMIT,
        actor: `git:${commitInfo.author}`,
        aggregate_id: commitInfo.hash,
        aggregate_type: 'git_commit',
        payload: {
          hash: commitInfo.hash,
          message: commitInfo.message,
          author: commitInfo.author,
          email: commitInfo.email,
          files_changed: commitInfo.filesChanged,
          insertions: commitInfo.insertions,
          deletions: commitInfo.deletions,
          session_id: sessionId,
        } as GitCommitPayload,
      });
    } catch (error) {
      console.error('Failed to capture git commit:', error);
    }
  }

  /**
   * Capture git push
   */
  async capturePush(remote: string, branch: string, sessionId: number = 0): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.bus.emit({
        event_type: EventType.GIT_PUSH,
        actor: 'git',
        aggregate_id: `${remote}/${branch}`,
        aggregate_type: 'git_push',
        payload: {
          remote,
          branch,
          timestamp: Date.now(),
          session_id: sessionId,
        },
      });
    } catch (error) {
      console.error('Failed to capture git push:', error);
    }
  }

  /**
   * Capture git pull
   */
  async capturePull(remote: string, branch: string, sessionId: number = 0): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.bus.emit({
        event_type: EventType.GIT_PULL,
        actor: 'git',
        aggregate_id: `${remote}/${branch}`,
        aggregate_type: 'git_pull',
        payload: {
          remote,
          branch,
          timestamp: Date.now(),
          session_id: sessionId,
        },
      });
    } catch (error) {
      console.error('Failed to capture git pull:', error);
    }
  }

  /**
   * Capture git merge
   */
  async captureMerge(sourceBranch: string, targetBranch: string, sessionId: number = 0): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.bus.emit({
        event_type: EventType.GIT_MERGE,
        actor: 'git',
        aggregate_id: `${sourceBranch}->${targetBranch}`,
        aggregate_type: 'git_merge',
        payload: {
          source_branch: sourceBranch,
          target_branch: targetBranch,
          timestamp: Date.now(),
          session_id: sessionId,
        },
      });
    } catch (error) {
      console.error('Failed to capture git merge:', error);
    }
  }

  /**
   * Capture git checkout (branch switch)
   */
  async captureCheckout(branch: string, sessionId: number = 0): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.bus.emit({
        event_type: EventType.GIT_BRANCH_SWITCHED,
        actor: 'git',
        aggregate_id: branch,
        aggregate_type: 'git_checkout',
        payload: {
          branch,
          timestamp: Date.now(),
          session_id: sessionId,
        },
      });
    } catch (error) {
      console.error('Failed to capture git checkout:', error);
    }
  }

  /**
   * Wrapper for git commit command
   * 
   * Use this instead of calling git commit directly to automatically
   * capture the commit in the timeline.
   */
  async commit(message: string, options: string[] = []): Promise<GitCommandResult> {
    const args = ['commit', '-m', message, ...options];
    const result = await this.executeGit(args);
    
    if (result.success) {
      await this.captureCommit();
    }
    
    return result;
  }

  /**
   * Wrapper for git push command
   */
  async push(remote: string = 'origin', branch?: string, options: string[] = []): Promise<GitCommandResult> {
    const currentBranch = branch || await this.getCurrentBranch();
    const args = ['push', remote, currentBranch, ...options];
    const result = await this.executeGit(args);
    
    if (result.success) {
      await this.capturePush(remote, currentBranch);
    }
    
    return result;
  }

  /**
   * Wrapper for git pull command
   */
  async pull(remote: string = 'origin', branch?: string, options: string[] = []): Promise<GitCommandResult> {
    const currentBranch = branch || await this.getCurrentBranch();
    const args = ['pull', remote, currentBranch, ...options];
    const result = await this.executeGit(args);
    
    if (result.success) {
      await this.capturePull(remote, currentBranch);
    }
    
    return result;
  }

  /**
   * Check if repository is clean (no uncommitted changes)
   */
  async isClean(): Promise<boolean> {
    const result = await this.executeGit(['status', '--porcelain']);
    return result.success && result.stdout === '';
  }

  /**
   * Get current repository status
   */
  async getStatus(): Promise<{
    branch: string;
    ahead: number;
    behind: number;
    modified: number;
    added: number;
    deleted: number;
    untracked: number;
  }> {
    const branch = await this.getCurrentBranch();
    
    // Get ahead/behind counts
    let ahead = 0;
    let behind = 0;
    const revResult = await this.executeGit(['rev-list', '--left-right', '--count', `${branch}...origin/${branch}`]);
    if (revResult.success) {
      const [a, b] = revResult.stdout.split('\t').map(Number);
      ahead = a || 0;
      behind = b || 0;
    }
    
    // Get file counts
    let modified = 0;
    let added = 0;
    let deleted = 0;
    let untracked = 0;
    
    const statusResult = await this.executeGit(['status', '--porcelain']);
    if (statusResult.success) {
      const lines = statusResult.stdout.split('\n');
      for (const line of lines) {
        if (!line) continue;
        const status = line.substring(0, 2);
        if (status.includes('M')) modified++;
        if (status.includes('A')) added++;
        if (status.includes('D')) deleted++;
        if (status.includes('?')) untracked++;
      }
    }
    
    return { branch, ahead, behind, modified, added, deleted, untracked };
  }

  /**
   * Enable git tracking
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable git tracking
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * Check if git tracking is enabled
   */
  isActive(): boolean {
    return this.isEnabled;
  }
}

/**
 * Get GitHook singleton instance
 */
export function getGitHook(config?: GitHookConfig): GitHook {
  return GitHook.getInstance(config);
}

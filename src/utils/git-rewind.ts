/**
 * Git Rewind Manager
 * Synchronize conversation history and code state to specific dates
 */

import { execAsync } from './exec-async.js';
import * as fs from 'fs';
import * as path from 'path';

export interface GitCommit {
  hash: string;
  date: Date;
  message: string;
  author: string;
}

export interface RewindInfo {
  rewind_date: Date;
  source_repo: string;
  source_session_id: number;
  date_range: { start: Date; end: Date };
  git_commits: GitCommit[];
  target_commit: string;
  files_copied: number;
  conversation_messages: number;
  extraction_method: 'archive' | 'clone';
}

export class GitRewindManager {
  /**
   * Perform Git rewind to specific date range
   */
  async performRewind(
    sourceWorkdir: string,
    targetWorkdir: string,
    dateRange: { start: Date; end: Date },
    sessionId: number,
    options?: { preserveGitHistory?: boolean }
  ): Promise<RewindInfo> {
    
    // Check if source is Git repo
    if (!await this.isGitRepo(sourceWorkdir)) {
      throw new Error('Source directory is not a Git repository');
    }
    
    // Find commits in date range
    const commits = await this.findCommitsInRange(sourceWorkdir, dateRange);
    
    if (commits.length === 0) {
      // Fallback: find closest commit before end date
      const closestCommit = await this.findClosestCommitBefore(sourceWorkdir, dateRange.end);
      
      if (!closestCommit) {
        throw new Error(`No commits found before ${dateRange.end.toISOString()}`);
      }
      
      console.warn(
        `⚠️  No commits in date range. Using closest commit before:\n` +
        `   ${closestCommit.hash} (${closestCommit.date.toLocaleString()})`
      );
      
      commits.push(closestCommit);
    }
    
    // Target commit = last commit in range
    const targetCommit = commits[commits.length - 1];
    
    // Extract files using chosen method
    let fileCount: number;
    let extractionMethod: 'archive' | 'clone';
    
    if (options?.preserveGitHistory) {
      // Option: Clone + Checkout (full history)
      fileCount = await this.extractWithClone(sourceWorkdir, targetWorkdir, targetCommit.hash);
      extractionMethod = 'clone';
    } else {
      // Default: git archive (lightweight, RECOMMENDED)
      fileCount = await this.extractWithArchive(sourceWorkdir, targetWorkdir, targetCommit.hash);
      extractionMethod = 'archive';
    }
    
    // Create rewind info
    const rewindInfo: RewindInfo = {
      rewind_date: new Date(),
      source_repo: sourceWorkdir,
      source_session_id: sessionId,
      date_range: dateRange,
      git_commits: commits,
      target_commit: targetCommit.hash,
      files_copied: fileCount,
      conversation_messages: 0, // Will be filled by caller
      extraction_method: extractionMethod
    };
    
    await this.createRewindInfo(targetWorkdir, rewindInfo);
    
    return rewindInfo;
  }
  
  /**
   * Find Git commits in date range
   */
  private async findCommitsInRange(
    workdir: string,
    dateRange: { start: Date; end: Date }
  ): Promise<GitCommit[]> {
    
    const startStr = dateRange.start.toISOString();
    const endStr = dateRange.end.toISOString();
    
    // git log with date filtering
    const cmd = `git log --since="${startStr}" --until="${endStr}" --pretty=format:"%H|%aI|%an|%s" --all`;
    
    try {
      const { stdout } = await execAsync(cmd, { cwd: workdir });
      
      if (!stdout.trim()) {
        return [];
      }
      
      const commits: GitCommit[] = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, dateStr, author, message] = line.split('|');
          return {
            hash,
            date: new Date(dateStr),
            author,
            message
          };
        });
      
      return commits;
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Find closest commit before a date
   */
  private async findClosestCommitBefore(
    workdir: string,
    beforeDate: Date
  ): Promise<GitCommit | null> {
    
    const beforeStr = beforeDate.toISOString();
    const cmd = `git log --until="${beforeStr}" --pretty=format:"%H|%aI|%an|%s" --max-count=1 --all`;
    
    try {
      const { stdout } = await execAsync(cmd, { cwd: workdir });
      
      if (!stdout.trim()) {
        return null;
      }
      
      const [hash, dateStr, author, message] = stdout.trim().split('|');
      return {
        hash,
        date: new Date(dateStr),
        author,
        message
      };
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Extract files using git archive (lightweight)
   */
  private async extractWithArchive(
    sourceWorkdir: string,
    targetWorkdir: string,
    commitHash: string
  ): Promise<number> {
    
    // Create target directory
    fs.mkdirSync(targetWorkdir, { recursive: true });
    
    // Extract files using git archive
    const cmd = `git archive ${commitHash} | tar -x -C "${targetWorkdir}"`;
    await execAsync(cmd, { cwd: sourceWorkdir });
    
    // Count files
    const fileCount = await this.countFiles(targetWorkdir);
    
    return fileCount;
  }
  
  /**
   * Extract files using clone (full history)
   */
  private async extractWithClone(
    sourceWorkdir: string,
    targetWorkdir: string,
    commitHash: string
  ): Promise<number> {
    
    // Clone repository
    await execAsync(`git clone "${sourceWorkdir}" "${targetWorkdir}"`);
    
    // Checkout target commit
    await execAsync(`git checkout ${commitHash}`, { cwd: targetWorkdir });
    
    // Count files
    const fileCount = await this.countFiles(targetWorkdir);
    
    return fileCount;
  }
  
  /**
   * Count files in directory (excluding .git)
   */
  private async countFiles(directory: string): Promise<number> {
    let count = 0;
    
    const walkDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        // Skip .git directory
        if (file === '.git') continue;
        
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          walkDir(filePath);
        } else {
          count++;
        }
      }
    };
    
    walkDir(directory);
    return count;
  }
  
  /**
   * Check if directory is a Git repository
   */
  private async isGitRepo(workdir: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: workdir });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Create rewind metadata file
   */
  private async createRewindInfo(targetDir: string, info: RewindInfo): Promise<void> {
    const infoPath = path.join(targetDir, '.git-rewind-info.json');
    
    const json = JSON.stringify({
      rewind_date: info.rewind_date.toISOString(),
      source_repo: info.source_repo,
      source_session_id: info.source_session_id,
      date_range: {
        start: info.date_range.start.toISOString(),
        end: info.date_range.end.toISOString()
      },
      git_commits: info.git_commits.map(c => ({
        hash: c.hash,
        date: c.date.toISOString(),
        author: c.author,
        message: c.message
      })),
      target_commit: info.target_commit,
      files_copied: info.files_copied,
      conversation_messages: info.conversation_messages,
      extraction_method: info.extraction_method
    }, null, 2);
    
    fs.writeFileSync(infoPath, json, 'utf-8');
  }
  
  /**
   * Update rewind info (e.g., with conversation message count)
   */
  async updateRewindInfo(targetDir: string, info: RewindInfo): Promise<void> {
    await this.createRewindInfo(targetDir, info);
  }
}

import * as fs from 'fs-extra';
import * as path from 'path';

export interface SearchInFilesCommand {
  type: 'search_in_files';
  pattern: string;
  caseInsensitive?: boolean;
  regex?: boolean;
  wholeWord?: boolean;
  fileTypes?: string[];  // e.g., ['ts', 'tsx', 'js']
  excludeDirs?: string[];
  maxResults?: number;
}

export interface ContentMatch {
  file: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * Parse /search_in_files command
 *
 * Formats:
 * - /search_in_files "TODO:"
 * - /search_in_files <chatviewmax> --type=tsx
 * - /search_in_files "function.*component" --regex
 * - /search_in_files error --whole-word
 */
export function parseSearchInFilesCommand(input: string): SearchInFilesCommand | null {
  const match = input.match(/^\/search_in_files\s+(.+)$/);
  if (!match) return null;

  let pattern = match[1].trim();
  let caseInsensitive = true;
  let regex = false;
  let wholeWord = false;
  let fileTypes: string[] = [];
  const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.cache'];
  const maxResults = 1000;

  // Parse --type flag
  const typeMatch = pattern.match(/--type=(\w+)/);
  if (typeMatch) {
    fileTypes = [typeMatch[1]];
    pattern = pattern.replace(/--type=\w+/g, '').trim();
  }

  // Parse other flags
  if (pattern.includes('--regex')) {
    regex = true;
    pattern = pattern.replace(/--regex/g, '').trim();
  }
  if (pattern.includes('--case-sensitive')) {
    caseInsensitive = false;
    pattern = pattern.replace(/--case-sensitive/g, '').trim();
  }
  if (pattern.includes('--whole-word')) {
    wholeWord = true;
    pattern = pattern.replace(/--whole-word/g, '').trim();
  }

  // Remove quotes
  pattern = pattern.replace(/^["']|["']$/g, '');

  if (!pattern) return null;

  return {
    type: 'search_in_files',
    pattern,
    caseInsensitive,
    regex,
    wholeWord,
    fileTypes,
    excludeDirs,
    maxResults,
  };
}

/**
 * Execute content search (pure TypeScript, no ripgrep dependency)
 */
export async function executeSearchInFilesCommand(
  command: SearchInFilesCommand,
  rootDir: string = process.cwd()
): Promise<ContentMatch[]> {
  const results: ContentMatch[] = [];
  const { pattern, caseInsensitive, regex, wholeWord, fileTypes, excludeDirs, maxResults } = command;

  // Build search regex
  let searchPattern = pattern;
  if (wholeWord && !regex) {
    searchPattern = `\\b${pattern}\\b`;
  }
  const searchRegex = new RegExp(searchPattern, caseInsensitive ? 'gi' : 'g');

  // Recursive walk
  async function walk(dir: string, depth: number = 0): Promise<void> {
    if (depth > 1000 || results.length >= maxResults!) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults!) break;

        // Skip excluded directories
        if (entry.isDirectory() && excludeDirs!.includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootDir, fullPath);

        if (entry.isFile()) {
          // Filter by file type if specified
          if (fileTypes!.length > 0) {
            const ext = path.extname(entry.name).slice(1);  // Remove leading dot
            if (!fileTypes!.includes(ext)) continue;
          }

          // Skip binary files and very large files
          const stats = await fs.stat(fullPath);
          if (stats.size > 5 * 1024 * 1024) continue;  // Skip files > 5MB

          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
              if (results.length >= maxResults!) return;

              // Reset regex for each line
              searchRegex.lastIndex = 0;
              let match;
              while ((match = searchRegex.exec(line)) !== null) {
                results.push({
                  file: relativePath,
                  lineNumber: index + 1,
                  lineContent: line.trim(),
                  matchStart: match.index,
                  matchEnd: match.index + match[0].length,
                });

                if (results.length >= maxResults!) break;
              }
            });
          } catch (error) {
            // Skip files we can't read (binary, permissions, etc.)
          }
        } else if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await walk(rootDir);
  return results;
}

/**
 * Format results for display
 */
export function formatSearchInFilesResults(results: ContentMatch[], pattern: string): string {
  if (results.length === 0) {
    return `No matches found for "${pattern}"`;
  }

  const lines = [`Found ${results.length} match(es) for "${pattern}":\n`];

  // Group by file
  const byFile = new Map<string, ContentMatch[]>();
  results.forEach(r => {
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file)!.push(r);
  });

  // Limit display to first 50 files
  const MAX_FILES = 50;
  const MAX_MATCHES_PER_FILE = 10;
  let fileCount = 0;

  for (const [file, matches] of byFile) {
    if (fileCount >= MAX_FILES) {
      const remainingFiles = byFile.size - fileCount;
      lines.push(`\n... and ${remainingFiles} more file(s) with matches`);
      break;
    }

    lines.push(`\n📄 ${file} (${matches.length} match${matches.length > 1 ? 'es' : ''}):`);

    // Show first N matches per file
    const displayMatches = matches.slice(0, MAX_MATCHES_PER_FILE);
    displayMatches.forEach(m => {
      // Simple highlight with ** markers
      const before = m.lineContent.substring(0, m.matchStart);
      const match = m.lineContent.substring(m.matchStart, m.matchEnd);
      const after = m.lineContent.substring(m.matchEnd);

      lines.push(`   ${m.lineNumber}: ${before}**${match}**${after}`);
    });

    if (matches.length > MAX_MATCHES_PER_FILE) {
      const remaining = matches.length - MAX_MATCHES_PER_FILE;
      lines.push(`   ... and ${remaining} more match(es) in this file`);
    }

    fileCount++;
  }

  return lines.join('\n');
}

/**
 * Check if input is a search in files command
 */
export function isSearchInFilesCommand(input: string): boolean {
  return input.trim().startsWith('/search_in_files');
}

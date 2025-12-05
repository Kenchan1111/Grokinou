import * as fs from 'fs-extra';
import * as path from 'path';

export interface SearchFilesCommand {
  type: 'search_files';
  pattern: string;
  caseInsensitive?: boolean;
  regex?: boolean;
  excludeDirs?: string[];
}

export interface FileMatch {
  relativePath: string;
  fileName: string;
  directory: string;
  score: number;  // Relevance score (exact match = 100, partial = lower)
}

/**
 * Parse /search_files command
 *
 * Formats:
 * - /search_files chat
 * - /search_files *.tsx
 * - /search_files "chat-interface" --regex
 * - /search_files component --case-sensitive
 */
export function parseSearchFilesCommand(input: string): SearchFilesCommand | null {
  const match = input.match(/^\/search_files\s+(.+)$/);
  if (!match) return null;

  let pattern = match[1].trim();
  let caseInsensitive = true;  // Default
  let regex = false;
  const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.cache'];

  // Parse flags
  if (pattern.includes('--regex')) {
    regex = true;
    pattern = pattern.replace(/--regex/g, '').trim();
  }
  if (pattern.includes('--case-sensitive')) {
    caseInsensitive = false;
    pattern = pattern.replace(/--case-sensitive/g, '').trim();
  }

  // Remove quotes
  pattern = pattern.replace(/^["']|["']$/g, '');

  if (!pattern) return null;

  return {
    type: 'search_files',
    pattern,
    caseInsensitive,
    regex,
    excludeDirs,
  };
}

/**
 * Execute file name search (pure TypeScript)
 */
export async function executeSearchFilesCommand(
  command: SearchFilesCommand,
  rootDir: string = process.cwd()
): Promise<FileMatch[]> {
  const results: FileMatch[] = [];
  const { pattern, caseInsensitive, regex, excludeDirs } = command;

  // Convert glob pattern to regex if needed
  let searchRegex: RegExp;
  if (regex) {
    searchRegex = new RegExp(pattern, caseInsensitive ? 'i' : '');
  } else {
    // Convert glob-like patterns (* and ?) to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    searchRegex = new RegExp(regexPattern, caseInsensitive ? 'i' : '');
  }

  // Recursive walk
  async function walk(dir: string, depth: number = 0): Promise<void> {
    if (depth > 1000 || results.length >= 10000) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= 10000) break;

        // Skip excluded directories
        if (entry.isDirectory() && excludeDirs!.includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootDir, fullPath);

        if (entry.isFile()) {
          // Test filename against pattern
          if (searchRegex.test(entry.name)) {
            const score = calculateScore(entry.name, pattern, caseInsensitive!);
            results.push({
              relativePath,
              fileName: entry.name,
              directory: path.dirname(relativePath),
              score,
            });
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

  // Sort by score (exact matches first)
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Calculate relevance score
 */
function calculateScore(fileName: string, pattern: string, caseInsensitive: boolean): number {
  const name = caseInsensitive ? fileName.toLowerCase() : fileName;
  const pat = caseInsensitive ? pattern.toLowerCase() : pattern;

  // Exact match
  if (name === pat) return 100;

  // Starts with pattern
  if (name.startsWith(pat)) return 80;

  // Contains pattern
  if (name.includes(pat)) return 60;

  // Partial match (fuzzy)
  return 40;
}

/**
 * Format results for display
 */
export function formatSearchFilesResults(results: FileMatch[], pattern: string): string {
  if (results.length === 0) {
    return `No files found matching "${pattern}"`;
  }

  const lines = [`Found ${results.length} file(s) matching "${pattern}":\n`];

  // Group by directory for better readability
  const byDir = new Map<string, FileMatch[]>();
  results.forEach(r => {
    const dir = r.directory || '.';
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(r);
  });

  // Limit display to first 100 files
  const MAX_DISPLAY = 100;
  let displayCount = 0;

  for (const [dir, files] of byDir) {
    if (displayCount >= MAX_DISPLAY) {
      const remaining = results.length - displayCount;
      lines.push(`\n... and ${remaining} more file(s)`);
      break;
    }

    lines.push(`\n📁 ${dir}/`);
    for (const f of files) {
      if (displayCount >= MAX_DISPLAY) break;
      lines.push(`   ${f.fileName}`);
      displayCount++;
    }
  }

  return lines.join('\n');
}

/**
 * Check if input is a search files command
 */
export function isSearchFilesCommand(input: string): boolean {
  return input.trim().startsWith('/search_files');
}

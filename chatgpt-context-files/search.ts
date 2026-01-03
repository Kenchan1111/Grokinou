import { spawn } from "child_process";
import { ToolResult } from "../types/index.js";
import { ConfirmationService } from "../utils/confirmation-service.js";
import * as fs from "fs-extra";
import * as path from "path";
import { SearchCache } from "../utils/search-cache.js";
import os from "os";
import { FTSSearch } from "./fts-search.js";

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  text: string;
  match: string;
}

export interface FileSearchResult {
  path: string;
  name: string;
  score: number;
}

export interface UnifiedSearchResult {
  type: "text" | "file";
  file: string;
  line?: number;
  column?: number;
  text?: string;
  match?: string;
  score?: number;
}

export class SearchTool {
  private confirmationService = ConfirmationService.getInstance();
  private currentDirectory: string = process.cwd();
  private searchCache: SearchCache;
  private ftsSearch: FTSSearch;

  constructor(dbPath?: string) {
    // Allow overriding DB path for tests; default to ~/.grok/search-cache.db
    this.searchCache = new SearchCache(
      dbPath ||
        path.join(os.homedir(), ".grok", "search-cache.db")
    );
    this.ftsSearch = new FTSSearch();
  }

  /**
   * Unified search method that can search for text content or find files
   */
  async search(
    query: string,
    options: {
      searchType?: "text" | "files" | "both";
      searchContext?: string; // Context for intelligent ranking
      includePattern?: string;
      excludePattern?: string;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      regex?: boolean;
      maxResults?: number;
      fileTypes?: string[];
      excludeFiles?: string[];
      includeHidden?: boolean;
    } = {}
  ): Promise<ToolResult> {
    try {
      // Basic validation & sanitization of the query to avoid runtime errors
      if (query == null) {
        return {
          success: false,
          error: "Search error: query is required (received null or undefined)",
        };
      }

      if (typeof query !== "string") {
        return {
          success: false,
          error: `Search error: query must be a string, received: ${typeof query}`,
        };
      }

      const sanitizedQuery = query.trim();
      if (!sanitizedQuery.length) {
        return {
          success: false,
          error: "Search error: query cannot be empty or whitespace only",
        };
      }

      const searchType = options.searchType || "both";
      const results: UnifiedSearchResult[] = [];

      // Search for text content if requested
      if (searchType === "text" || searchType === "both") {
        const textResults = await this.executeRipgrep(sanitizedQuery, options);
        results.push(
          ...textResults.map((r) => ({
            type: "text" as const,
            file: r.file,
            line: r.line,
            column: r.column,
            text: r.text,
            match: r.match,
          }))
        );
      }

      // Search for files if requested
      if (searchType === "files" || searchType === "both") {
        const fileResults = await this.findFilesByPattern(
          sanitizedQuery,
          options
        );
        results.push(
          ...fileResults.map((r) => ({
            type: "file" as const,
            file: r.path,
            score: r.score,
          }))
        );
      }

      if (results.length === 0) {
        return {
          success: true,
          output: `No results found for "${query}"`,
        };
      }

      // Always compute a relevance score (fall back to query as context)
      const rankingContext = options.searchContext || sanitizedQuery;
      results.forEach((result) => {
        result.score = this.scoreResult(result, rankingContext, options);
      });

      // Sort by score (descending)
      results.sort((a, b) => (b.score || 0) - (a.score || 0));

      // Persist all results to cache for pagination / replay
      const searchId = this.searchCache.createSearch(
        sanitizedQuery,
        options.searchContext
      );
      this.searchCache.addResults(
        searchId,
        results.map((r) => ({
          file: r.file,
          line: r.line,
          column: r.column,
          text: r.text,
          score: r.score,
        }))
      );

      // Determine cutoff using an improved elbow (std-dev aware)
      const {
        topResults,
        remainingCount,
        cutoffScore,
        maxScore,
      } = this.applyAdaptiveCutoff(results);

      // Track how many we showed and set last_seen_id based on insertion order.
      // We inserted rows in ranked order; ids are contiguous starting at firstId.
      const firstId = this.searchCache.getFirstId(searchId);
      const lastId = firstId !== null ? firstId + topResults.length - 1 : undefined;
      this.searchCache.markShownAndGetRemaining(searchId, topResults.length, lastId);

      const formattedOutput = this.formatUnifiedResults(
        topResults,
        sanitizedQuery,
        searchType
      );

      if (remainingCount > 0) {
        const cutoffDisplay = cutoffScore.toFixed(2);
        const maxDisplay = maxScore.toFixed(2);
        return {
          success: true,
          output:
            formattedOutput +
            `\n\n⚠️ ${remainingCount} additional results cached (search #${searchId})` +
            ` — cutoff ≈ ${cutoffDisplay}/${maxDisplay}.` +
            `\nRefine your query (file_types, include_pattern, search_context) or ask to stream more from search #${searchId}.`,
        };
      }

      return {
        success: true,
        output: formattedOutput,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Search error: ${error.message}`,
      };
    }
  }

  /**
   * Placeholder for future advanced mode (FTS/semantic). Currently delegates to search().
   * Kept separate so we can evolve without breaking the basic search tool.
   */
  async searchAdvanced(
    query: string,
    options: {
      searchType?: "text" | "files" | "both";
      searchContext?: string; // Context for intelligent ranking
      includePattern?: string;
      excludePattern?: string;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      regex?: boolean;
      maxResults?: number;
      fileTypes?: string[];
      excludeFiles?: string[];
      includeHidden?: boolean;
    } = {}
  ): Promise<ToolResult> {
    try {
      const sanitizedQuery = (query || "").trim();
      if (!sanitizedQuery) {
        return { success: false, error: "Search error: query cannot be empty" };
      }

      // Rebuild FTS index for current directory (simple full rebuild for now)
      await this.ftsSearch.indexDirectory(this.currentDirectory);

      // Use FTS query; limit results
      const limit = options.maxResults && options.maxResults > 0 ? options.maxResults : 50;
      const rows = this.ftsSearch.search(sanitizedQuery, limit);

      if (!rows.length) {
        return { success: true, output: `No FTS results found for "${sanitizedQuery}"` };
      }

      const formatted = rows
        .map((r, idx) => `${idx + 1}. ${r.path}\n   ${r.snippet}`)
        .join("\n\n");

      return {
        success: true,
        output: `FTS results for "${sanitizedQuery}":\n\n${formatted}`,
      };
    } catch (error: any) {
      return { success: false, error: `FTS search error: ${error.message}` };
    }
  }

  /**
   * Execute ripgrep command with specified options
   */
  private async executeRipgrep(
    query: string,
    options: {
      includePattern?: string;
      excludePattern?: string;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      regex?: boolean;
      maxResults?: number;
      fileTypes?: string[];
      excludeFiles?: string[];
    }
  ): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const args = [
        "--json",
        "--with-filename",
        "--line-number",
        "--column",
        "--no-heading",
        "--color=never",
      ];

      // Add case sensitivity
      if (!options.caseSensitive) {
        args.push("--ignore-case");
      }

      // Add whole word matching
      if (options.wholeWord) {
        args.push("--word-regexp");
      }

      // Add regex mode
      if (!options.regex) {
        args.push("--fixed-strings");
      }

      // Add max results limit
      if (options.maxResults) {
        args.push("--max-count", options.maxResults.toString());
      }

      // Add file type filters
      if (options.fileTypes) {
        options.fileTypes.forEach((type) => {
          args.push("--type", type);
        });
      }

      // Add include pattern
      if (options.includePattern) {
        args.push("--glob", options.includePattern);
      }

      // Add exclude pattern
      if (options.excludePattern) {
        args.push("--glob", `!${options.excludePattern}`);
      }

      // Add exclude files
      if (options.excludeFiles) {
        options.excludeFiles.forEach((file) => {
          args.push("--glob", `!${file}`);
        });
      }

      // Respect gitignore and common ignore patterns
      args.push(
        "--no-require-git",
        "--follow",
        "--glob",
        "!.git/**",
        "--glob",
        "!node_modules/**",
        "--glob",
        "!.DS_Store",
        "--glob",
        "!*.log"
      );

      // Add query and search directory
      args.push(query, this.currentDirectory);

      const rg = spawn("rg", args);
      const results: SearchResult[] = [];
      let buffer = "";
      let errorOutput = "";
      const maxResults = options.maxResults; // undefined means no cap

      // Streaming parser with safety limits
      rg.stdout.on("data", (data: Buffer) => {
        // Append to buffer and process complete lines
        buffer += data.toString();
        const lines = buffer.split("\n");

        // Keep last incomplete line in buffer
        buffer = lines.pop() || "";

        // Parse complete lines
        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "match") {
              const result = this.parseMatchLine(parsed);
              if (result) {
                results.push(result);

                // Stop if we reached user-defined quota
                if (maxResults && results.length >= maxResults) {
                  rg.kill();
                  resolve(results);
                  return;
                }
              }
            }
          } catch (err) {
            // Skip malformed JSON lines
            continue;
          }
        }
      });

      rg.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      rg.on("close", (code) => {
        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer);
            if (parsed.type === "match") {
              const result = this.parseMatchLine(parsed);
              if (result) results.push(result);
            }
          } catch (err) {
            // Ignore
          }
        }

        if (code === 0 || code === 1) {
          resolve(results);
        } else {
          reject(new Error(`Ripgrep failed with code ${code}: ${errorOutput}`));
        }
      });

      rg.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse a single ripgrep match line (JSON object)
   */
  private parseMatchLine(parsed: any): SearchResult | null {
    try {
      if (parsed.type !== "match") return null;

      const data = parsed.data;
      const text = data.lines.text.trim();

      return {
        file: data.path.text,
        line: data.line_number,
        column: data.submatches[0]?.start || 0,
        text,
        match: data.submatches[0]?.match?.text || "",
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Parse ripgrep JSON output into SearchResult objects (legacy fallback)
   */
  private parseRipgrepOutput(output: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "match") {
          const data = parsed.data;
          results.push({
            file: data.path.text,
            line: data.line_number,
            column: data.submatches[0]?.start || 0,
            text: data.lines.text.trim(),
            match: data.submatches[0]?.match?.text || "",
          });
        }
      } catch (e) {
        // Skip invalid JSON lines
        continue;
      }
    }

    return results;
  }

  /**
   * Find files by pattern using a simple file walking approach
   */
  private async findFilesByPattern(
    pattern: string,
    options: {
      maxResults?: number;
      includeHidden?: boolean;
      excludePattern?: string;
    }
  ): Promise<FileSearchResult[]> {
    // Defensive guard: pattern must be a non-empty string
    if (typeof pattern !== "string") {
      throw new Error(
        `Invalid file search pattern: expected string, received ${typeof pattern}`
      );
    }

    const files: FileSearchResult[] = [];
    const maxResults = options.maxResults ?? Infinity;
    const searchPattern = pattern.toLowerCase();

    const walkDir = async (dir: string, depth: number = 0): Promise<void> => {
      if (depth > 1000 || files.length >= maxResults) return; // Keep depth guard to avoid runaway recursion

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (files.length >= maxResults) break;

          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.currentDirectory, fullPath);

          // Skip hidden files unless explicitly included
          if (!options.includeHidden && entry.name.startsWith(".")) {
            continue;
          }

          // Skip common directories
          if (
            entry.isDirectory() &&
            [
              "node_modules",
              ".git",
              ".svn",
              ".hg",
              "dist",
              "build",
              ".next",
              ".cache",
            ].includes(entry.name)
          ) {
            continue;
          }

          // Apply exclude pattern
          if (
            options.excludePattern &&
            relativePath.includes(options.excludePattern)
          ) {
            continue;
          }

          if (entry.isFile()) {
            const score = this.calculateFileScore(
              entry.name,
              relativePath,
              searchPattern
            );
            if (score > 0) {
              files.push({
                path: relativePath,
                name: entry.name,
                score,
              });
            }
          } else if (entry.isDirectory()) {
            await walkDir(fullPath, depth + 1);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await walkDir(this.currentDirectory);

    // Sort by score (descending) and return top results
    const sorted = files.sort((a, b) => b.score - a.score);
    return Number.isFinite(maxResults) ? sorted.slice(0, maxResults) : sorted;
  }

  /**
   * Calculate fuzzy match score for file names
   */
  private calculateFileScore(
    fileName: string,
    filePath: string,
    pattern: string
  ): number {
    const lowerFileName = fileName.toLowerCase();
    const lowerFilePath = filePath.toLowerCase();

    // Exact matches get highest score
    if (lowerFileName === pattern) return 100;
    if (lowerFileName.includes(pattern)) return 80;

    // Path matches get medium score
    if (lowerFilePath.includes(pattern)) return 60;

    // Fuzzy matching - check if all characters of pattern exist in order
    let patternIndex = 0;
    for (
      let i = 0;
      i < lowerFileName.length && patternIndex < pattern.length;
      i++
    ) {
      if (lowerFileName[i] === pattern[patternIndex]) {
        patternIndex++;
      }
    }

    if (patternIndex === pattern.length) {
      // All characters found in order - score based on how close they are
      return Math.max(10, 40 - (fileName.length - pattern.length));
    }

    return 0;
  }

  /**
   * Format unified search results for display
   */
  private formatUnifiedResults(
    results: UnifiedSearchResult[],
    query: string,
    searchType: string
  ): string {
    if (results.length === 0) {
      return `No results found for "${query}"`;
    }

    let output = `Search results for "${query}":\n`;

    // Separate text and file results
    const textResults = results.filter((r) => r.type === "text");
    const fileResults = results.filter((r) => r.type === "file");

    // Show all unique files (from both text matches and file matches)
    const allFiles = new Set<string>();

    // Add files from text results
    textResults.forEach((result) => {
      allFiles.add(result.file);
    });

    // Add files from file search results
    fileResults.forEach((result) => {
      allFiles.add(result.file);
    });

    const fileList = Array.from(allFiles);
    const displayLimit = 8;

    // Show files in compact format
    fileList.slice(0, displayLimit).forEach((file) => {
      // Count matches in this file for text results
      const matchCount = textResults.filter((r) => r.file === file).length;
      const matchIndicator = matchCount > 0 ? ` (${matchCount} matches)` : "";
      output += `  ${file}${matchIndicator}\n`;
    });

    // Show "+X more" if there are additional results
    if (fileList.length > displayLimit) {
      const remaining = fileList.length - displayLimit;
      output += `  ... +${remaining} more\n`;
    }

    return output.trim();
  }

  /**
   * Score a search result based on context and other factors
   * Higher score = more relevant
   */
  private scoreResult(
    result: UnifiedSearchResult,
    searchContext: string,
    options: any
  ): number {
    let score = 100; // Base score

    const filePath = result.file.toLowerCase();
    const textContent = (result.text || "").toLowerCase();
    const contextWords = searchContext.toLowerCase().split(/\s+/);

    // 1. Context matching (+20 per matched word)
    const matchedContextWords = contextWords.filter(
      (word) => filePath.includes(word) || textContent.includes(word)
    );
    score += matchedContextWords.length * 20;

    // 2. File type preference (+30 if in preferred types)
    if (options.fileTypes && options.fileTypes.length > 0) {
      const fileExt = filePath.split(".").pop() || "";
      if (options.fileTypes.includes(fileExt)) {
        score += 30;
      }
    }

    // 3. Path bonuses/penalties
    if (filePath.includes("/src/")) score += 25;
    if (filePath.includes("/lib/")) score += 15;
    if (filePath.includes("/core/")) score += 20;

    // Penalties
    if (filePath.includes("/test")) score -= 10;
    if (filePath.includes("/__")) score -= 15; // Private dirs
    if (filePath.includes("/node_modules/")) score -= 50;
    if (filePath.includes("/dist/")) score -= 30;
    if (filePath.includes("/.git/")) score -= 50;

    // 4. Code structure hints (+15 for definitions)
    if (result.text) {
      // Boost code definitions over usage
      if (/^(export |class |function |const |interface |type )/.test(result.text)) {
        score += 15;
      }

      // Boost important keywords
      if (/async |await |Promise/.test(result.text)) score += 5;
    }

    // 5. File name exact match bonus
    const fileName = filePath.split("/").pop() || "";
    if (contextWords.some((word) => fileName.includes(word))) {
      score += 25;
    }

    return score;
  }

  /**
   * Adaptive cutoff using a slightly more statistical elbow:
   * - Largest significant drop (delta z-score)
   * - Threshold by (mean - std)
   * - Threshold by percentage of max
   */
  private applyAdaptiveCutoff(results: UnifiedSearchResult[]) {
    if (results.length === 0) {
      return { topResults: results, remainingCount: 0, cutoffScore: 0, maxScore: 0 };
    }

    const scores = results.map((r) => r.score ?? 0);
    const maxScore = scores[0] || 0;

    if (results.length === 1) {
      return { topResults: results, remainingCount: 0, cutoffScore: maxScore, maxScore };
    }

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
    const std = Math.sqrt(variance);

    // Consecutive drops
    const deltas: number[] = [];
    for (let i = 0; i < scores.length - 1; i++) {
      deltas.push(scores[i] - scores[i + 1]);
    }
    const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const varDelta =
      deltas.reduce((a, b) => a + Math.pow(b - meanDelta, 2), 0) / deltas.length;
    const stdDelta = Math.sqrt(varDelta);

    // Find the most significant drop (normalized by stdDelta and relative to maxScore)
    let cutoffIndex = results.length;
    let bestScore = -Infinity;
    for (let i = 0; i < deltas.length; i++) {
      const relDrop = maxScore > 0 ? deltas[i] / maxScore : 0;
      const zDrop = stdDelta > 0 ? (deltas[i] - meanDelta) / stdDelta : 0;
      const combined = relDrop * 0.7 + zDrop * 0.3;
      if (combined > bestScore && (relDrop >= 0.05 || zDrop >= 0.5)) {
        bestScore = combined;
        cutoffIndex = i + 1;
      }
    }

    // Threshold by mean - std (ignore negatives)
    const stdThreshold = Math.max(0, mean - std);
    const stdIdx = scores.findIndex((s) => s < stdThreshold);

    // Threshold by percentage of max (20% default)
    const pctThreshold = maxScore * 0.2;
    const pctIdx = scores.findIndex((s) => s < pctThreshold);

    const candidates = [cutoffIndex];
    if (stdIdx >= 0) candidates.push(stdIdx);
    if (pctIdx >= 0) candidates.push(pctIdx);

    // Keep at least 5 results when we have many to avoid being too aggressive
    const minKeep = Math.min(5, results.length);
    const finalCut = Math.max(minKeep, Math.min(...candidates.filter((n) => n > 0)));

    const topResults = results.slice(0, finalCut);
    const remainingCount = Math.max(0, results.length - topResults.length);
    const cutoffScore = topResults[topResults.length - 1]?.score || 0;

    return { topResults, remainingCount, cutoffScore, maxScore };
  }

  /**
   * Update current working directory
   */
  setCurrentDirectory(directory: string): void {
    this.currentDirectory = directory;
  }

  /**
   * Get current working directory
   */
  getCurrentDirectory(): string {
    return this.currentDirectory;
  }

  /**
   * Fetch more results from cache for a given search id.
   */
  async searchMore(searchId: number, limit: number = 20): Promise<ToolResult> {
    try {
      const meta = this.searchCache.getSearch(searchId);
      if (!meta) {
        return { success: false, error: `Search #${searchId} not found in cache` };
      }

      const lastSeenId = meta.lastSeenId ?? null;
      const rows = this.searchCache.getNextResults(searchId, lastSeenId, limit);
      if (!rows.length) {
        const remaining = this.searchCache.getRemainingCount(searchId);
        if (remaining <= 0) {
          return { success: true, output: `No more results for search #${searchId}.` };
        }
        // Defensive: remaining says there is data but none returned
        return { success: false, error: `Unable to fetch additional results for search #${searchId}.` };
      }

      // Rehydrate into UnifiedSearchResult (guess type: if no line/column/text -> file)
      const unified: UnifiedSearchResult[] = rows.map((r) => {
        const isFileOnly = r.line == null && r.column == null && !r.text;
        return {
          type: isFileOnly ? "file" : "text",
          file: r.file,
          line: r.line ?? undefined,
          column: r.column ?? undefined,
          text: r.text ?? undefined,
          match: r.text ?? undefined,
          score: r.score ?? 0,
        };
      });

      const newLastId = rows[rows.length - 1]?.id;
      // Update shown counter atomically and persist last_seen_id
      const remaining = this.searchCache.markShownAndGetRemaining(searchId, rows.length, newLastId);

      const formatted = this.formatUnifiedResults(unified, meta.query, "both");

      if (remaining > 0) {
        return {
          success: true,
          output:
            formatted +
            `\n\n⚠️ ${remaining} additional results remain cached for search #${searchId}.` +
            ` Ask to "show more" again to continue.`,
        };
      }

      return {
        success: true,
        output: formatted + `\n\n✓ End of cached results for search #${searchId}.`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Search-more error: ${error.message}`,
      };
    }
  }
}

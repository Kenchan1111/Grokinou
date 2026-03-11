/**
 * GlobTool — Recherche rapide de fichiers par pattern glob.
 * Remplace la partie "file search" du SearchTool monolithique.
 * Lecture seule, aucune confirmation nécessaire.
 */

import * as path from "path";
import { readdir, stat } from "node:fs/promises";
import { ToolResult } from "../types/index.js";

/** Répertoires ignorés par défaut */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".cache",
  ".svn",
  ".hg",
]);

/** Limite max de résultats pour éviter de saturer le contexte */
const MAX_RESULTS = 200;

export class GlobTool {
  /**
   * Recherche des fichiers correspondant à un pattern glob.
   * Trie par date de modification (plus récent en premier).
   *
   * @param pattern - pattern glob (ex: "**\/*.ts", "src/**\/*.tsx", "*.json")
   * @param searchPath - répertoire racine (défaut: cwd)
   */
  async execute(pattern: string, searchPath?: string): Promise<ToolResult> {
    try {
      if (!pattern || typeof pattern !== "string" || !pattern.trim()) {
        return { success: false, error: "Glob error: pattern is required" };
      }

      const rootDir = path.resolve(searchPath || process.cwd());

      // Vérifier que le répertoire existe
      try {
        const rootStat = await stat(rootDir);
        if (!rootStat.isDirectory()) {
          return { success: false, error: `Glob error: ${rootDir} is not a directory` };
        }
      } catch {
        return { success: false, error: `Glob error: directory not found: ${rootDir}` };
      }

      // Compiler le pattern en regex
      const regex = globToRegex(pattern);

      // Collecter les fichiers correspondants
      const matches: Array<{ relativePath: string; mtime: number }> = [];
      await this.walkDirectory(rootDir, rootDir, regex, matches);

      if (matches.length === 0) {
        return {
          success: true,
          output: `No files matched pattern: ${pattern}`,
        };
      }

      // Trier par date de modification (plus récent en premier)
      matches.sort((a, b) => b.mtime - a.mtime);

      // Limiter les résultats
      const limited = matches.slice(0, MAX_RESULTS);
      const truncated = matches.length > MAX_RESULTS;

      const output = limited.map((m) => m.relativePath).join("\n");
      const summary = truncated
        ? `\n\n(${matches.length} total matches, showing first ${MAX_RESULTS})`
        : `\n\n(${limited.length} files matched)`;

      return {
        success: true,
        output: output + summary,
        data: {
          files: limited.map((m) => m.relativePath),
          totalMatches: matches.length,
          truncated,
        },
      };
    } catch (error: any) {
      return { success: false, error: `Glob error: ${error.message}` };
    }
  }

  /**
   * Parcours récursif du répertoire, collecte les fichiers correspondants.
   */
  private async walkDirectory(
    rootDir: string,
    currentDir: string,
    regex: RegExp,
    matches: Array<{ relativePath: string; mtime: number }>,
    depth: number = 0,
  ): Promise<void> {
    // Protection contre la récursion excessive
    if (depth > 50 || matches.length >= MAX_RESULTS * 2) return;

    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      // Ignorer les répertoires inaccessibles
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        // Ignorer les répertoires exclus
        if (IGNORED_DIRS.has(entry.name)) continue;
        await this.walkDirectory(rootDir, fullPath, regex, matches, depth + 1);
      } else if (entry.isFile()) {
        // Tester le chemin relatif contre le pattern
        if (regex.test(relativePath)) {
          try {
            const fileStat = await stat(fullPath);
            matches.push({
              relativePath,
              mtime: fileStat.mtimeMs,
            });
          } catch {
            // Fichier supprimé entre readdir et stat
          }
        }
      }
    }
  }
}

/**
 * Convertit un pattern glob en expression régulière.
 * Supporte: *, **, ?, {a,b}, [abc]
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = "";
  let i = 0;
  const len = pattern.length;

  while (i < len) {
    const ch = pattern[i];

    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // ** = n'importe quoi incluant les /
        if (pattern[i + 2] === "/") {
          regexStr += "(?:.+/)?";
          i += 3;
        } else {
          regexStr += ".*";
          i += 2;
        }
      } else {
        // * = n'importe quoi sauf /
        regexStr += "[^/]*";
        i++;
      }
    } else if (ch === "?") {
      regexStr += "[^/]";
      i++;
    } else if (ch === "{") {
      // Groupe d'alternatives {a,b,c}
      const closeBrace = pattern.indexOf("}", i);
      if (closeBrace === -1) {
        regexStr += "\\{";
        i++;
      } else {
        const alternatives = pattern.slice(i + 1, closeBrace).split(",");
        regexStr += "(?:" + alternatives.map(escapeRegex).join("|") + ")";
        i = closeBrace + 1;
      }
    } else if (ch === "[") {
      // Character class [abc]
      const closeBracket = pattern.indexOf("]", i);
      if (closeBracket === -1) {
        regexStr += "\\[";
        i++;
      } else {
        regexStr += pattern.slice(i, closeBracket + 1);
        i = closeBracket + 1;
      }
    } else if (ch === ".") {
      regexStr += "\\.";
      i++;
    } else if (ch === "/") {
      regexStr += "/";
      i++;
    } else {
      regexStr += escapeRegex(ch);
      i++;
    }
  }

  return new RegExp("^" + regexStr + "$");
}

/** Échappe les caractères spéciaux regex */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

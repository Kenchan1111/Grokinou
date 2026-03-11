/**
 * GrepTool — Recherche de contenu dans les fichiers via ripgrep (rg).
 * Remplace la partie "text search" du SearchTool monolithique.
 * Lecture seule, aucune confirmation nécessaire.
 */

import { spawn } from "child_process";
import * as path from "path";
import { ToolResult } from "../types/index.js";

/** Limite de lignes par défaut en mode content */
const DEFAULT_HEAD_LIMIT_CONTENT = 100;

export interface GrepOptions {
  /** Regex à rechercher */
  pattern: string;
  /** Répertoire ou fichier cible (défaut: cwd) */
  path?: string;
  /** Filtre glob sur les fichiers (ex: "*.ts", "*.{ts,tsx}") */
  glob?: string;
  /** Filtre par type de fichier rg (ex: "ts", "py", "js") */
  type?: string;
  /** Mode de sortie */
  outputMode?: "content" | "files_with_matches" | "count";
  /** Lignes de contexte autour des correspondances */
  contextLines?: number;
  /** Recherche insensible à la casse */
  caseInsensitive?: boolean;
  /** Limite de lignes en sortie */
  headLimit?: number;
  /** Mode multiline (. matche aussi \n) */
  multiline?: boolean;
}

export class GrepTool {
  /**
   * Recherche de contenu via ripgrep (rg) avec fallback sur grep.
   */
  async execute(options: GrepOptions): Promise<ToolResult> {
    try {
      if (!options.pattern || typeof options.pattern !== "string" || !options.pattern.trim()) {
        return { success: false, error: "Grep error: pattern is required" };
      }

      const searchPath = path.resolve(options.path || process.cwd());
      const outputMode = options.outputMode || "files_with_matches";

      // Tenter rg d'abord, fallback sur grep
      const rgAvailable = await this.isCommandAvailable("rg");

      if (rgAvailable) {
        return this.executeRipgrep(options, searchPath, outputMode);
      } else {
        return this.executeGrepFallback(options, searchPath, outputMode);
      }
    } catch (error: any) {
      return { success: false, error: `Grep error: ${error.message}` };
    }
  }

  /**
   * Exécute la recherche via ripgrep.
   */
  private async executeRipgrep(
    options: GrepOptions,
    searchPath: string,
    outputMode: string,
  ): Promise<ToolResult> {
    const args: string[] = [];

    // Mode de sortie
    switch (outputMode) {
      case "files_with_matches":
        args.push("-l");
        break;
      case "count":
        args.push("-c");
        break;
      case "content":
      default:
        args.push("-n"); // numéros de ligne
        break;
    }

    // Options conditionnelles
    if (options.caseInsensitive) {
      args.push("-i");
    }

    if (options.multiline) {
      args.push("-U", "--multiline-dotall");
    }

    if (options.contextLines != null && outputMode === "content") {
      args.push("-C", String(options.contextLines));
    }

    if (options.glob) {
      args.push("--glob", options.glob);
    }

    if (options.type) {
      args.push("--type", options.type);
    }

    // Ignorer les répertoires courants
    args.push(
      "--glob", "!.git/**",
      "--glob", "!node_modules/**",
      "--color", "never",
    );

    // Pattern et chemin de recherche
    args.push("--", options.pattern, searchPath);

    return this.runCommand("rg", args, options, outputMode);
  }

  /**
   * Fallback sur grep si rg n'est pas disponible.
   */
  private async executeGrepFallback(
    options: GrepOptions,
    searchPath: string,
    outputMode: string,
  ): Promise<ToolResult> {
    const args: string[] = ["-rn", "--color=never"];

    // Mode de sortie
    switch (outputMode) {
      case "files_with_matches":
        args.push("-l");
        break;
      case "count":
        args.push("-c");
        break;
    }

    if (options.caseInsensitive) {
      args.push("-i");
    }

    if (options.contextLines != null && outputMode === "content") {
      args.push(`-C${options.contextLines}`);
    }

    if (options.glob) {
      args.push(`--include=${options.glob}`);
    }

    // Exclusions standard
    args.push("--exclude-dir=.git", "--exclude-dir=node_modules");

    // Pattern et chemin
    args.push("--", options.pattern, searchPath);

    return this.runCommand("grep", args, options, outputMode);
  }

  /**
   * Exécute un processus enfant et collecte la sortie.
   */
  private runCommand(
    cmd: string,
    args: string[],
    options: GrepOptions,
    outputMode: string,
  ): Promise<ToolResult> {
    return new Promise((resolve) => {
      const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

      let stdout = "";
      let stderr = "";
      const headLimit = options.headLimit ?? (outputMode === "content" ? DEFAULT_HEAD_LIMIT_CONTENT : 0);
      let lineCount = 0;
      let truncated = false;

      child.stdout.on("data", (data: Buffer) => {
        if (truncated) return;

        const chunk = data.toString();

        if (headLimit > 0) {
          // Compter les lignes et tronquer si nécessaire
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (lineCount >= headLimit) {
              truncated = true;
              child.kill();
              return;
            }
            stdout += line + "\n";
            lineCount++;
          }
        } else {
          stdout += chunk;
        }
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("error", (err) => {
        resolve({
          success: false,
          error: `Grep error: ${cmd} failed: ${err.message}`,
        });
      });

      child.on("close", (code) => {
        // rg: 0 = matches, 1 = no matches, 2 = error
        // grep: 0 = matches, 1 = no matches, 2 = error
        if (code === 2) {
          resolve({
            success: false,
            error: `Grep error: ${stderr.trim() || `${cmd} exited with code 2`}`,
          });
          return;
        }

        const output = stdout.trim();

        if (code === 1 || !output) {
          resolve({
            success: true,
            output: `No matches found for pattern: ${options.pattern}`,
          });
          return;
        }

        // Compter les résultats pour le résumé
        const lines = output.split("\n").filter((l) => l.length > 0);
        let summary = "";

        if (outputMode === "files_with_matches") {
          summary = `\n\n(${lines.length} files matched)`;
        } else if (outputMode === "count") {
          const totalCount = lines.reduce((sum, line) => {
            const parts = line.split(":");
            return sum + (parseInt(parts[parts.length - 1], 10) || 0);
          }, 0);
          summary = `\n\n(${totalCount} total matches across ${lines.length} files)`;
        }

        if (truncated) {
          summary += ` (output truncated to ${headLimit} lines)`;
        }

        resolve({
          success: true,
          output: output + summary,
          data: {
            matchCount: lines.length,
            truncated,
          },
        });
      });
    });
  }

  /**
   * Vérifie si une commande est disponible dans le PATH.
   */
  private isCommandAvailable(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn("which", [cmd], { stdio: ["ignore", "pipe", "pipe"] });
      child.on("close", (code) => resolve(code === 0));
      child.on("error", () => resolve(false));
    });
  }
}

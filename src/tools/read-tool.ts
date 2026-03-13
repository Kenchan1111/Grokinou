import * as fs from "fs-extra";
import * as path from "path";
import { readFile as fsReadFile } from "node:fs/promises";
import { stat as fsStat, readdir as fsReaddir } from "node:fs/promises";
import { ToolResult } from "../types/index.js";

// Limite par défaut de lignes à lire
const DEFAULT_LINE_LIMIT = 2000;
// Limite de caractères par ligne
const MAX_LINE_LENGTH = 2000;

/**
 * ReadTool — Lecture de fichiers avec numérotation de lignes.
 * Supporte offset/limit pour les gros fichiers.
 * Opération read-only, pas de confirmation nécessaire.
 */
export class ReadTool {
  // Suivi des fichiers lus (utilisé par WriteTool/EditTool comme garde)
  private static readFiles: Set<string> = new Set();

  static hasBeenRead(filePath: string): boolean {
    return ReadTool.readFiles.has(filePath);
  }

  static markAsRead(filePath: string): void {
    ReadTool.readFiles.add(filePath);
  }

  /**
   * Lit un fichier ou liste le contenu d'un répertoire.
   * @param filePath - Chemin du fichier ou répertoire
   * @param offset - Ligne de début (1-based), défaut: 1
   * @param limit - Nombre de lignes à lire, défaut: 2000
   */
  async execute(
    filePath: string,
    offset?: number,
    limit?: number
  ): Promise<ToolResult> {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return {
          success: false,
          error: 'file_path is required and must be a string',
        };
      }

      const resolvedPath = path.resolve(filePath);

      if (!(await fs.pathExists(resolvedPath))) {
        return {
          success: false,
          error: `File not found: ${resolvedPath}`,
        };
      }

      const stats = await fsStat(resolvedPath);

      // Répertoire → lister le contenu
      if (stats.isDirectory()) {
        const entries = await fsReaddir(resolvedPath);
        return {
          success: true,
          output: `Directory contents of ${resolvedPath}:\n${entries.join("\n")}`,
        };
      }

      // Fichier → lire avec numéros de lignes
      const content = await fsReadFile(resolvedPath, "utf-8");
      const allLines = content.split("\n");
      const totalLines = allLines.length;

      // Calcul offset/limit (offset est 1-based)
      const startLine = offset ? Math.max(1, offset) : 1;
      const lineLimit = limit ?? DEFAULT_LINE_LIMIT;
      const endLine = Math.min(totalLines, startLine + lineLimit - 1);

      const selectedLines = allLines.slice(startLine - 1, endLine);

      // Format cat -n : numéro de ligne + tab + contenu (troncature si > 2000 chars)
      const numberedLines = selectedLines
        .map((line, idx) => {
          const lineNum = startLine + idx;
          const truncated =
            line.length > MAX_LINE_LENGTH
              ? line.slice(0, MAX_LINE_LENGTH) + "..."
              : line;
          return `${String(lineNum).padStart(6, " ")}\t${truncated}`;
        })
        .join("\n");

      // Marquer comme lu
      ReadTool.markAsRead(resolvedPath);

      // Message informatif si le fichier est partiellement lu
      let header = "";
      if (startLine > 1 || endLine < totalLines) {
        header = `Lines ${startLine}-${endLine} of ${totalLines} in ${resolvedPath}\n`;
      }

      const truncatedMessage =
        endLine < totalLines
          ? `\n... ${totalLines - endLine} more lines remaining`
          : "";

      return {
        success: true,
        output: `${header}${numberedLines}${truncatedMessage}`,
      };
    } catch (error: any) {
      if (error.code === "EACCES") {
        return {
          success: false,
          error: `Permission denied: ${filePath}`,
        };
      }
      return {
        success: false,
        error: `Error reading ${filePath}: ${error.message}`,
      };
    }
  }
}

import * as path from "path";
import { readFile as fsReadFile, writeFile as fsWriteFile } from "node:fs/promises";
import * as fs from "fs-extra";
import { ToolResult } from "../types/index.js";
import { ConfirmationService } from "../utils/confirmation-service.js";
import { ReadTool } from "./read-tool.js";

/**
 * EditTool — Remplacement exact de chaînes dans un fichier.
 * Nécessite confirmation via ConfirmationService.
 * Garde : le fichier doit avoir été lu au préalable via ReadTool.
 */
export class EditTool {
  private confirmationService = ConfirmationService.getInstance();

  /**
   * Remplace une chaîne exacte dans un fichier.
   * @param filePath - Chemin du fichier
   * @param oldString - Texte à remplacer (doit exister dans le fichier)
   * @param newString - Texte de remplacement
   * @param replaceAll - Remplacer toutes les occurrences (défaut: false)
   */
  async execute(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): Promise<ToolResult> {
    try {
      const resolvedPath = path.resolve(filePath);

      // Garde : le fichier doit avoir été lu
      if (!ReadTool.hasBeenRead(resolvedPath)) {
        return {
          success: false,
          error: `File has not been read yet. Use read_file first: ${resolvedPath}`,
        };
      }

      // Vérifier que le fichier existe
      if (!(await fs.pathExists(resolvedPath))) {
        return {
          success: false,
          error: `File not found: ${resolvedPath}`,
        };
      }

      const content = await fsReadFile(resolvedPath, "utf-8");

      // Vérifier que oldString existe dans le fichier
      if (!content.includes(oldString)) {
        return {
          success: false,
          error: `String not found in ${resolvedPath}. Make sure the old_string matches exactly (including whitespace and indentation).`,
        };
      }

      // Compter les occurrences
      const escaped = oldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const occurrences = (content.match(new RegExp(escaped, "g")) || [])
        .length;

      // Si replaceAll est false, vérifier l'unicité
      if (!replaceAll && occurrences > 1) {
        return {
          success: false,
          error: `Found ${occurrences} occurrences of the string in ${resolvedPath}. Provide more surrounding context to make the match unique, or set replaceAll to true.`,
        };
      }

      // Calculer le nouveau contenu
      const newContent = replaceAll
        ? content.split(oldString).join(newString)
        : content.replace(oldString, newString);

      // Confirmation utilisateur
      const sessionFlags = this.confirmationService.getSessionFlags();
      if (!sessionFlags.fileOperations && !sessionFlags.allOperations) {
        const oldLines = content.split("\n");
        const newLines = newContent.split("\n");
        const diffContent = this.generateSimpleDiff(
          oldLines,
          newLines,
          filePath
        );

        const confirmationResult =
          await this.confirmationService.requestConfirmation(
            {
              operation: `Edit file${replaceAll && occurrences > 1 ? ` (${occurrences} occurrences)` : ""}`,
              filename: filePath,
              showVSCodeOpen: false,
              content: diffContent,
            },
            "file"
          );

        if (!confirmationResult.confirmed) {
          return {
            success: false,
            error: confirmationResult.feedback || "Edit cancelled by user",
          };
        }
      }

      // Écriture du fichier modifié
      await fsWriteFile(resolvedPath, newContent, "utf-8");

      const replacedCount = replaceAll ? occurrences : 1;
      return {
        success: true,
        output: `Edited ${resolvedPath} — replaced ${replacedCount} occurrence${replacedCount > 1 ? "s" : ""}`,
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
        error: `Error editing ${filePath}: ${error.message}`,
      };
    }
  }

  /**
   * Génère un diff simplifié pour la prévisualisation.
   */
  private generateSimpleDiff(
    oldLines: string[],
    newLines: string[],
    filePath: string
  ): string {
    const CONTEXT = 3;
    const result: string[] = [];

    result.push(`--- a/${filePath}`);
    result.push(`+++ b/${filePath}`);

    // Trouver les lignes modifiées
    const maxLen = Math.max(oldLines.length, newLines.length);
    const changedRanges: Array<{ start: number; oldEnd: number; newEnd: number }> = [];

    let i = 0;
    while (i < maxLen) {
      if (i >= oldLines.length || i >= newLines.length || oldLines[i] !== newLines[i]) {
        const start = i;
        // Avancer tant que les lignes diffèrent
        let oi = i;
        let ni = i;

        // Chercher la prochaine correspondance
        while (oi < oldLines.length || ni < newLines.length) {
          // Vérifier si on retrouve une correspondance
          if (
            oi < oldLines.length &&
            ni < newLines.length &&
            oldLines[oi] === newLines[ni]
          ) {
            // Vérifier que c'est une vraie correspondance (au moins 2 lignes)
            let match = 0;
            for (
              let k = 0;
              k < 2 && oi + k < oldLines.length && ni + k < newLines.length;
              k++
            ) {
              if (oldLines[oi + k] === newLines[ni + k]) match++;
              else break;
            }
            if (match >= 2 || (oi >= oldLines.length - 1 && ni >= newLines.length - 1)) {
              break;
            }
          }
          if (oi < oldLines.length) oi++;
          if (ni < newLines.length) ni++;
        }

        changedRanges.push({ start, oldEnd: oi, newEnd: ni });
        i = Math.max(oi, ni);
      } else {
        i++;
      }
    }

    // Générer les hunks avec contexte
    for (const range of changedRanges) {
      const ctxStart = Math.max(0, range.start - CONTEXT);
      const ctxOldEnd = Math.min(oldLines.length, range.oldEnd + CONTEXT);
      const ctxNewEnd = Math.min(newLines.length, range.newEnd + CONTEXT);

      const oldCount = ctxOldEnd - ctxStart;
      const newCount =
        (range.start - ctxStart) +
        (range.newEnd - range.start) -
        (range.oldEnd - range.start) +
        (range.oldEnd - range.start) +
        (ctxOldEnd - range.oldEnd);

      result.push(
        `@@ -${ctxStart + 1},${oldCount} +${ctxStart + 1},${ctxNewEnd - ctxStart} @@`
      );

      // Contexte avant
      for (let j = ctxStart; j < range.start; j++) {
        result.push(` ${oldLines[j]}`);
      }
      // Lignes supprimées
      for (let j = range.start; j < range.oldEnd; j++) {
        result.push(`-${oldLines[j]}`);
      }
      // Lignes ajoutées
      for (let j = range.start; j < range.newEnd; j++) {
        result.push(`+${newLines[j]}`);
      }
      // Contexte après
      for (let j = range.oldEnd; j < ctxOldEnd; j++) {
        result.push(` ${oldLines[j]}`);
      }
    }

    return result.join("\n");
  }
}

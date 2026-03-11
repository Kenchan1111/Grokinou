import * as fs from "fs-extra";
import * as path from "path";
import { writeFile as fsWriteFile } from "node:fs/promises";
import { ToolResult } from "../types/index.js";
import { ConfirmationService } from "../utils/confirmation-service.js";
import { ReadTool } from "./read-tool.js";

/**
 * WriteTool — Création ou réécriture complète de fichiers.
 * Nécessite confirmation via ConfirmationService.
 * Garde : les fichiers existants doivent avoir été lus au préalable.
 */
export class WriteTool {
  private confirmationService = ConfirmationService.getInstance();

  /**
   * Écrit du contenu dans un fichier (création ou réécriture).
   * @param filePath - Chemin du fichier cible
   * @param content - Contenu à écrire
   */
  async execute(filePath: string, content: string): Promise<ToolResult> {
    try {
      const resolvedPath = path.resolve(filePath);
      const fileExists = await fs.pathExists(resolvedPath);

      // Garde : fichier existant doit avoir été lu d'abord
      if (fileExists && !ReadTool.hasBeenRead(resolvedPath)) {
        return {
          success: false,
          error: `File has not been read yet. Use read_file first before overwriting: ${resolvedPath}`,
        };
      }

      // Confirmation utilisateur (sauf si session flag actif)
      const sessionFlags = this.confirmationService.getSessionFlags();
      if (!sessionFlags.fileOperations && !sessionFlags.allOperations) {
        const contentLines = content.split("\n");
        const operation = fileExists ? "Overwrite" : "Create";

        // Prévisualisation diff-style
        const diffContent = fileExists
          ? [
              `Overwrite ${resolvedPath}`,
              `--- a/${filePath}`,
              `+++ b/${filePath}`,
              `@@ -1 +1,${contentLines.length} @@`,
              ...contentLines.map((line) => `+${line}`),
            ].join("\n")
          : [
              `Create ${resolvedPath}`,
              `--- /dev/null`,
              `+++ b/${filePath}`,
              `@@ -0,0 +1,${contentLines.length} @@`,
              ...contentLines.map((line) => `+${line}`),
            ].join("\n");

        const confirmationResult =
          await this.confirmationService.requestConfirmation(
            {
              operation,
              filename: filePath,
              showVSCodeOpen: false,
              content: diffContent,
            },
            "file"
          );

        if (!confirmationResult.confirmed) {
          return {
            success: false,
            error: confirmationResult.feedback || "Write operation cancelled by user",
          };
        }
      }

      // Créer les répertoires parents si nécessaire
      const dir = path.dirname(resolvedPath);
      await fs.ensureDir(dir);

      // Écriture du fichier
      await fsWriteFile(resolvedPath, content, "utf-8");

      const byteCount = Buffer.byteLength(content, "utf-8");

      // Marquer comme lu après écriture (le contenu est connu)
      ReadTool.markAsRead(resolvedPath);

      return {
        success: true,
        output: `${fileExists ? "Overwrote" : "Created"} ${resolvedPath} (${byteCount} bytes)`,
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
        error: `Error writing ${filePath}: ${error.message}`,
      };
    }
  }
}

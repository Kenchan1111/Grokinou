import * as fs from "fs-extra";
import * as path from "path";
import { ConfirmationService } from "../utils/confirmation-service.js";
export class ApplyPatchTool {
    confirmationService = ConfirmationService.getInstance();
    async apply(patch, dryRun = false) {
        try {
            const files = this.parseUnifiedDiff(patch);
            if (files.length === 0) {
                return { success: false, error: "No valid hunks found in patch" };
            }
            // Ask for confirmation once for the full patch unless session is already approved
            const sessionFlags = this.confirmationService.getSessionFlags();
            if (!sessionFlags.fileOperations && !sessionFlags.allOperations) {
                const confirmation = await this.confirmationService.requestConfirmation({
                    operation: dryRun ? "Dry-run patch" : "Apply patch",
                    filename: "(multiple files)",
                    showVSCodeOpen: false,
                    content: patch,
                }, "file");
                if (!confirmation.confirmed) {
                    return { success: false, error: confirmation.feedback || "Patch cancelled by user" };
                }
            }
            const summaries = [];
            for (const fp of files) {
                const targetPath = this.resolveTargetPath(fp);
                if (fp.oldPath === "/dev/null") {
                    // Create file
                    const newContent = this.buildFromHunksCreate(fp);
                    if (!dryRun) {
                        await fs.ensureDir(path.dirname(targetPath));
                        await fs.writeFile(targetPath, newContent, "utf-8");
                    }
                    summaries.push(`Created ${targetPath}`);
                }
                else if (fp.newPath === "/dev/null") {
                    // Delete file
                    if (!dryRun && await fs.pathExists(targetPath)) {
                        await fs.remove(targetPath);
                    }
                    summaries.push(`Deleted ${targetPath}`);
                }
                else {
                    // Modify file
                    const exists = await fs.pathExists(targetPath);
                    if (!exists) {
                        return { success: false, error: `Target file not found: ${targetPath}` };
                    }
                    const oldText = await fs.readFile(targetPath, "utf-8");
                    const newText = this.applyHunksModify(oldText, fp);
                    if (!dryRun) {
                        await fs.writeFile(targetPath, newText, "utf-8");
                    }
                    summaries.push(`Patched ${targetPath}`);
                }
            }
            return { success: true, output: summaries.join("\n") };
        }
        catch (e) {
            return { success: false, error: `apply_patch error: ${e.message}` };
        }
    }
    resolveTargetPath(fp) {
        const pick = (p) => p.replace(/^a\//, "").replace(/^b\//, "");
        if (fp.newPath && fp.newPath !== "/dev/null")
            return path.resolve(pick(fp.newPath));
        if (fp.oldPath && fp.oldPath !== "/dev/null")
            return path.resolve(pick(fp.oldPath));
        return path.resolve("unknown");
    }
    parseUnifiedDiff(patch) {
        const lines = patch.replace(/\r\n/g, "\n").split("\n");
        const files = [];
        let i = 0;
        while (i < lines.length) {
            if (lines[i].startsWith("--- ")) {
                const oldPath = lines[i].slice(4).trim();
                i++;
                if (i >= lines.length || !lines[i].startsWith("+++ "))
                    break;
                const newPath = lines[i].slice(4).trim();
                i++;
                const hunks = [];
                while (i < lines.length && lines[i].startsWith("@@ ")) {
                    const header = lines[i];
                    const m = /@@ -([0-9]+)(?:,([0-9]+))? \+([0-9]+)(?:,([0-9]+))? @@/.exec(header);
                    if (!m)
                        throw new Error(`Invalid hunk header: ${header}`);
                    const oldStart = parseInt(m[1], 10);
                    const oldCount = m[2] ? parseInt(m[2], 10) : 1;
                    const newStart = parseInt(m[3], 10);
                    const newCount = m[4] ? parseInt(m[4], 10) : 1;
                    i++;
                    const hunkLines = [];
                    while (i < lines.length && !lines[i].startsWith("@@ ") && !lines[i].startsWith("--- ")) {
                        const line = lines[i];
                        if (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) {
                            hunkLines.push({ type: line[0], content: line.slice(1) });
                        }
                        i++;
                    }
                    hunks.push({ oldStart, oldCount, newStart, newCount, lines: hunkLines });
                }
                files.push({ oldPath, newPath, hunks });
                continue;
            }
            i++;
        }
        return files;
    }
    buildFromHunksCreate(fp) {
        const out = [];
        for (const h of fp.hunks) {
            for (const ln of h.lines) {
                if (ln.type === '+')
                    out.push(ln.content);
                else if (ln.type === ' ')
                    out.push(ln.content); // tolerate spaces in create hunks
            }
        }
        return out.join("\n");
    }
    applyHunksModify(oldText, fp) {
        const oldLines = oldText.split("\n");
        const result = [];
        let oldIndex = 0; // 0-based index for oldLines
        for (const h of fp.hunks) {
            const targetOldStart = h.oldStart - 1; // convert to 0-based
            // Append unchanged lines before hunk
            while (oldIndex < targetOldStart) {
                result.push(oldLines[oldIndex] ?? "");
                oldIndex++;
            }
            // Apply hunk
            for (const ln of h.lines) {
                if (ln.type === ' ') {
                    // context line must match
                    const current = oldLines[oldIndex] ?? "";
                    if (current !== ln.content) {
                        throw new Error(`Context mismatch applying hunk at ${fp.newPath || fp.oldPath}`);
                    }
                    result.push(ln.content);
                    oldIndex++;
                }
                else if (ln.type === '-') {
                    // remove line; ensure it matches
                    const current = oldLines[oldIndex] ?? "";
                    if (current !== ln.content) {
                        throw new Error(`Delete mismatch applying hunk at ${fp.newPath || fp.oldPath}`);
                    }
                    oldIndex++;
                }
                else if (ln.type === '+') {
                    result.push(ln.content);
                }
            }
        }
        // Append remaining old lines
        while (oldIndex < oldLines.length) {
            result.push(oldLines[oldIndex] ?? "");
            oldIndex++;
        }
        return result.join("\n");
    }
}
//# sourceMappingURL=apply-patch.js.map
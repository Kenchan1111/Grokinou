import { ToolResult } from "../types/index.js";
export declare class ApplyPatchTool {
    private confirmationService;
    apply(patch: string, dryRun?: boolean): Promise<ToolResult>;
    private resolveTargetPath;
    private parseUnifiedDiff;
    private buildFromHunksCreate;
    private applyHunksModify;
}

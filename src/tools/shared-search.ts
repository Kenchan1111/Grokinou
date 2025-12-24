import { SearchTool } from "./search.js";

// Single shared instance to avoid multiple caches/DB connections.
let sharedSearchTool: SearchTool | null = null;

export function getSharedSearchTool(): SearchTool {
  if (!sharedSearchTool) {
    sharedSearchTool = new SearchTool();
  }
  return sharedSearchTool;
}

/**
 * Helper functions for ApiKeyInput component
 * Isolated to prevent regressions in main component
 */

import { providerManager } from "../../utils/provider-manager.js";

/**
 * Get all models from all providers as flat sorted array
 * @returns Array of model names sorted alphabetically
 */
export function getAllModelsFlat(): string[] {
  const providers = providerManager.getAllProviders();
  const models: string[] = [];
  
  for (const provider of Object.values(providers)) {
    models.push(...provider.models);
  }
  
  // Sort alphabetically for consistent display
  return models.sort((a, b) => a.localeCompare(b));
}

/**
 * Fuzzy match query against list of models
 * @param query - User's search query (case-insensitive)
 * @param models - List of model names to search
 * @returns Array of matching model names
 */
export function fuzzyMatch(query: string, models: string[]): string[] {
  if (!query || query.trim() === '') {
    return models;
  }
  
  const q = query.toLowerCase().trim();
  
  // Exact match first
  const exactMatch = models.find(m => m.toLowerCase() === q);
  if (exactMatch) {
    return [exactMatch];
  }
  
  // Starts with query
  const startsWithMatches = models.filter(m => 
    m.toLowerCase().startsWith(q)
  );
  
  // Contains query
  const containsMatches = models.filter(m => 
    m.toLowerCase().includes(q) && !m.toLowerCase().startsWith(q)
  );
  
  return [...startsWithMatches, ...containsMatches];
}

/**
 * Get models grouped by provider for display
 * @returns Object with provider names as keys and model arrays as values
 */
export function getModelsByProvider(): Record<string, string[]> {
  const providers = providerManager.getAllProviders();
  const result: Record<string, string[]> = {};
  
  for (const [providerName, provider] of Object.entries(providers)) {
    result[providerName] = [...provider.models];
  }
  
  return result;
}

/**
 * Format model list for display in interactive menu
 * @param models - Array of model names
 * @param selectedIndex - Currently selected index (for highlighting)
 * @returns Formatted string for display
 */
export function formatModelMenu(models: string[], selectedIndex: number): string {
  if (models.length === 0) {
    return "❌ No models found";
  }
  
  let output = "📋 **Select a Model** (↑/↓ to navigate, Enter to select, Esc to cancel)\n\n";
  
  models.forEach((model, idx) => {
    const isSelected = idx === selectedIndex;
    const marker = isSelected ? "▶ " : "  ";
    const color = isSelected ? "🔹 " : "  ";
    output += `${marker}${color}${model}\n`;
  });
  
  output += `\n💡 ${models.length} models available`;
  
  return output;
}

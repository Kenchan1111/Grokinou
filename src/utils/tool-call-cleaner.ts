/**
 * Shared utility for cleaning tool_calls to prevent corruption
 *
 * This prevents issues like:
 * - "functionfunctionfunction" (concatenated types during streaming)
 * - Tool call IDs longer than 40 chars (OpenAI API requirement)
 * - Corrupted tool_calls being stored in database
 */

export interface ToolCall {
  id: string;
  type: "function"; // ✅ Literal type to match OpenAI API requirements
  function: {
    name: string;
    arguments: string;
  };
  index?: number;
}

/**
 * Clean a single tool call:
 * - Truncate ID to 40 chars max (OpenAI API requirement)
 * - Force type to canonical "function" (prevents concatenated values)
 * - Remove index property (internal use only)
 */
export function cleanToolCall(toolCall: any): ToolCall {
  return {
    id: toolCall.id ? toolCall.id.substring(0, 40) : toolCall.id,
    type: "function", // ✅ Always canonical - prevents "functionfunctionfunction"
    function: toolCall.function,
    // index is intentionally excluded (internal streaming artifact)
  };
}

/**
 * Clean an array of tool calls
 * Returns undefined if array is null/undefined/empty (prevents API errors)
 */
export function cleanToolCalls(toolCalls: any[] | undefined | null): ToolCall[] | undefined {
  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
    return undefined;
  }

  return toolCalls.map(cleanToolCall);
}

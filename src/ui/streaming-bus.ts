import { EventEmitter } from "events";

export interface StreamingToolCall {
  id?: string;
  function?: { name?: string };
}

export interface StreamingToolResult {
  content: string;
}

export class StreamingBus extends EventEmitter {
  emitContent(text: string) {
    this.emit("content", text);
  }
  emitTools(tools: StreamingToolCall[]) {
    this.emit("tools", tools);
  }
  emitToolResult(result: StreamingToolResult) {
    this.emit("tool_result", result);
  }
  emitTokenCount(count: number) {
    this.emit("token_count", count);
  }
  emitDone() {
    this.emit("done");
  }
}


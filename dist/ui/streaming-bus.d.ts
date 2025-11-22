import { EventEmitter } from "events";
export interface StreamingToolCall {
    id?: string;
    function?: {
        name?: string;
    };
}
export interface StreamingToolResult {
    content: string;
}
export declare class StreamingBus extends EventEmitter {
    emitContent(text: string): void;
    emitTools(tools: StreamingToolCall[]): void;
    emitToolResult(result: StreamingToolResult): void;
    emitTokenCount(count: number): void;
    emitDone(): void;
}

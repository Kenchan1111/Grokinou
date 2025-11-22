import { EventEmitter } from "events";
export class StreamingBus extends EventEmitter {
    emitContent(text) {
        this.emit("content", text);
    }
    emitTools(tools) {
        this.emit("tools", tools);
    }
    emitToolResult(result) {
        this.emit("tool_result", result);
    }
    emitTokenCount(count) {
        this.emit("token_count", count);
    }
    emitDone() {
        this.emit("done");
    }
}
//# sourceMappingURL=streaming-bus.js.map
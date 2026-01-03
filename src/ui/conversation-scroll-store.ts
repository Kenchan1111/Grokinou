import { EventEmitter } from "events";

export type ConversationScrollMode = "line" | "message";

export interface ConversationScrollState {
  lineOffset: number;
  messageOffset: number;
  mode: ConversationScrollMode;
}

class ConversationScrollStore extends EventEmitter {
  private state: ConversationScrollState = {
    lineOffset: 0,
    messageOffset: 0,
    mode: "line",
  };

  setLine(offset: number): void {
    const next = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
    if (next === this.state.lineOffset && this.state.mode === "line") return;
    this.state = {
      lineOffset: next,
      messageOffset: 0,
      mode: "line",
    };
    this.emit("update", this.state);
  }

  setMessage(offset: number): void {
    const next = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
    if (next === this.state.messageOffset && this.state.mode === "message") return;
    this.state = {
      ...this.state,
      messageOffset: next,
      mode: "message",
    };
    this.emit("update", this.state);
  }

  get(): ConversationScrollState {
    return { ...this.state };
  }

  subscribe(cb: (state: ConversationScrollState) => void): () => void {
    this.on("update", cb);
    return () => this.off("update", cb);
  }
}

const store = new ConversationScrollStore();

export function setConversationScrollOffset(offset: number): void {
  store.setLine(offset);
}

export function setConversationMessageOffset(offset: number): void {
  store.setMessage(offset);
}

export function getConversationScrollOffset(): number {
  return store.get().lineOffset;
}

export function getConversationScrollState(): ConversationScrollState {
  return store.get();
}

export function subscribeConversationScrollOffset(cb: (state: ConversationScrollState) => void): () => void {
  return store.subscribe(cb);
}

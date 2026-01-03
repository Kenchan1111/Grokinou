import { EventEmitter } from "events";

export interface ReviewViewState {
  session_id: number;
  view_id: string;
  mode: "review";
  layout: "split-vertical" | "split-horizontal" | "fullscreen" | "single";
  active_pane: "conversation" | "viewer" | "search" | "other";
  panes: Array<{
    id: string;
    type: "conversation" | "execution" | "search" | "diff" | "tool" | "other";
    resource?: Record<string, any>;
    scroll?: { line?: number; col?: number };
    selection?: { start_line?: number; end_line?: number };
  }>;
  meta?: Record<string, any>;
}

class ReviewViewStore extends EventEmitter {
  private current: ReviewViewState | null = null;
  private pending: ReviewViewState | null = null;

  set(state: ReviewViewState): void {
    this.current = state;
    this.emit("update", state);
  }

  setPending(state: ReviewViewState): void {
    this.pending = state;
  }

  get(): ReviewViewState | null {
    return this.current;
  }

  consumePending(): ReviewViewState | null {
    const state = this.pending;
    this.pending = null;
    return state;
  }

  subscribe(cb: (state: ReviewViewState) => void): () => void {
    this.on("update", cb);
    return () => this.off("update", cb);
  }
}

const store = new ReviewViewStore();

export function setReviewViewState(state: ReviewViewState): void {
  store.set(state);
}

export function setPendingReviewViewState(state: ReviewViewState): void {
  store.setPending(state);
}

export function getReviewViewState(): ReviewViewState | null {
  return store.get();
}

export function consumePendingReviewViewState(): ReviewViewState | null {
  return store.consumePending();
}

export function subscribeReviewViewState(cb: (state: ReviewViewState) => void): () => void {
  return store.subscribe(cb);
}

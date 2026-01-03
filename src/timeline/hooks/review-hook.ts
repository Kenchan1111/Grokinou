/**
 * Review Hook - Capture review/split view state into timeline.
 */
import { EventBus } from '../event-bus.js';
import { EventType } from '../event-types.js';
import type { ReviewViewStatePayload } from '../event-types.js';

export class ReviewHook {
  private static instance: ReviewHook | null = null;
  private eventBus: EventBus;
  private enabled = true;

  private constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public static getInstance(): ReviewHook {
    if (!ReviewHook.instance) {
      ReviewHook.instance = new ReviewHook();
    }
    return ReviewHook.instance;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async captureViewState(payload: ReviewViewStatePayload): Promise<void> {
    if (!this.enabled) return;
    await this.eventBus.emit({
      event_type: EventType.REVIEW_VIEW_STATE,
      actor: 'user',
      aggregate_id: payload.session_id.toString(),
      aggregate_type: 'session',
      payload,
    });
  }
}

export function getReviewHook(): ReviewHook {
  return ReviewHook.getInstance();
}

export default ReviewHook;

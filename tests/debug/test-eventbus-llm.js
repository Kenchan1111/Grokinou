#!/usr/bin/env node
/**
 * DEBUG SCRIPT: Test EventBus LLM Event Logging
 *
 * This script attempts to emit a simple LLM_MESSAGE_USER event
 * to see if it triggers the [EventBus] Timeline logging FAILED error.
 *
 * Expected outcome:
 * - If bug exists: Console error showing why timeline.log() fails
 * - If fixed: Success message and event appears in timeline.db
 */

import { EventBus } from '../../dist/timeline/event-bus.js';
import { TimelineLogger } from '../../dist/timeline/timeline-logger.js';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

console.log('🧪 EventBus LLM Event Test\n');

// 1. Get EventBus instance
const eventBus = EventBus.getInstance();
console.log('✅ EventBus instance obtained');

// 2. Check timeline.db exists and can be queried
const timelineDbPath = path.join(os.homedir(), '.grok', 'timeline.db');
console.log(`📂 Timeline DB: ${timelineDbPath}`);

try {
  const db = new Database(timelineDbPath, { readonly: true });
  const beforeCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM events WHERE event_type = 'LLM_MESSAGE_USER'"
  ).get();
  console.log(`📊 Current LLM_MESSAGE_USER events: ${beforeCount.cnt}`);
  db.close();
} catch (err) {
  console.error('❌ Failed to read timeline.db:', err.message);
  process.exit(1);
}

// 3. Emit a simple LLM_MESSAGE_USER event
console.log('\n📤 Emitting LLM_MESSAGE_USER event...');

const testEvent = {
  event_type: 'LLM_MESSAGE_USER',
  actor: 'test-script',
  aggregate_id: 'test-session-' + Date.now(),
  aggregate_type: 'session',
  payload: {
    content: 'Hello, this is a test message',
    role: 'user',
    timestamp: Date.now()
  },
  metadata: {
    test: true,
    script: 'test-eventbus-llm.js'
  }
};

try {
  const result = await eventBus.emit(testEvent);

  console.log('\n📋 Emit Result:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Event ID: ${result.event_id}`);
  console.log(`  Sequence: ${result.sequence_number}`);

  if (result.error) {
    console.log(`  ❌ Error: ${result.error}`);
  }

  // 4. Verify event was written to DB
  if (result.success) {
    console.log('\n✅ Event emitted successfully!');
    console.log('🔍 Verifying in database...');

    const db = new Database(timelineDbPath, { readonly: true });
    const afterCount = db.prepare(
      "SELECT COUNT(*) as cnt FROM events WHERE event_type = 'LLM_MESSAGE_USER'"
    ).get();
    console.log(`📊 LLM_MESSAGE_USER events after: ${afterCount.cnt}`);

    // Check if our specific event exists
    const ourEvent = db.prepare(
      "SELECT * FROM events WHERE id = ?"
    ).get(result.event_id);

    if (ourEvent) {
      console.log('✅ Event found in timeline.db:');
      console.log(`   ID: ${ourEvent.id}`);
      console.log(`   Type: ${ourEvent.event_type}`);
      console.log(`   Timestamp: ${new Date(ourEvent.timestamp / 1000).toISOString()}`);
    } else {
      console.log('⚠️ Event ID returned but not found in DB!');
    }

    db.close();
  } else {
    console.log('\n❌ Event emission FAILED');
    console.log('💡 Check console output above for [EventBus] Timeline logging FAILED message');
  }

} catch (err) {
  console.error('\n❌ Exception during emit:', err);
  console.error(err.stack);
}

console.log('\n🏁 Test complete\n');

#!/usr/bin/env node
/**
 * SMOKE TEST: LLM Event Logging
 *
 * EXPECTED: LLM_MESSAGE_USER and LLM_MESSAGE_ASSISTANT events in timeline.db
 * CURRENT STATUS: FAILS (0 LLM events despite 85,493 other events)
 *
 * This test documents Bug #1: Timeline.db missing ALL LLM events
 *
 * Once LLMHook is fixed, this test should PASS.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

const timelineDbPath = join(homedir(), '.grok', 'timeline.db');
const conversationsDbPath = join(homedir(), '.grok', 'conversations.db');

function fail(msg) {
  console.error('❌ SMOKE TEST FAILED:', msg);
  process.exit(1);
}

function pass(msg) {
  console.log('✅', msg);
  process.exit(0);
}

function warn(msg) {
  console.warn('⚠️', msg);
}

let timelineDb, conversationsDb;

try {
  timelineDb = new Database(timelineDbPath, { readonly: true });
  conversationsDb = new Database(conversationsDbPath, { readonly: true });

  // Check 1: timeline.db has SOME events
  const totalEvents = timelineDb.prepare(
    'SELECT COUNT(*) as count FROM events'
  ).get();

  if (totalEvents.count === 0) {
    fail('timeline.db is empty (0 events total)');
  }

  console.log(`ℹ️  Total events in timeline.db: ${totalEvents.count}`);

  // Check 2: LLM_MESSAGE_USER events exist
  const userEvents = timelineDb.prepare(
    "SELECT COUNT(*) as count FROM events WHERE event_type = 'LLM_MESSAGE_USER'"
  ).get();

  console.log(`ℹ️  LLM_MESSAGE_USER events: ${userEvents.count}`);

  // Check 3: LLM_MESSAGE_ASSISTANT events exist
  const assistantEvents = timelineDb.prepare(
    "SELECT COUNT(*) as count FROM events WHERE event_type = 'LLM_MESSAGE_ASSISTANT'"
  ).get();

  console.log(`ℹ️  LLM_MESSAGE_ASSISTANT events: ${assistantEvents.count}`);

  // Check 4: conversations.db has messages
  const messagesCount = conversationsDb.prepare(
    'SELECT COUNT(*) as count FROM messages'
  ).get();

  console.log(`ℹ️  Messages in conversations.db: ${messagesCount.count}`);

  // VALIDATION: LLM events should exist if messages exist
  if (messagesCount.count > 0 && (userEvents.count === 0 || assistantEvents.count === 0)) {
    fail(
      `Inconsistency: conversations.db has ${messagesCount.count} messages, ` +
      `but timeline.db has ${userEvents.count} USER + ${assistantEvents.count} ASSISTANT events. ` +
      `LLMHook is BROKEN.`
    );
  }

  // VALIDATION: Should have roughly balanced user/assistant events
  if (userEvents.count === 0 && assistantEvents.count === 0) {
    fail('No LLM events found. LLMHook has NEVER worked.');
  }

  if (userEvents.count > 0 && assistantEvents.count === 0) {
    warn('USER events exist but ASSISTANT events missing');
  }

  if (userEvents.count === 0 && assistantEvents.count > 0) {
    warn('ASSISTANT events exist but USER events missing');
  }

  pass(
    `LLM events logged correctly: ${userEvents.count} USER, ` +
    `${assistantEvents.count} ASSISTANT ✅`
  );

} catch (error) {
  fail(`Database error: ${error.message}`);
} finally {
  if (timelineDb) timelineDb.close();
  if (conversationsDb) conversationsDb.close();
}

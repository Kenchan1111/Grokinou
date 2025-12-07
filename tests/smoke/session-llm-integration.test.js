#!/usr/bin/env node
/**
 * SMOKE TEST: Session-LLM Integration
 *
 * EXPECTED: Each session with messages should have corresponding LLM events in timeline
 * CURRENT STATUS: FAILS (sessions have messages but 0 LLM events)
 *
 * This test verifies the integration between sessions and LLM event logging.
 * It combines checks from Bug #1 and Bug #2.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

const conversationsDbPath = join(homedir(), '.grok', 'conversations.db');
const timelineDbPath = join(homedir(), '.grok', 'timeline.db');

function fail(msg) {
  console.error('❌ SMOKE TEST FAILED:', msg);
  process.exit(1);
}

function pass(msg) {
  console.log('✅', msg);
  process.exit(0);
}

let conversationsDb, timelineDb;

try {
  conversationsDb = new Database(conversationsDbPath, { readonly: true });
  timelineDb = new Database(timelineDbPath, { readonly: true });

  // Get all sessions with messages
  const sessionsWithMessages = conversationsDb.prepare(`
    SELECT s.id, s.title, COUNT(m.id) as message_count
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    GROUP BY s.id
    HAVING message_count > 0
    ORDER BY s.created_at DESC
    LIMIT 10
  `).all();

  if (sessionsWithMessages.length === 0) {
    console.log('ℹ️  No sessions with messages found');
    pass('No sessions to check (clean state)');
  }

  console.log(`ℹ️  Checking ${sessionsWithMessages.length} session(s) with messages...\n`);

  let totalInconsistencies = 0;

  for (const session of sessionsWithMessages) {
    // Check LLM events for this session
    const llmEvents = timelineDb.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE aggregate_id = ?
      AND event_type LIKE 'LLM_MESSAGE_%'
    `).get(session.id.toString());

    const status = llmEvents.count > 0 ? '✅' : '❌';

    console.log(
      `${status} Session ${session.id}: ` +
      `${session.message_count} messages → ` +
      `${llmEvents.count} LLM events`
    );

    if (session.message_count > 0 && llmEvents.count === 0) {
      totalInconsistencies++;
    }
  }

  console.log('');

  if (totalInconsistencies > 0) {
    fail(
      `Found ${totalInconsistencies} session(s) with messages but 0 LLM events. ` +
      `LLMHook integration is BROKEN.`
    );
  }

  pass(`All ${sessionsWithMessages.length} session(s) have consistent LLM events ✅`);

} catch (error) {
  fail(`Database error: ${error.message}`);
} finally {
  if (conversationsDb) conversationsDb.close();
  if (timelineDb) timelineDb.close();
}

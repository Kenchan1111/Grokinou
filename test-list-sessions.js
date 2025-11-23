#!/usr/bin/env node

/**
 * Test script for listSessions() method
 */

import { SessionManagerSQLite } from './dist/utils/session-manager-sqlite.js';

const sessionManager = SessionManagerSQLite.getInstance();

console.log('\n=== Testing listSessions() ===\n');

// Test 1: List all sessions in current directory
console.log('Test 1: List all sessions in current directory');
console.log('─'.repeat(60));
const allSessions = sessionManager.listSessions();
console.log(`Found ${allSessions.length} session(s):\n`);

allSessions.forEach((session, index) => {
  console.log(`Session #${index + 1}:`);
  console.log(`  ID: ${session.id}`);
  console.log(`  Name: ${session.session_name || '(unnamed)'}`);
  console.log(`  Provider: ${session.default_provider}`);
  console.log(`  Model: ${session.default_model}`);
  console.log(`  Messages: ${session.message_count}`);
  console.log(`  Status: ${session.status}`);
  console.log(`  Created: ${session.age_days} days ago`);
  console.log(`  Last activity: ${session.last_activity_relative}`);
  console.log(`  Favorite: ${session.is_favorite ? '⭐' : '☆'}`);
  if (session.first_message_preview) {
    console.log(`  First message: "${session.first_message_preview.substring(0, 50)}..."`);
  }
  console.log('');
});

// Test 2: Filter by status
console.log('\nTest 2: Filter active sessions only');
console.log('─'.repeat(60));
const activeSessions = sessionManager.listSessions(undefined, {
  status: ['active']
});
console.log(`Found ${activeSessions.length} active session(s)\n`);

// Test 3: Sort by message count
console.log('\nTest 3: Sort by message count (richest first)');
console.log('─'.repeat(60));
const sortedByMessages = sessionManager.listSessions(undefined, {
  sortBy: 'message_count',
  sortOrder: 'DESC',
  limit: 5
});
sortedByMessages.forEach(s => {
  console.log(`  ${s.id}. ${s.message_count} messages - ${s.default_provider}/${s.default_model}`);
});

// Test 4: Filter by minimum messages
console.log('\nTest 4: Sessions with at least 100 messages');
console.log('─'.repeat(60));
const richSessions = sessionManager.listSessions(undefined, {
  minMessages: 100
});
console.log(`Found ${richSessions.length} session(s) with 100+ messages\n`);

console.log('✅ All tests completed!\n');

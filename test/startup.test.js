#!/usr/bin/env node
/**
 * Startup & Core Module Test Suite
 * Validates that critical modules load, initialize, and expose expected interfaces.
 * No LLM calls — pure structural/import validation.
 *
 * Usage:
 *   npm run build && node test/startup.test.js
 *
 * @version 1.0.0
 */

import { strict as assert } from 'assert';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const results = [];

async function test(name, fn) {
  const startTime = Date.now();
  console.log(`\n🧪 ${name}...`);

  try {
    await fn();
    const duration = Date.now() - startTime;
    results.push({ name, status: 'PASS', duration });
    console.log(`   ✅ PASS (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({ name, status: 'FAIL', error: error.message, duration });
    console.log(`   ❌ FAIL (${duration}ms): ${error.message}`);
  }
}

function printSummary() {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Results: ${passed}/${total} passed, ${failed} failed, ${skipped} skipped`);

  if (failed > 0) {
    console.log('\n❌ FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.name}: ${r.error}`);
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function run() {
  console.log('🚀 Startup & Core Module Tests\n');

  // ─── Module imports ───────────────────────────────────────────

  await test('Import GrokClient', async () => {
    const mod = await import('../dist/grok/client.js');
    assert.ok(mod.GrokClient, 'GrokClient class should be exported');
  });

  await test('Import GrokAgent', async () => {
    const mod = await import('../dist/agent/grok-agent.js');
    assert.ok(mod.GrokAgent, 'GrokAgent class should be exported');
    assert.ok(mod.GrokAgent.prototype.processUserMessage, 'GrokAgent should have processUserMessage method');
    assert.ok(mod.GrokAgent.prototype.restoreFromHistory, 'GrokAgent should have restoreFromHistory method');
    assert.ok(mod.GrokAgent.prototype.switchToModel, 'GrokAgent should have switchToModel method');
  });

  await test('Import ToolResult type', async () => {
    const mod = await import('../dist/types/index.js');
    assert.ok(mod, 'types/index.js should be importable');
  });

  await test('Import ContextCompactor', async () => {
    const mod = await import('../dist/agent/context-compactor.js');
    assert.ok(mod.ContextCompactor, 'ContextCompactor class should be exported');
  });

  // ─── Tool imports ─────────────────────────────────────────────

  await test('Import atomic tools', async () => {
    const mod = await import('../dist/tools/index.js');
    assert.ok(mod.ReadTool, 'ReadTool should be exported');
    assert.ok(mod.WriteTool, 'WriteTool should be exported');
    assert.ok(mod.EditTool, 'EditTool should be exported');
    assert.ok(mod.GlobTool, 'GlobTool should be exported');
    assert.ok(mod.GrepTool, 'GrepTool should be exported');
  });

  await test('Import legacy tools', async () => {
    const mod = await import('../dist/tools/index.js');
    assert.ok(mod.TextEditorTool, 'TextEditorTool should be exported');
    assert.ok(mod.BashTool, 'BashTool should be exported');
    assert.ok(mod.TodoTool, 'TodoTool should be exported');
    assert.ok(mod.ConfirmationTool, 'ConfirmationTool should be exported');
  });

  await test('Import session tools', async () => {
    const mod = await import('../dist/tools/session-tools.js');
    assert.ok(mod.executeSessionList, 'executeSessionList should be exported');
    assert.ok(mod.executeSessionSwitch, 'executeSessionSwitch should be exported');
    assert.ok(mod.executeSessionNew, 'executeSessionNew should be exported');
  });

  // ─── Tool definitions ─────────────────────────────────────────

  await test('GROK_TOOLS contains all expected tools', async () => {
    const mod = await import('../dist/grok/tools.js');
    const tools = mod.GROK_TOOLS;
    assert.ok(Array.isArray(tools), 'GROK_TOOLS should be an array');

    const names = tools.map(t => t.function.name);

    // Atomic tools
    assert.ok(names.includes('read_file'), 'Missing read_file');
    assert.ok(names.includes('write_file'), 'Missing write_file');
    assert.ok(names.includes('edit_file_replace'), 'Missing edit_file_replace');
    assert.ok(names.includes('glob_files'), 'Missing glob_files');
    assert.ok(names.includes('grep_search'), 'Missing grep_search');

    // Legacy tools
    assert.ok(names.includes('view_file'), 'Missing view_file');
    assert.ok(names.includes('str_replace_editor'), 'Missing str_replace_editor');
    assert.ok(names.includes('create_file'), 'Missing create_file');
    assert.ok(names.includes('bash'), 'Missing bash');
    assert.ok(names.includes('search'), 'Missing search');

    // Session tools
    assert.ok(names.includes('session_list'), 'Missing session_list');
    assert.ok(names.includes('session_switch'), 'Missing session_switch');
    assert.ok(names.includes('session_new'), 'Missing session_new');

    // Timeline tools
    assert.ok(names.includes('timeline_query'), 'Missing timeline_query');
    assert.ok(names.includes('rewind_to'), 'Missing rewind_to');
    assert.ok(names.includes('list_time_points'), 'Missing list_time_points');

    // Delegation
    assert.ok(names.includes('delegate_to_specialist'), 'Missing delegate_to_specialist');

    console.log(`   📋 ${names.length} tools registered`);
  });

  // ─── GrokClient initialization ────────────────────────────────

  await test('GrokClient initializes with model', async () => {
    const { GrokClient } = await import('../dist/grok/client.js');
    const client = new GrokClient('test-key-not-real', 'grok-3', 'https://api.x.ai/v1');
    assert.equal(client.getCurrentModel(), 'grok-3');
    assert.ok(client.getContextWindowSize() > 0, 'Context window should be > 0');
  });

  await test('GrokClient context window sizes', async () => {
    const { GrokClient } = await import('../dist/grok/client.js');

    const grok = new GrokClient('k', 'grok-3', 'https://api.x.ai/v1');
    assert.equal(grok.getContextWindowSize(), 128000);

    const claude = new GrokClient('k', 'claude-sonnet-4', 'https://api.anthropic.com/v1');
    assert.equal(claude.getContextWindowSize(), 200000);
  });

  // ─── ContextCompactor ─────────────────────────────────────────

  await test('ContextCompactor shouldCompact returns false for small context', async () => {
    const { ContextCompactor } = await import('../dist/agent/context-compactor.js');
    const compactor = new ContextCompactor(undefined, 'grok-3');

    const messages = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    assert.equal(compactor.shouldCompact(messages, 128000), false);
  });

  await test('ContextCompactor shouldCompact respects minMessagesBeforeCompaction', async () => {
    const { ContextCompactor } = await import('../dist/agent/context-compactor.js');
    const compactor = new ContextCompactor(undefined, 'grok-3');

    // 10 messages — under the default minimum of 20
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'x'.repeat(5000),
    }));

    assert.equal(compactor.shouldCompact(messages, 128000), false);
  });

  // ─── ReadTool guard ───────────────────────────────────────────

  await test('ReadTool.hasBeenRead tracks files', async () => {
    const { ReadTool } = await import('../dist/tools/read-tool.js');

    // Test hasBeenRead and markAsRead (no clearReadFiles available)
    const testPath = '/tmp/startup-test-' + Date.now() + '.txt';
    assert.equal(ReadTool.hasBeenRead(testPath), false, 'Unknown file should not be marked as read');
    ReadTool.markAsRead(testPath);
    assert.equal(ReadTool.hasBeenRead(testPath), true, 'File should be marked as read after markAsRead');
    assert.equal(ReadTool.hasBeenRead('/tmp/never-read-' + Date.now() + '.txt'), false, 'Other file should not be marked');
  });

  // ─── System prompt loading ────────────────────────────────────

  await test('System prompt loads without error', async () => {
    const { loadSystemPrompt } = await import('../dist/agent/prompt-loader.js');
    const prompt = await loadSystemPrompt('test-model');
    assert.ok(prompt.length > 100, 'System prompt should be substantial');
    assert.ok(prompt.includes('read_file'), 'System prompt should mention atomic tools');
    assert.ok(prompt.includes('grep_search'), 'System prompt should mention grep_search');
  });

  // ─── Token counter ────────────────────────────────────────────

  await test('TokenCounter initializes and counts', async () => {
    const { createTokenCounter } = await import('../dist/utils/token-counter.js');
    const counter = createTokenCounter('grok-3');
    const count = counter.countTokens('Hello, world!');
    assert.ok(count > 0, 'Token count should be > 0');
    assert.ok(count < 100, 'Token count for short string should be < 100');
    counter.dispose();
  });

  // ─── Provider manager ─────────────────────────────────────────

  await test('Provider manager detects providers', async () => {
    const { providerManager } = await import('../dist/utils/provider-manager.js');

    assert.equal(providerManager.detectProvider('grok-3'), 'grok');
    assert.equal(providerManager.detectProvider('claude-sonnet-4'), 'claude');
    assert.equal(providerManager.detectProvider('gpt-4'), 'openai');
    assert.equal(providerManager.detectProvider('deepseek-coder'), 'deepseek');
    assert.equal(providerManager.detectProvider('mistral-large'), 'mistral');
  });

  // ─── Done ─────────────────────────────────────────────────────

  printSummary();
}

run().catch((error) => {
  console.error('💥 Test runner crashed:', error);
  process.exit(1);
});

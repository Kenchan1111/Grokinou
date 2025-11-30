#!/usr/bin/env node

/**
 * Test script to diagnose Execution Viewer issues
 * 
 * This script tests various tool executions to see what information
 * is captured by the Execution Viewer vs what's displayed in chat.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test directory
const testDir = path.join(__dirname, 'test_viewer_output');

// Create test directory
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Test files
const testFiles = {
  'test1.txt': 'This is test file 1\nLine 2\nLine 3',
  'test2.js': '// Test JavaScript file\nfunction hello() {\n  return "world";\n}',
  'test3.json': '{\n  "name": "test",\n  "value": 42\n}'
};

// Create test files
Object.entries(testFiles).forEach(([filename, content]) => {
  const filepath = path.join(testDir, filename);
  fs.writeFileSync(filepath, content);
  console.log(`✅ Created ${filepath}`);
});

console.log('\n=== Test Setup Complete ===\n');
console.log('Test directory:', testDir);
console.log('Test files created:', Object.keys(testFiles).join(', '));

// Test scenarios to check Execution Viewer behavior
const testScenarios = [
  {
    name: 'view_file',
    description: 'View file content',
    command: `node dist/index.js "view ${path.join(testDir, 'test1.txt')}"`
  },
  {
    name: 'search',
    description: 'Search for content',
    command: `node dist/index.js "search for 'test' in ${testDir}"`
  },
  {
    name: 'bash',
    description: 'Execute bash command',
    command: `node dist/index.js "run 'ls -la ${testDir}'"`
  },
  {
    name: 'create_file',
    description: 'Create new file',
    command: `node dist/index.js "create file ${path.join(testDir, 'new_test.txt')} with content 'New test content'"`
  }
];

console.log('\n=== Test Scenarios ===\n');
testScenarios.forEach((scenario, index) => {
  console.log(`${index + 1}. ${scenario.name}: ${scenario.description}`);
  console.log(`   Command: ${scenario.command}`);
});

console.log('\n=== Instructions ===');
console.log('1. Run each test command manually');
console.log('2. Observe what appears in Execution Viewer vs Chat');
console.log('3. Note any missing information or discrepancies');
console.log('4. Check if COT entries are properly captured');
console.log('5. Verify command outputs are streamed correctly');

console.log('\n=== Expected vs Actual ===');
console.log('Expected in Execution Viewer:');
console.log('  - COT entries (thinking, action, observation, decision)');
console.log('  - Command execution with real-time output');
console.log('  - Tool execution status and results');
console.log('  - Execution metadata (timing, success/failure)');

console.log('\nExpected in Chat:');
console.log('  - Tool call entries');
console.log('  - Tool result summaries');
console.log('  - File content/diff displays');

console.log('\n=== Cleanup ===');
console.log(`rm -rf ${testDir}`);
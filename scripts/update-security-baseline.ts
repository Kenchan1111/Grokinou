#!/usr/bin/env node
/**
 * 🔄 UPDATE SECURITY BASELINE
 * 
 * Ce script met à jour les hashes embarqués dans self-integrity.ts
 * après des modifications légitimes des fichiers watchers.
 * 
 * USAGE:
 *   npm run security:update-baseline
 * 
 * ATTENTION:
 *   N'exécutez ce script QUE après avoir vérifié manuellement que les
 *   modifications des fichiers watchers sont légitimes (non malveillantes).
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const REPO_ROOT = join(__dirname, '..');
const SELF_INTEGRITY_FILE = join(REPO_ROOT, 'src', 'security', 'self-integrity.ts');

// 🔧 FIX: Add dist/ files (ChatGPT feedback - CRITICAL)
const WATCHED_FILES = [
  // Source files
  'src/security/integrity-watcher.ts',
  'src/security/llm-guard.ts',
  'src/security/watcher-daemon.ts',
  'src/security/self-integrity.ts',
  'src/security/watcher-cli.ts',
  'src/security/llm-guard-cli.ts',
  'src/security/watcher-daemon-cli.ts',
  
  // Compiled files (RÉELLEMENT EXÉCUTÉS)
  'dist/security/integrity-watcher.js',
  'dist/security/llm-guard.js',
  'dist/security/watcher-daemon.js',
  'dist/security/self-integrity.js',
  'dist/security/watcher-cli.js',
  'dist/security/llm-guard-cli.js',
  'dist/security/watcher-daemon-cli.js',
];

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║                                                               ║');
console.log('║     🔄 UPDATE SECURITY BASELINE - HASH CALCULATION           ║');
console.log('║                                                               ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

// 1. Calculate current hashes
console.log('📊 Calculating current hashes...\n');

const hashes: Record<string, string> = {};

for (const filename of WATCHED_FILES) {
  // 🔧 FIX: filename now includes full path
  const filePath = join(REPO_ROOT, filename);
  
  if (!existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${filename}`);
    hashes[filename] = 'FILE_NOT_FOUND';
    continue;
  }

  const content = readFileSync(filePath, 'utf-8');
  const hash = createHash('sha256').update(content).digest('hex');
  hashes[filename] = hash;

  console.log(`✅ ${filename}`);
  console.log(`   ${hash.substring(0, 64)}...`);
  console.log('');
}

// 2. Show Git status
console.log('═══════════════════════════════════════════════════════════════');
console.log('📝 Git Status (Security Files):\n');

try {
  // 🔧 FIX: Check both src/ and dist/
  const gitStatus = execSync(`git status --short src/security/ dist/security/`, { 
    encoding: 'utf-8',
    cwd: REPO_ROOT 
  });
  
  if (gitStatus.trim()) {
    console.log(gitStatus);
    console.log('⚠️  WARNING: Security files have uncommitted changes!');
    console.log('   Make sure these changes are LEGITIMATE before updating baseline.');
  } else {
    console.log('✅ No uncommitted changes in security files.');
  }
} catch (error) {
  console.warn('⚠️  Unable to check Git status');
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 Git Diff (Last Commit):\n');

try {
  for (const filename of WATCHED_FILES) {
    // 🔧 FIX: filename now includes full path
    const filePath = join(REPO_ROOT, filename);
    if (existsSync(filePath)) {
      try {
        const diff = execSync(`git diff HEAD~1 ${filePath}`, { 
          encoding: 'utf-8',
          cwd: REPO_ROOT 
        });
        if (diff.trim()) {
          console.log(`📄 ${filename}:`);
          console.log(diff.substring(0, 500)); // Show first 500 chars
          if (diff.length > 500) {
            console.log('   [...truncated...]');
          }
          console.log('');
        }
      } catch {
        // File may be new or no diff
      }
    }
  }
} catch (error) {
  console.warn('⚠️  Unable to check Git diff');
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('⚠️  CONFIRMATION REQUIRED\n');
console.log('You are about to update the security baseline with the hashes above.');
console.log('This will TRUST these file versions as legitimate.\n');
console.log('Have you manually verified that all changes are legitimate?');
console.log('(No malicious code injected, no unauthorized modifications)\n');

// 3. Prompt for confirmation
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Type "YES" to proceed, anything else to cancel: ', (answer: string) => {
  console.log('');
  
  if (answer.trim().toUpperCase() !== 'YES') {
    console.log('❌ Update cancelled. Baseline unchanged.');
    rl.close();
    process.exit(0);
  }

  // 4. Update self-integrity.ts
  console.log('🔄 Updating self-integrity.ts...\n');

  let selfIntegrityContent = readFileSync(SELF_INTEGRITY_FILE, 'utf-8');

  // Replace EXPECTED_HASHES object
  const hashesObject = Object.entries(hashes)
    .map(([file, hash]) => `  '${file}': '${hash}',`)
    .join('\n');

  const newHashesBlock = `const EXPECTED_HASHES: Record<string, string> = {
${hashesObject}
};`;

  // Replace using regex
  const regex = /const EXPECTED_HASHES: Record<string, string> = \{[^}]+\};/s;
  
  if (!regex.test(selfIntegrityContent)) {
    console.error('❌ ERROR: Could not find EXPECTED_HASHES in self-integrity.ts');
    rl.close();
    process.exit(1);
  }

  selfIntegrityContent = selfIntegrityContent.replace(regex, newHashesBlock);

  // Write updated file
  writeFileSync(SELF_INTEGRITY_FILE, selfIntegrityContent, 'utf-8');

  console.log('✅ self-integrity.ts updated with new hashes');
  console.log('');

  // 5. Show updated hashes
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ NEW BASELINE ESTABLISHED:\n');

  for (const [filename, hash] of Object.entries(hashes)) {
    console.log(`   ${filename}`);
    console.log(`   ${hash}`);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎯 NEXT STEPS:\n');
  console.log('1. Rebuild: npm run build');
  console.log('2. Test watchers: npm run watcher:start');
  console.log('3. Commit changes: git add src/security/self-integrity.ts');
  console.log('                   git commit -m "Update security baseline"');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  rl.close();
});

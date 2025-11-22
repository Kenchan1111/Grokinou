#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../database.js';
import { SessionRepository } from '../repositories/session-repository.js';
import { MessageRepository } from '../repositories/message-repository.js';
/**
 * Migrate JSONL chat history to SQLite
 */
export async function migrateJsonlToSqlite() {
    console.log('🔄 Starting JSONL → SQLite migration...\n');
    const sessionRepo = new SessionRepository(db.getDb());
    const messageRepo = new MessageRepository(db.getDb());
    // Find all session.jsonl files in .grok directories
    const jsonlFiles = findJsonlFiles(process.cwd());
    if (jsonlFiles.length === 0) {
        console.log('❌ No session.jsonl files found to migrate');
        return;
    }
    console.log(`Found ${jsonlFiles.length} JSONL file(s) to migrate:\n`);
    for (const filePath of jsonlFiles) {
        console.log(`📄 Processing: ${filePath}`);
        try {
            const workdir = path.dirname(path.dirname(filePath)); // Parent of .grok
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(Boolean);
            if (lines.length === 0) {
                console.log('   ⚠️  Empty file, skipping...\n');
                continue;
            }
            // Parse entries and detect sessions based on gaps
            const sessions = splitIntoSessions(lines);
            console.log(`   Found ${sessions.length} session(s) based on time gaps`);
            for (let i = 0; i < sessions.length; i++) {
                const entries = sessions[i];
                // Create session in database
                const session = sessionRepo.findOrCreate(workdir, 'grok', // Default provider for legacy
                'unknown');
                console.log(`   Session ${i + 1}: Created with ID ${session.id}`);
                // Insert all messages
                for (const entry of entries) {
                    try {
                        messageRepo.save({
                            session_id: session.id,
                            type: entry.type,
                            role: entry.type === 'user' ? 'user' : 'assistant',
                            content: entry.content,
                            provider: 'grok',
                            model: 'unknown',
                            timestamp: entry.timestamp,
                            tool_calls: entry.toolCalls,
                            tool_call_id: entry.toolCall?.id,
                        });
                    }
                    catch (err) {
                        console.error(`   ⚠️  Failed to insert message:`, err);
                    }
                }
                console.log(`   ✅ Migrated ${entries.length} messages`);
                // Close this session as completed
                sessionRepo.closeSession(session.id);
            }
            // Backup original file
            const backupPath = filePath + '.backup';
            fs.copyFileSync(filePath, backupPath);
            console.log(`   📦 Backed up to: ${backupPath}`);
            // Remove original (optional - commented for safety)
            // fs.unlinkSync(filePath);
            console.log(`   ✅ Migration complete!\n`);
        }
        catch (error) {
            console.error(`   ❌ Error migrating ${filePath}:`, error.message);
            console.log('');
        }
    }
    console.log('🎉 Migration finished!');
    console.log('\nNext steps:');
    console.log('1. Verify your data: sqlite3 ~/.grok/conversations.db "SELECT * FROM sessions;"');
    console.log('2. Test your CLI: npm start');
    console.log('3. If everything works, you can delete .backup files');
}
/**
 * Find all session.jsonl files in .grok directories
 */
function findJsonlFiles(rootDir) {
    const files = [];
    function search(dir) {
        try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    // Look for .grok directories
                    if (item === '.grok') {
                        const sessionFile = path.join(fullPath, 'session.jsonl');
                        if (fs.existsSync(sessionFile)) {
                            files.push(sessionFile);
                        }
                    }
                    else if (!item.startsWith('.') && !item.includes('node_modules')) {
                        // Recurse into non-hidden directories
                        search(fullPath);
                    }
                }
            }
        }
        catch (err) {
            // Ignore permission errors
        }
    }
    search(rootDir);
    return files;
}
/**
 * Split JSONL entries into sessions based on time gaps
 */
function splitIntoSessions(lines) {
    const sessions = [];
    let currentSession = [];
    let lastTimestamp = 0;
    const ONE_HOUR = 60 * 60 * 1000;
    for (const line of lines) {
        try {
            const entry = JSON.parse(line);
            const timestamp = new Date(entry.timestamp).getTime();
            // If gap > 1 hour or "exit" detected, start new session
            if (currentSession.length > 0 &&
                (timestamp - lastTimestamp > ONE_HOUR ||
                    entry.content?.toLowerCase().includes('exit'))) {
                sessions.push(currentSession);
                currentSession = [];
            }
            currentSession.push(entry);
            lastTimestamp = timestamp;
        }
        catch (err) {
            console.error('   ⚠️  Failed to parse line:', line.substring(0, 50));
        }
    }
    // Push last session
    if (currentSession.length > 0) {
        sessions.push(currentSession);
    }
    return sessions;
}
// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateJsonlToSqlite()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=migrate-jsonl.js.map
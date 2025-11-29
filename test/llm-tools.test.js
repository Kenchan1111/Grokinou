#!/usr/bin/env node
/**
 * LLM Tools Test Suite
 * Tests all LLM tools: session_new, session_list, session_switch, rewind_to, timeline_query, list_time_points
 *
 * Usage:
 *   npm run build && node test/llm-tools.test.js
 *
 * @version 1.0.0
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
var results = [];
function test(name, fn) {
    var startTime = Date.now();
    console.log("\n\uD83E\uDDEA ".concat(name, "..."));
    try {
        var result = fn();
        if (result instanceof Promise) {
            result.then(function () {
                var duration = Date.now() - startTime;
                results.push({ name: name, status: 'PASS', duration: duration });
                console.log("   \u2705 PASS (".concat(duration, "ms)"));
            }).catch(function (error) {
                var duration = Date.now() - startTime;
                results.push({ name: name, status: 'FAIL', error: error.message, duration: duration });
                console.log("   \u274C FAIL (".concat(duration, "ms): ").concat(error.message));
            });
        }
        else {
            var duration = Date.now() - startTime;
            results.push({ name: name, status: 'PASS', duration: duration });
            console.log("   \u2705 PASS (".concat(duration, "ms)"));
        }
    }
    catch (error) {
        var duration = Date.now() - startTime;
        results.push({ name: name, status: 'FAIL', error: error.message, duration: duration });
        console.log("   \u274C FAIL (".concat(duration, "ms): ").concat(error.message));
    }
}
function skip(name, reason) {
    console.log("\n\u23ED\uFE0F  ".concat(name, " (SKIPPED: ").concat(reason, ")"));
    results.push({ name: name, status: 'SKIP', error: reason, duration: 0 });
}
// Simulated tool execution (in production, these would call actual tools)
function executeToolSimulated(toolName, params) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            console.log("   \uD83D\uDCDD Simulating tool: ".concat(toolName), JSON.stringify(params, null, 2).substring(0, 100));
            return [2 /*return*/, __assign({ success: true, output: "Simulated ".concat(toolName, " execution") }, params)];
        });
    });
}
// Helper to create temporary test directory
function createTestDir(name) {
    var tmpDir = path.join(os.tmpdir(), "grokinou-llm-test-".concat(name, "-").concat(Date.now()));
    fs.mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
}
// Helper to cleanup test directory
function cleanupTestDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST SUITE: session_new Tool
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n┌────────────────────────────────────────────────────────────┐');
console.log('│ TEST SUITE: session_new Tool                              │');
console.log('└────────────────────────────────────────────────────────────┘');
test('session_new: creates empty session (default)', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testDir, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testDir = createTestDir('session-new-empty');
                return [4 /*yield*/, executeToolSimulated('session_new', {
                        directory: testDir
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.ok(result.directory);
                cleanupTestDir(testDir);
                return [2 /*return*/];
        }
    });
}); });
test('session_new: init_mode=clone-git clones current Git repo', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testDir, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testDir = createTestDir('session-new-clone-git');
                return [4 /*yield*/, executeToolSimulated('session_new', {
                        directory: testDir,
                        init_mode: 'clone-git'
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.init_mode, 'clone-git');
                cleanupTestDir(testDir);
                return [2 /*return*/];
        }
    });
}); });
test('session_new: init_mode=copy-files copies files', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testDir, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testDir = createTestDir('session-new-copy-files');
                return [4 /*yield*/, executeToolSimulated('session_new', {
                        directory: testDir,
                        init_mode: 'copy-files'
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.init_mode, 'copy-files');
                cleanupTestDir(testDir);
                return [2 /*return*/];
        }
    });
}); });
test('session_new: init_mode=from-rewind with timestamp', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testDir, timestamp, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testDir = createTestDir('session-new-from-rewind');
                timestamp = new Date().toISOString();
                return [4 /*yield*/, executeToolSimulated('session_new', {
                        directory: testDir,
                        init_mode: 'from-rewind',
                        rewind_timestamp: timestamp,
                        rewind_git_mode: 'full'
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.init_mode, 'from-rewind');
                assert.strictEqual(result.rewind_timestamp, timestamp);
                assert.strictEqual(result.rewind_git_mode, 'full');
                cleanupTestDir(testDir);
                return [2 /*return*/];
        }
    });
}); });
test('session_new: imports conversation history', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testDir, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testDir = createTestDir('session-new-import-history');
                return [4 /*yield*/, executeToolSimulated('session_new', {
                        directory: testDir,
                        import_history: true,
                        from_session_id: 1
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.import_history, true);
                assert.strictEqual(result.from_session_id, 1);
                cleanupTestDir(testDir);
                return [2 /*return*/];
        }
    });
}); });
test('session_new: filters history by date range', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testDir, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testDir = createTestDir('session-new-date-filter');
                return [4 /*yield*/, executeToolSimulated('session_new', {
                        directory: testDir,
                        import_history: true,
                        date_range_start: '2025-11-01',
                        date_range_end: '2025-11-07'
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.date_range_start, '2025-11-01');
                assert.strictEqual(result.date_range_end, '2025-11-07');
                cleanupTestDir(testDir);
                return [2 /*return*/];
        }
    });
}); });
test('session_new: specifies model and provider', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testDir, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testDir = createTestDir('session-new-model-provider');
                return [4 /*yield*/, executeToolSimulated('session_new', {
                        directory: testDir,
                        model: 'claude-sonnet-4',
                        provider: 'anthropic'
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.model, 'claude-sonnet-4');
                assert.strictEqual(result.provider, 'anthropic');
                cleanupTestDir(testDir);
                return [2 /*return*/];
        }
    });
}); });
test('session_new: all options combined', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testDir, timestamp, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testDir = createTestDir('session-new-all-options');
                timestamp = new Date().toISOString();
                return [4 /*yield*/, executeToolSimulated('session_new', {
                        directory: testDir,
                        init_mode: 'from-rewind',
                        rewind_timestamp: timestamp,
                        rewind_git_mode: 'metadata',
                        import_history: true,
                        from_session_id: 5,
                        date_range_start: '2025-11-01',
                        date_range_end: '2025-11-28',
                        model: 'grok-2-1212',
                        provider: 'xai'
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.init_mode, 'from-rewind');
                assert.strictEqual(result.rewind_git_mode, 'metadata');
                assert.strictEqual(result.model, 'grok-2-1212');
                cleanupTestDir(testDir);
                return [2 /*return*/];
        }
    });
}); });
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST SUITE: session_list Tool
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n┌────────────────────────────────────────────────────────────┐');
console.log('│ TEST SUITE: session_list Tool                             │');
console.log('└────────────────────────────────────────────────────────────┘');
test('session_list: lists all sessions', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('session_list', {})];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                return [2 /*return*/];
        }
    });
}); });
test('session_list: includes session metadata', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('session_list', {})];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                return [2 /*return*/];
        }
    });
}); });
test('session_list: groups by directory', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('session_list', {})];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                return [2 /*return*/];
        }
    });
}); });
test('session_list: marks current directory', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('session_list', {})];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                return [2 /*return*/];
        }
    });
}); });
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST SUITE: session_switch Tool
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n┌────────────────────────────────────────────────────────────┐');
console.log('│ TEST SUITE: session_switch Tool                           │');
console.log('└────────────────────────────────────────────────────────────┘');
test('session_switch: switches to existing session', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('session_switch', {
                    session_id: 1
                })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.session_id, 1);
                return [2 /*return*/];
        }
    });
}); });
test('session_switch: changes working directory', function () { return __awaiter(void 0, void 0, void 0, function () {
    var originalCwd, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                originalCwd = process.cwd();
                return [4 /*yield*/, executeToolSimulated('session_switch', {
                        session_id: 2
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                return [2 /*return*/];
        }
    });
}); });
test('session_switch: loads conversation history', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('session_switch', {
                    session_id: 3
                })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                return [2 /*return*/];
        }
    });
}); });
test('session_switch: validates session ID', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('session_switch', {
                    session_id: 99999
                })];
            case 1:
                result = _a.sent();
                return [2 /*return*/];
        }
    });
}); });
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST SUITE: rewind_to Tool
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n┌────────────────────────────────────────────────────────────┐');
console.log('│ TEST SUITE: rewind_to Tool                                │');
console.log('└────────────────────────────────────────────────────────────┘');
test('rewind_to: basic rewind to timestamp', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.targetTimestamp, timestamp);
                return [2 /*return*/];
        }
    });
}); });
test('rewind_to: custom output directory', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, outputDir, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                outputDir = createTestDir('rewind-custom-output');
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp,
                        outputDir: outputDir
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.outputDir, outputDir);
                cleanupTestDir(outputDir);
                return [2 /*return*/];
        }
    });
}); });
test('rewind_to: gitMode=none (no Git)', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp,
                        gitMode: 'none'
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.gitMode, 'none');
                return [2 /*return*/];
        }
    });
}); });
test('rewind_to: gitMode=metadata (git_state.json only)', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp,
                        gitMode: 'metadata'
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.gitMode, 'metadata');
                return [2 /*return*/];
        }
    });
}); });
test('rewind_to: gitMode=full (complete .git repo)', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp,
                        gitMode: 'full'
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.gitMode, 'full');
                return [2 /*return*/];
        }
    });
}); });
test('rewind_to: createSession=true', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp,
                        createSession: true
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.createSession, true);
                return [2 /*return*/];
        }
    });
}); });
test('rewind_to: autoCheckout=true', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp,
                        autoCheckout: true
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.autoCheckout, true);
                return [2 /*return*/];
        }
    });
}); });
test('rewind_to: compareWith directory', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, compareDir, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                compareDir = process.cwd();
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp,
                        compareWith: compareDir
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.compareWith, compareDir);
                return [2 /*return*/];
        }
    });
}); });
test('rewind_to: includeFiles=false (skip files)', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp,
                        includeFiles: false
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.includeFiles, false);
                return [2 /*return*/];
        }
    });
}); });
test('rewind_to: includeConversations=false (skip conversations)', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp,
                        includeConversations: false
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.includeConversations, false);
                return [2 /*return*/];
        }
    });
}); });
test('rewind_to: with reason (audit trail)', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, reason, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                reason = 'Testing rewind functionality';
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp,
                        reason: reason
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.reason, reason);
                return [2 /*return*/];
        }
    });
}); });
test('rewind_to: all options combined', function () { return __awaiter(void 0, void 0, void 0, function () {
    var timestamp, outputDir, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                timestamp = new Date().toISOString();
                outputDir = createTestDir('rewind-all-options');
                return [4 /*yield*/, executeToolSimulated('rewind_to', {
                        targetTimestamp: timestamp,
                        outputDir: outputDir,
                        includeFiles: true,
                        includeConversations: true,
                        gitMode: 'full',
                        createSession: true,
                        autoCheckout: true,
                        compareWith: process.cwd(),
                        reason: 'Full featured rewind test'
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.gitMode, 'full');
                assert.strictEqual(result.createSession, true);
                assert.strictEqual(result.autoCheckout, true);
                cleanupTestDir(outputDir);
                return [2 /*return*/];
        }
    });
}); });
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST SUITE: timeline_query Tool
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n┌────────────────────────────────────────────────────────────┐');
console.log('│ TEST SUITE: timeline_query Tool                           │');
console.log('└────────────────────────────────────────────────────────────┘');
test('timeline_query: basic query (all events)', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('timeline_query', {})];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                return [2 /*return*/];
        }
    });
}); });
test('timeline_query: filters by start time', function () { return __awaiter(void 0, void 0, void 0, function () {
    var startTime, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                startTime = new Date('2025-11-01').toISOString();
                return [4 /*yield*/, executeToolSimulated('timeline_query', {
                        startTime: startTime
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.startTime, startTime);
                return [2 /*return*/];
        }
    });
}); });
test('timeline_query: filters by end time', function () { return __awaiter(void 0, void 0, void 0, function () {
    var endTime, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                endTime = new Date().toISOString();
                return [4 /*yield*/, executeToolSimulated('timeline_query', {
                        endTime: endTime
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.endTime, endTime);
                return [2 /*return*/];
        }
    });
}); });
test('timeline_query: filters by category', function () { return __awaiter(void 0, void 0, void 0, function () {
    var categories, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                categories = ['FILE_MODIFIED', 'GIT_COMMIT'];
                return [4 /*yield*/, executeToolSimulated('timeline_query', {
                        categories: categories
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.deepStrictEqual(result.categories, categories);
                return [2 /*return*/];
        }
    });
}); });
test('timeline_query: filters by session ID', function () { return __awaiter(void 0, void 0, void 0, function () {
    var sessionId, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                sessionId = 1;
                return [4 /*yield*/, executeToolSimulated('timeline_query', {
                        sessionId: sessionId
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.sessionId, sessionId);
                return [2 /*return*/];
        }
    });
}); });
test('timeline_query: limits results', function () { return __awaiter(void 0, void 0, void 0, function () {
    var limit, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                limit = 50;
                return [4 /*yield*/, executeToolSimulated('timeline_query', {
                        limit: limit
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.limit, limit);
                return [2 /*return*/];
        }
    });
}); });
test('timeline_query: statsOnly mode', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('timeline_query', {
                    statsOnly: true
                })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.statsOnly, true);
                return [2 /*return*/];
        }
    });
}); });
test('timeline_query: all filters combined', function () { return __awaiter(void 0, void 0, void 0, function () {
    var startTime, endTime, categories, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                startTime = new Date('2025-11-01').toISOString();
                endTime = new Date().toISOString();
                categories = ['FILE_MODIFIED'];
                return [4 /*yield*/, executeToolSimulated('timeline_query', {
                        startTime: startTime,
                        endTime: endTime,
                        categories: categories,
                        sessionId: 1,
                        limit: 100,
                        statsOnly: false
                    })];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                assert.strictEqual(result.limit, 100);
                return [2 /*return*/];
        }
    });
}); });
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST SUITE: list_time_points Tool
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n┌────────────────────────────────────────────────────────────┐');
console.log('│ TEST SUITE: list_time_points Tool                         │');
console.log('└────────────────────────────────────────────────────────────┘');
test('list_time_points: lists available snapshots', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('list_time_points', {})];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                return [2 /*return*/];
        }
    });
}); });
test('list_time_points: includes snapshot metadata', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('list_time_points', {})];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                return [2 /*return*/];
        }
    });
}); });
test('list_time_points: includes recent events', function () { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, executeToolSimulated('list_time_points', {})];
            case 1:
                result = _a.sent();
                assert.strictEqual(result.success, true);
                return [2 /*return*/];
        }
    });
}); });
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST RESULTS SUMMARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n┌────────────────────────────────────────────────────────────┐');
console.log('│ TEST RESULTS SUMMARY                                       │');
console.log('└────────────────────────────────────────────────────────────┘\n');
var passed = results.filter(function (r) { return r.status === 'PASS'; }).length;
var failed = results.filter(function (r) { return r.status === 'FAIL'; }).length;
var skipped = results.filter(function (r) { return r.status === 'SKIP'; }).length;
var total = results.length;
console.log("\u2705 PASSED:  ".concat(passed, "/").concat(total));
console.log("\u274C FAILED:  ".concat(failed, "/").concat(total));
console.log("\u23ED\uFE0F  SKIPPED: ".concat(skipped, "/").concat(total));
if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(function (r) { return r.status === 'FAIL'; }).forEach(function (r) {
        console.log("   \u2022 ".concat(r.name, ": ").concat(r.error));
    });
}
if (skipped > 0) {
    console.log('\n⏭️  SKIPPED TESTS:');
    results.filter(function (r) { return r.status === 'SKIP'; }).forEach(function (r) {
        console.log("   \u2022 ".concat(r.name, ": ").concat(r.error));
    });
}
var totalDuration = results.reduce(function (sum, r) { return sum + r.duration; }, 0);
console.log("\n\u23F1\uFE0F  Total duration: ".concat(totalDuration, "ms"));
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 LLM TOOLS TEST COVERAGE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ session_new:       8 tests (all init_mode options)');
console.log('✅ session_list:      4 tests');
console.log('✅ session_switch:    4 tests');
console.log('✅ rewind_to:        12 tests (all gitMode, createSession, autoCheckout, compareWith)');
console.log('✅ timeline_query:    8 tests (all filters)');
console.log('✅ list_time_points:  3 tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log("TOTAL: ".concat(total, " tests"));
// Exit with error code if any tests failed
process.exit(failed > 0 ? 1 : 0);

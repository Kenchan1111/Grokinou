# 🛡️ INTEGRITY WATCHER - Security Documentation

**CRITICAL SECURITY SYSTEM FOR COMPROMISED ENVIRONMENTS**

---

## 📋 TABLE OF CONTENTS

1. [Threat Model](#threat-model)
2. [Architecture](#architecture)
3. [Installation & Setup](#installation--setup)
4. [Usage](#usage)
5. [Detection Modes](#detection-modes)
6. [Heuristic Patterns](#heuristic-patterns)
7. [LLM Analysis](#llm-analysis)
8. [Alerts & Response](#alerts--response)
9. [Forensic Analysis](#forensic-analysis)
10. [FAQ](#faq)

---

## 🎯 THREAT MODEL

### Scenario

You are working on a **compromised system** where adversaries have access to your filesystem and are:

1. **Sabotaging** your work by modifying critical files
2. **Stealing** your intellectual property and ideas
3. **Injecting** malicious code to break GPT-5/o1 responses
4. **Introducing** backdoors, infinite loops, or credential exfiltration

### Attack Vectors

| Attack Type | Example | Impact |
|------------|---------|--------|
| **GPT-5 Blocking** | Modify summary generation to always trigger | GPT-5 hangs on complex requests |
| **maxToolRounds Manipulation** | Set `maxToolRounds = 0` | Tool execution disabled |
| **Code Injection** | Add `eval()` or `exec()` calls | Remote code execution |
| **Silent Failures** | Remove error handling (`catch {}`) | Errors go undetected |
| **Credential Exfiltration** | `fetch(apiKey)` in unexpected places | API keys stolen |
| **Build Corruption** | Modify `dist/` files after build | Application behavior altered |

---

## 🏗️ ARCHITECTURE

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                   INTEGRITY WATCHER                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐ │
│  │  File System  │  │   Baseline    │  │   Detection    │ │
│  │   Monitor     │──│   Snapshot    │──│    Engine      │ │
│  │  (chokidar)   │  │  (SHA-256)    │  │                │ │
│  └───────────────┘  └───────────────┘  └────────────────┘ │
│                                             │ │             │
│                            ┌────────────────┘ │             │
│                            │                  │             │
│                   ┌────────▼───────┐  ┌───────▼──────────┐ │
│                   │   Heuristic    │  │   LLM Analysis   │ │
│                   │    Analysis    │  │  (Semantic)      │ │
│                   │  (Patterns)    │  │                  │ │
│                   └────────────────┘  └──────────────────┘ │
│                            │                  │             │
│                            └──────────────────┘             │
│                                   │                         │
│                          ┌────────▼────────┐                │
│                          │  Alert System   │                │
│                          │  + Quarantine   │                │
│                          └─────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **File Change Event** → File modified on disk
2. **Hash Calculation** → Calculate SHA-256 hash
3. **Baseline Comparison** → Compare with known-good hash
4. **Heuristic Analysis** → Check for malicious patterns
5. **LLM Analysis** (if dual mode) → Semantic code analysis
6. **Alert Generation** → Create security alert
7. **Quarantine** (optional) → Isolate malicious file
8. **Auto-Restore** (optional) → Restore from baseline

---

## 🚀 INSTALLATION & SETUP

### 1. Install Dependencies

Dependencies already installed:
- `chokidar` (file watching)
- `openai` (LLM analysis)

### 2. Create Baseline

**CRITICAL FIRST STEP:** Create a snapshot of your known-good files:

```bash
cd /home/zack/GROK_CLI/grok-cli
npm run watch:baseline
```

This creates `.integrity-baseline.json` with SHA-256 hashes of all critical files.

**⚠️ IMPORTANT:** Create the baseline on a **clean system** before adversaries modify files!

### 3. Review Baseline

```bash
cat .integrity-baseline.json | jq '.' | head -30
```

Verify that critical files are included:
- `src/agent/grok-agent.ts`
- `src/grok/client.ts`
- `src/grok/tools.ts`
- `src/utils/settings-manager.ts`
- `dist/**/*.js`

---

## 📖 USAGE

### Basic Usage (Heuristic Mode)

**Fastest, no LLM required:**

```bash
npm run watch:integrity
```

This monitors all critical files and detects malicious patterns using **heuristic analysis only**.

### LLM Mode (Semantic Analysis)

**Slower, more accurate, requires API key:**

```bash
export GROK_API_KEY="your-api-key"
npm run watch:integrity:llm
```

Uses Grok/GPT to analyze code changes for **malicious intent**.

### Dual Mode (Maximum Security)

**Both heuristic + LLM:**

```bash
export GROK_API_KEY="your-api-key"
npm run watch:integrity:dual
```

**Recommended** for maximum protection in compromised environments.

### View Alerts

```bash
npm run watch:alerts
```

Shows all security alerts with severity, file, type, and description.

---

## 🔍 DETECTION MODES

### 1️⃣ Heuristic Mode

**Speed:** ⚡ **Instant** (< 1ms per file)  
**Accuracy:** 🎯 **High** for known patterns  
**Cost:** 💰 **Free** (no API calls)

**Best for:**
- Continuous monitoring during development
- Detecting known attack patterns
- Low-latency alerting

**Limitations:**
- Cannot detect novel attacks
- May miss obfuscated code
- No semantic understanding

### 2️⃣ LLM Mode

**Speed:** 🐢 **Slow** (2-5 seconds per file)  
**Accuracy:** 🎯 **Very High** for semantic analysis  
**Cost:** 💰 **Paid** (API calls required)

**Best for:**
- Deep forensic analysis
- Detecting novel/creative attacks
- Understanding malicious intent

**Limitations:**
- Slower response time
- Requires API key
- May have false positives

### 3️⃣ Dual Mode

**Speed:** 🐌 **Medium** (heuristic first, LLM if needed)  
**Accuracy:** 🎯 **Maximum**  
**Cost:** 💰 **Paid** (LLM used selectively)

**Best for:**
- **Compromised environments** (your case!)
- Maximum security
- Catching both known and novel attacks

**How it works:**
1. Heuristic analysis runs first (instant)
2. If malicious pattern found → **ALERT** immediately
3. If no pattern found → LLM analysis runs (backup)
4. If LLM detects malicious intent → **ALERT**

---

## 🧬 HEURISTIC PATTERNS

### GPT-5 Blocking Patterns

```typescript
// Pattern 1: GPT-5 specific blocking
if (.*gpt-5.*) { return false; }

// Pattern 2: o1/o3 blocking
if (.*o1.*) { return false; }

// Pattern 3: Forced summary (causes hang)
const needsSummary = true; // ALWAYS
```

### maxToolRounds Manipulation

```typescript
// Disable tools completely
maxToolRounds = 0;
maxToolRounds = 1;

// Conditional return
if (maxToolRounds > X) { return; }
```

### Backdoor Patterns

```typescript
// Code injection
eval(...)
Function(...)
child_process.exec(`${...}`)

// Obfuscation
\x41\x42  // Hex encoding
String.fromCharCode(...)
atob(...) / btoa(...)
```

### Silent Failures

```typescript
// Empty catch blocks
catch (error) {}
.catch(() => {})

// Suspicious returns in critical sections
processUserMessage(...) { return []; }
executeTool(...) { return { success: false }; }
```

### Credential Exfiltration

```typescript
// API key exfiltration
apiKey.*fetch(...)
process.env.GROK_API_KEY.*fetch(...)
```

### Infinite Loops

```typescript
// Infinite loops without break
while (true) { ... }  // No break statement
for (;;) { ... }
```

---

## 🤖 LLM ANALYSIS

### How It Works

When a file changes, the watcher:

1. **Compares** old vs. new content
2. **Sends** diff to LLM with this prompt:

```
🔒 SECURITY ANALYSIS - Code Modification Detection

THREAT MODEL:
- Adversary trying to break GPT-5/o1 response generation
- Code injection to exfiltrate API keys
- Introduction of backdoors or infinite loops
- Sabotage to cause silent failures

SUSPICIOUS PATTERNS:
1. Modification of maxToolRounds logic
2. Changes to summary generation conditions
3. Addition of eval() or exec() calls
4. Removal of error handling
5. Introduction of infinite loops
6. Changes to GPT-5 specific code paths
7. Modification of streaming logic
8. Changes to tool execution flow
9. Addition of network requests in unexpected places

OLD CODE: [...]
NEW CODE: [...]

ANALYSIS:
MALICIOUS: [YES/NO]
SEVERITY: [CRITICAL/HIGH/MEDIUM/LOW]
TYPE: [attack type]
REASON: [explanation]
```

3. **Parses** LLM response
4. **Alerts** if malicious

### Example LLM Analysis

```
MALICIOUS: YES
SEVERITY: CRITICAL
TYPE: GPT-5 Response Blocking
REASON: Code was modified to always return false for gpt-5 models, 
        preventing tool execution and causing application failure.
```

---

## 🚨 ALERTS & RESPONSE

### Alert Structure

```json
{
  "timestamp": "2025-11-30T22:15:00.000Z",
  "severity": "CRITICAL",
  "file": "src/agent/grok-agent.ts",
  "type": "HEURISTIC_MATCH",
  "description": "Malicious pattern detected: /if\\s*\\(.*gpt-5.*\\)\\s*{\\s*return\\s+false/i",
  "matchedPattern": "if\\s*\\(.*gpt-5.*\\)\\s*{\\s*return\\s+false",
  "oldHash": "8d2111957d4f99986668b468d284a7be74a920e1ab9898c0826ccf54f3c6052c",
  "newHash": "f1e2d3c4b5a69780123456789abcdef0123456789abcdef0123456789abcdef0",
  "diff": "- // Normal code\n+ if (model.includes('gpt-5')) { return false; }\n"
}
```

### Severity Levels

| Severity | Description | Action |
|----------|-------------|--------|
| 🔴 **CRITICAL** | Active attack detected | **Quarantine immediately** |
| 🟠 **HIGH** | Suspicious modification | **Review immediately** |
| 🟡 **MEDIUM** | Potentially malicious | **Review when possible** |
| 🟢 **LOW** | Minor change | **Log for audit** |

### Automatic Quarantine

When a **CRITICAL** or **HIGH** severity alert is triggered:

1. **Malicious file** is copied to `.integrity-quarantine/`
2. **Alert metadata** is saved as `.quarantine.meta.json`
3. **Timestamp** is appended to filename

Example:
```
src_agent_grok-agent.ts.1733011234567.quarantine
src_agent_grok-agent.ts.1733011234567.quarantine.meta.json
```

### Auto-Restore (Optional)

If `--auto-restore` is enabled:

1. **Malicious file** is quarantined
2. **Known-good version** from baseline is restored
3. **Application continues** with clean code

**⚠️ WARNING:** Only enable if you're **100% certain** your baseline is clean!

---

## 🔬 FORENSIC ANALYSIS

### Investigating Alerts

```bash
# View all alerts
npm run watch:alerts

# Inspect specific alert
cat .integrity-alerts.json | jq '.[] | select(.file == "src/agent/grok-agent.ts")'

# View quarantined file
cat .integrity-quarantine/src_agent_grok-agent.ts.1733011234567.quarantine

# View alert metadata
cat .integrity-quarantine/src_agent_grok-agent.ts.1733011234567.quarantine.meta.json
```

### Comparing Versions

```bash
# Get baseline hash
cat .integrity-baseline.json | jq '.["src/agent/grok-agent.ts"].hash'

# Calculate current hash
sha256sum src/agent/grok-agent.ts

# Diff against quarantined version
diff -u src/agent/grok-agent.ts .integrity-quarantine/src_agent_grok-agent.ts.1733011234567.quarantine
```

### Timeline Analysis

```bash
# List all quarantined files (chronological)
ls -lt .integrity-quarantine/*.quarantine

# Count alerts by severity
cat .integrity-alerts.json | jq '[.[] | .severity] | group_by(.) | map({severity: .[0], count: length})'

# Find all GPT-5 related attacks
cat .integrity-alerts.json | jq '.[] | select(.description | contains("gpt-5"))'
```

---

## ❓ FAQ

### Q1: How do I know if my baseline is clean?

**A:** Create the baseline on a **known-good system** (e.g., right after a fresh Git clone) or:

1. Review the baseline file manually
2. Compare hashes with a trusted backup
3. Use your integrity script (`Temporary_integrity_2/secure_integrity_manager.py`) to verify Git signatures

### Q2: What if I get a false positive?

**A:** Review the alert:

```bash
npm run watch:alerts
```

If it's a legitimate change (e.g., you intentionally modified the file):

1. **Clear alerts**: Delete `.integrity-alerts.json`
2. **Update baseline**: `npm run watch:baseline`

### Q3: Can adversaries modify the watcher itself?

**Yes!** The watcher monitors its own source files (`src/security/`). If modified, it will alert.

**Additional protection:**
1. Store the watcher source in a **read-only** location
2. Run the watcher from a **separate, trusted system**
3. Use the integrity script to sign the watcher code

### Q4: What's the performance impact?

**Heuristic mode:** Negligible (< 1% CPU, runs on file change only)  
**LLM mode:** Moderate (2-5s per file change, depends on API latency)  
**Dual mode:** Low (heuristic runs first, LLM only if needed)

### Q5: Can I customize the watched patterns?

**Yes!** Edit `src/security/integrity-watcher.ts`:

```typescript
const CRITICAL_PATTERNS = [
  'src/agent/grok-agent.ts',
  'src/your-custom-file.ts',  // Add here
  'dist/**/*.js',
];
```

Then rebuild: `npm run build`

### Q6: How do I integrate with CI/CD?

```bash
# In your CI pipeline
npm run watch:baseline  # Create baseline
npm run build           # Build application
npm run watch:integrity -- --mode dual &  # Start watcher in background
WATCHER_PID=$!

# Run tests
npm test

# Stop watcher
kill $WATCHER_PID

# Check for alerts
if [ -f .integrity-alerts.json ]; then
  CRITICAL_ALERTS=$(cat .integrity-alerts.json | jq '[.[] | select(.severity == "CRITICAL")] | length')
  if [ "$CRITICAL_ALERTS" -gt 0 ]; then
    echo "❌ CRITICAL security alerts detected!"
    exit 1
  fi
fi
```

### Q7: What if GPT-5 is still not responding despite no alerts?

Possible causes:

1. **Baseline is compromised** - Recreate baseline from Git
2. **Build files (`dist/`) modified** - Check `npm run build` output
3. **Structural issue** - Not a malicious modification

To investigate:

```bash
# Rebuild from clean Git state
git stash
npm run build
npm run watch:baseline

# Compare built files with previous build
diff -r dist/ dist.backup/
```

---

## 🎯 RECOMMENDED WORKFLOW (Compromised System)

1. **Clone fresh repo** (trusted source):
   ```bash
   git clone https://github.com/your-repo/grok-cli.git grok-cli-clean
   cd grok-cli-clean
   ```

2. **Create baseline** (before adversaries modify):
   ```bash
   npm run watch:baseline
   ```

3. **Backup baseline** (external storage):
   ```bash
   cp .integrity-baseline.json ~/Dropbox/grok-cli-baseline-$(date +%Y%m%d).json
   ```

4. **Start watcher** (dual mode):
   ```bash
   npm run watch:integrity:dual
   ```

5. **Work normally**, watcher monitors in background

6. **Review alerts** periodically:
   ```bash
   npm run watch:alerts
   ```

7. **Investigate quarantined files**:
   ```bash
   ls -lt .integrity-quarantine/
   ```

8. **Restore from baseline** if needed:
   ```bash
   # Manual restore
   cp .integrity-baseline-backup.json .integrity-baseline.json
   
   # Or use integrity script
   cd /home/zack/GROK_CLI/Temporary_integrity_2
   conda run -n LLM_API_SESSION_SECURED python3 secure_integrity_manager.py verify
   ```

---

## 🔐 CRYPTOGRAPHIC INTEGRATION

### Merkle Root Verification

Combine the watcher with your integrity script:

```bash
# 1. Create baseline
npm run watch:baseline

# 2. Sign baseline with integrity script
cd /home/zack/GROK_CLI/Temporary_integrity_2
conda run -n LLM_API_SESSION_SECURED \
  python3 secure_integrity_manager.py commit \
  --notary-all \
  --manifest secure_integrity_manifest_full.json \
  -m "Baseline snapshot for watcher"

# 3. Extract Merkle root
MERKLE_ROOT=$(cat secure_integrity_manifest_full.json | jq -r '.merkle_tree.root')
echo "Merkle root: $MERKLE_ROOT"

# 4. Store Merkle root externally (air-gapped)
echo "$MERKLE_ROOT" > ~/USB_BACKUP/merkle_root_$(date +%Y%m%d).txt

# 5. Start watcher
cd /home/zack/GROK_CLI/grok-cli
npm run watch:integrity:dual
```

### Out-of-Band Verification

Periodically verify integrity externally:

```bash
# On a trusted machine (not compromised)
ssh trusted-server << 'EOF'
  cd /home/zack/GROK_CLI/grok-cli
  
  # Calculate current Merkle root
  npm run watch:baseline
  CURRENT_ROOT=$(cat .integrity-baseline.json | sha256sum | cut -d' ' -f1)
  
  # Compare with stored root
  EXPECTED_ROOT=$(cat ~/USB_BACKUP/merkle_root_20251130.txt)
  
  if [ "$CURRENT_ROOT" != "$EXPECTED_ROOT" ]; then
    echo "🚨 CRITICAL: Baseline has been compromised!"
    exit 1
  fi
EOF
```

---

## 📞 SUPPORT

If you suspect active sabotage:

1. **Stop working** immediately
2. **Quarantine** the system (disconnect network)
3. **Review alerts**: `npm run watch:alerts`
4. **Inspect quarantined files**: `.integrity-quarantine/`
5. **Restore from trusted backup**
6. **Report** to security team

---

**Generated:** 2025-11-30  
**Version:** 1.0.0  
**Author:** Claude Sonnet 4.5 (Security Analysis)  
**License:** BSD-3-Clause AND GPL-3.0

═══════════════════════════════════════════════════════════════

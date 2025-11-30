#!/bin/bash
################################################################################
# 🔍 SECURITY SYSTEM AUDIT SCRIPT
#
# Exécute tous les tests de cohérence du SECURITY_SYSTEM_AUDIT_TRACKLIST.md
#
# Usage: bash scripts/audit-security-system.sh
################################################################################

set -e

REPO_ROOT="/home/zack/GROK_CLI/grok-cli"
cd "$REPO_ROOT"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║     🔍 SECURITY SYSTEM AUDIT - AUTOMATED VERIFICATION        ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

PASS=0
FAIL=0
WARN=0

function test_pass() {
  echo "✅ PASS: $1"
  ((PASS++))
}

function test_fail() {
  echo "❌ FAIL: $1"
  ((FAIL++))
}

function test_warn() {
  echo "⚠️  WARN: $1"
  ((WARN++))
}

################################################################################
# 1. INVENTAIRE FICHIERS
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 1. INVENTAIRE FICHIERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1.1 Integrity Watcher
if [ -f "src/security/integrity-watcher.ts" ]; then
  test_pass "integrity-watcher.ts exists"
else
  test_fail "integrity-watcher.ts MISSING"
fi

if [ -f "src/security/watcher-cli.ts" ]; then
  test_pass "watcher-cli.ts exists"
else
  test_fail "watcher-cli.ts MISSING"
fi

# 1.2 LLM Guard
if [ -f "src/security/llm-guard.ts" ]; then
  test_pass "llm-guard.ts exists"
else
  test_fail "llm-guard.ts MISSING"
fi

if [ -f "src/security/llm-guard-cli.ts" ]; then
  test_pass "llm-guard-cli.ts exists"
else
  test_fail "llm-guard-cli.ts MISSING"
fi

# 1.3 Watcher Daemon
if [ -f "src/security/watcher-daemon.ts" ]; then
  test_pass "watcher-daemon.ts exists"
else
  test_fail "watcher-daemon.ts MISSING"
fi

if [ -f "src/security/watcher-daemon-cli.ts" ]; then
  test_pass "watcher-daemon-cli.ts exists"
else
  test_fail "watcher-daemon-cli.ts MISSING"
fi

# 1.4 Integration
if [ -f ".env.example" ]; then
  test_pass ".env.example exists"
else
  test_fail ".env.example MISSING"
fi

echo ""

################################################################################
# 2. COHÉRENCE INTERFACES
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 2. COHÉRENCE INTERFACES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 2.1 Alert Interface
ALERT_TYPES=$(grep -h "type Alert" src/security/integrity-watcher.ts 2>/dev/null || echo "")
if echo "$ALERT_TYPES" | grep -q "FILE_COPY"; then
  test_pass "Alert interface includes FILE_COPY"
else
  test_fail "Alert interface missing FILE_COPY"
fi

if echo "$ALERT_TYPES" | grep -q "FILE_REPLACED"; then
  test_pass "Alert interface includes FILE_REPLACED"
else
  test_warn "Alert interface missing FILE_REPLACED (optional)"
fi

# 2.2 Modes
MODES=$(grep -h "mode.*heuristic\|dual\|llm" src/security/*.ts | wc -l)
if [ "$MODES" -gt 5 ]; then
  test_pass "Modes (heuristic/dual/llm) found in multiple files"
else
  test_warn "Modes references low ($MODES), verify consistency"
fi

echo ""

################################################################################
# 3. PATTERNS MALVEILLANTS
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛡️  3. PATTERNS MALVEILLANTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 3.1 LLM Blocking Patterns
PATTERNS_FILE="src/security/integrity-watcher.ts"
if [ -f "$PATTERNS_FILE" ]; then
  # GPT-5
  if grep -q "gpt-5" "$PATTERNS_FILE"; then
    test_pass "GPT-5 blocking pattern exists"
  else
    test_fail "GPT-5 blocking pattern MISSING"
  fi

  # Grok
  if grep -q "grok" "$PATTERNS_FILE"; then
    test_pass "Grok blocking pattern exists"
  else
    test_fail "Grok blocking pattern MISSING"
  fi

  # Claude
  if grep -q "claude" "$PATTERNS_FILE"; then
    test_pass "Claude blocking pattern exists"
  else
    test_fail "Claude blocking pattern MISSING"
  fi

  # Count total patterns
  PATTERN_COUNT=$(grep -c "^  /" "$PATTERNS_FILE" 2>/dev/null || echo "0")
  if [ "$PATTERN_COUNT" -ge 30 ]; then
    test_pass "Pattern count: $PATTERN_COUNT (≥30)"
  elif [ "$PATTERN_COUNT" -ge 20 ]; then
    test_warn "Pattern count: $PATTERN_COUNT (20-29, expected 35+)"
  else
    test_fail "Pattern count: $PATTERN_COUNT (<20, expected 35+)"
  fi
fi

echo ""

################################################################################
# 4. DAEMON DETACHED PROCESSES
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 4. DAEMON DETACHED PROCESSES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DAEMON_FILE="src/security/watcher-daemon.ts"
if [ -f "$DAEMON_FILE" ]; then
  # Detached: true
  DETACHED_COUNT=$(grep -c "detached.*true" "$DAEMON_FILE" || echo "0")
  if [ "$DETACHED_COUNT" -ge 2 ]; then
    test_pass "detached: true found $DETACHED_COUNT times (≥2)"
  else
    test_fail "detached: true found $DETACHED_COUNT times (<2, expected 2)"
  fi

  # stdio: 'ignore'
  STDIO_COUNT=$(grep -c "stdio.*ignore" "$DAEMON_FILE" || echo "0")
  if [ "$STDIO_COUNT" -ge 2 ]; then
    test_pass "stdio: 'ignore' found $STDIO_COUNT times (≥2)"
  else
    test_fail "stdio: 'ignore' found $STDIO_COUNT times (<2, expected 2)"
  fi

  # unref()
  UNREF_COUNT=$(grep -c "unref()" "$DAEMON_FILE" || echo "0")
  if [ "$UNREF_COUNT" -ge 2 ]; then
    test_pass "unref() found $UNREF_COUNT times (≥2)"
  else
    test_fail "unref() found $UNREF_COUNT times (<2, expected 2)"
  fi
fi

echo ""

################################################################################
# 5. COMMENTAIRES SUSPECTS
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 5. COMMENTAIRES SUSPECTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Chercher commentaires suspects
MALICIOUS=$(grep -rn "MALICIOUS\|INJECTION\|BACKDOOR\|EXPLOIT\|HACK" src/ 2>/dev/null || echo "")
if [ -z "$MALICIOUS" ]; then
  test_pass "No suspicious comments (MALICIOUS/INJECTION/etc.)"
else
  test_fail "Suspicious comments found:"
  echo "$MALICIOUS" | head -5
fi

# Chercher eval()
EVAL_COUNT=$(grep -rn "eval(" src/ 2>/dev/null | wc -l)
if [ "$EVAL_COUNT" -eq 0 ]; then
  test_pass "No eval() found"
else
  test_warn "eval() found $EVAL_COUNT times (verify if legitimate)"
fi

# Chercher exec() (hors child_process)
EXEC_SUSPECT=$(grep -rn "exec(" src/ 2>/dev/null | grep -v "child_process" | wc -l)
if [ "$EXEC_SUSPECT" -eq 0 ]; then
  test_pass "No suspicious exec() (all in child_process)"
else
  test_warn "exec() outside child_process: $EXEC_SUSPECT (verify)"
fi

echo ""

################################################################################
# 6. HASH INTÉGRITÉ (Baseline)
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 6. HASH INTÉGRITÉ (Baseline)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

HASH_FILE=".audit-hashes.txt"

# Calculer hashes
echo "Calculating SHA-256 hashes..."
sha256sum src/security/integrity-watcher.ts > "$HASH_FILE.new" 2>/dev/null || true
sha256sum src/security/llm-guard.ts >> "$HASH_FILE.new" 2>/dev/null || true
sha256sum src/security/watcher-daemon.ts >> "$HASH_FILE.new" 2>/dev/null || true
sha256sum src/index.ts >> "$HASH_FILE.new" 2>/dev/null || true

if [ -f "$HASH_FILE" ]; then
  # Comparer avec baseline
  if diff -q "$HASH_FILE" "$HASH_FILE.new" >/dev/null 2>&1; then
    test_pass "Hashes unchanged (no tampering)"
  else
    test_warn "Hashes changed (files modified since last audit)"
    echo "   To update baseline: mv $HASH_FILE.new $HASH_FILE"
  fi
else
  # Créer baseline
  mv "$HASH_FILE.new" "$HASH_FILE"
  test_pass "Baseline hashes created: $HASH_FILE"
fi

# Afficher hashes
echo ""
echo "Current hashes:"
cat "$HASH_FILE.new" 2>/dev/null || cat "$HASH_FILE"
rm -f "$HASH_FILE.new"

echo ""

################################################################################
# 7. BUILD VERIFICATION
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏗️  7. BUILD VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier dist/
if [ -f "dist/security/integrity-watcher.js" ]; then
  test_pass "dist/security/integrity-watcher.js exists"
else
  test_warn "dist/security/integrity-watcher.js MISSING (run: npm run build)"
fi

if [ -f "dist/security/llm-guard.js" ]; then
  test_pass "dist/security/llm-guard.js exists"
else
  test_warn "dist/security/llm-guard.js MISSING (run: npm run build)"
fi

if [ -f "dist/security/watcher-daemon.js" ]; then
  test_pass "dist/security/watcher-daemon.js exists"
else
  test_warn "dist/security/watcher-daemon.js MISSING (run: npm run build)"
fi

echo ""

################################################################################
# 8. NPM SCRIPTS
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📜 8. NPM SCRIPTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier package.json scripts
if grep -q "watcher:start" package.json; then
  test_pass "npm script: watcher:start"
else
  test_fail "npm script: watcher:start MISSING"
fi

if grep -q "watcher:stop" package.json; then
  test_pass "npm script: watcher:stop"
else
  test_fail "npm script: watcher:stop MISSING"
fi

if grep -q "watcher:status" package.json; then
  test_pass "npm script: watcher:status"
else
  test_fail "npm script: watcher:status MISSING"
fi

if grep -q "guard:start" package.json; then
  test_pass "npm script: guard:start"
else
  test_fail "npm script: guard:start MISSING"
fi

echo ""

################################################################################
# 9. DOCUMENTATION
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 9. DOCUMENTATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DOCS=(
  "WATCHER_DAEMON_GUIDE.md"
  "SECURITY_SYSTEM_AUDIT_TRACKLIST.md"
  "PATENT_ANALYSIS_2025.md"
  "WATCHER_DEBUGGING_GUIDE.md"
  "LLM_GUARD_README.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$doc" ]; then
    test_pass "Documentation: $doc"
  else
    test_warn "Documentation: $doc MISSING"
  fi
done

echo ""

################################################################################
# 10. FILE COPY DETECTION
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 10. FILE COPY DETECTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier hashToFiles Map
if grep -q "hashToFiles.*Map" src/security/integrity-watcher.ts; then
  test_pass "hashToFiles Map exists (file copy detection)"
else
  test_fail "hashToFiles Map MISSING"
fi

# Vérifier FILE_COPY alert type
if grep -q "FILE_COPY" src/security/integrity-watcher.ts; then
  test_pass "FILE_COPY alert type exists"
else
  test_fail "FILE_COPY alert type MISSING"
fi

# Vérifier originalFile property
if grep -q "originalFile" src/security/integrity-watcher.ts; then
  test_pass "originalFile property exists"
else
  test_fail "originalFile property MISSING"
fi

echo ""

################################################################################
# RÉSULTAT FINAL
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RÉSULTAT FINAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL=$((PASS + FAIL + WARN))
SCORE=$(awk "BEGIN {printf \"%.1f\", ($PASS / $TOTAL) * 10}")

echo "Total Tests:   $TOTAL"
echo "✅ Passed:     $PASS"
echo "❌ Failed:     $FAIL"
echo "⚠️  Warnings:  $WARN"
echo ""
echo "Score:         $SCORE/10"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "🎉 ALL CRITICAL TESTS PASSED!"
  echo "   System is COHERENT and PRODUCTION READY ✅"
  exit 0
elif [ "$FAIL" -le 2 ]; then
  echo "⚠️  MINOR ISSUES DETECTED"
  echo "   Review failed tests above"
  exit 1
else
  echo "❌ MAJOR ISSUES DETECTED"
  echo "   $FAIL critical tests failed"
  exit 1
fi

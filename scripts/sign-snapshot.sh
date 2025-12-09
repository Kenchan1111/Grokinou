#!/bin/bash
# Script de signature d'empreintes cryptographiques
# Génère un snapshot signé des fichiers pour détection de modifications

set -e

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SNAPSHOT_DIR="$HOME/.grok/snapshots"
SNAPSHOT_FILE="$SNAPSHOT_DIR/snapshot_${TIMESTAMP//[:-]/}.json"
LOG_FILE="$SNAPSHOT_DIR/signature_log.txt"

# Créer répertoire si inexistant
mkdir -p "$SNAPSHOT_DIR"

echo "🔐 Génération d'empreinte cryptographique des fichiers..."
echo "Timestamp: $TIMESTAMP"
echo ""

# Fonction pour calculer hash d'un fichier
hash_file() {
    local file="$1"
    if [ -f "$file" ]; then
        sha256sum "$file" | awk '{print $1}'
    else
        echo "DELETED"
    fi
}

# Liste des fichiers critiques à surveiller
CRITICAL_FILES=(
    "src/agent/grok-agent.ts"
    "src/grok/client.ts"
    "src/index.ts"
    "src/tools/bash-tool.ts"
    "src/tools/text-editor-tool.ts"
    "package.json"
    "tsconfig.json"
    "MALICIOUS_MODIFICATION_REPORT.md"
    "README.md"
)

# JSON output
echo "{" > "$SNAPSHOT_FILE"
echo "  \"timestamp\": \"$TIMESTAMP\"," >> "$SNAPSHOT_FILE"
echo "  \"files\": {" >> "$SNAPSHOT_FILE"

declare -a hashes=()
first=true

echo "📋 Calcul des empreintes..."
for file in "${CRITICAL_FILES[@]}"; do
    if [ "$first" = false ]; then
        echo "," >> "$SNAPSHOT_FILE"
    fi
    first=false

    hash=$(hash_file "$file")
    hashes+=("$hash")

    echo -n "  \"$file\": \"$hash\"" >> "$SNAPSHOT_FILE"
    echo "  ✓ $file: ${hash:0:16}..."
done

echo "" >> "$SNAPSHOT_FILE"
echo "  }," >> "$SNAPSHOT_FILE"

# Calcul du Merkle root (hash des hashes)
echo ""
echo "🌳 Calcul du Merkle root..."
merkle_input=$(printf '%s\n' "${hashes[@]}" | sort)
merkle_root=$(echo "$merkle_input" | sha256sum | awk '{print $1}')
echo "  \"merkle_root\": \"$merkle_root\"," >> "$SNAPSHOT_FILE"
echo "Merkle root: $merkle_root"

# Signature du Merkle root avec timestamp
echo ""
echo "✍️  Génération de la signature..."
signature_data="SNAPSHOT|$TIMESTAMP|$merkle_root"
signature=$(echo -n "$signature_data" | sha256sum | awk '{print $1}')
echo "  \"signature\": \"$signature\"," >> "$SNAPSHOT_FILE"
echo "Signature: $signature"

# Commit Git actuel (si dans un repo)
if git rev-parse --git-dir > /dev/null 2>&1; then
    git_commit=$(git rev-parse HEAD 2>/dev/null || echo "NONE")
    git_branch=$(git branch --show-current 2>/dev/null || echo "NONE")
    echo "  \"git_commit\": \"$git_commit\"," >> "$SNAPSHOT_FILE"
    echo "  \"git_branch\": \"$git_branch\"" >> "$SNAPSHOT_FILE"
    echo "Git commit: ${git_commit:0:8}"
else
    echo "  \"git_commit\": \"NONE\"," >> "$SNAPSHOT_FILE"
    echo "  \"git_branch\": \"NONE\"" >> "$SNAPSHOT_FILE"
fi

echo "}" >> "$SNAPSHOT_FILE"

# Log hors bande (append-only)
echo "" >> "$LOG_FILE"
echo "═══════════════════════════════════════════════════════════" >> "$LOG_FILE"
echo "SNAPSHOT SIGNATURE - $TIMESTAMP" >> "$LOG_FILE"
echo "═══════════════════════════════════════════════════════════" >> "$LOG_FILE"
echo "Merkle Root: $merkle_root" >> "$LOG_FILE"
echo "Signature:   $signature" >> "$LOG_FILE"
echo "Git Commit:  ${git_commit:-NONE}" >> "$LOG_FILE"
echo "Snapshot:    $SNAPSHOT_FILE" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "🔐 VERIFICATION COMMAND:" >> "$LOG_FILE"
echo "echo -n 'SNAPSHOT|$TIMESTAMP|$merkle_root' | sha256sum" >> "$LOG_FILE"
echo "Expected: $signature" >> "$LOG_FILE"
echo "═══════════════════════════════════════════════════════════" >> "$LOG_FILE"

echo ""
echo "✅ Snapshot créé: $SNAPSHOT_FILE"
echo "📝 Log hors bande: $LOG_FILE"
echo ""
echo "🔍 Pour vérifier ultérieurement:"
echo "   diff <(cat $SNAPSHOT_FILE | jq -S .) <(./scripts/sign-snapshot.sh | tail -1 | xargs cat | jq -S .)"
echo ""
echo "🔐 Signature hors bande (à copier dans un système externe):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TIMESTAMP: $TIMESTAMP"
echo "MERKLE:    $merkle_root"
echo "SIGNATURE: $signature"
echo "GIT:       ${git_commit:-NONE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Retourner le chemin du snapshot pour chaînage
echo "$SNAPSHOT_FILE"

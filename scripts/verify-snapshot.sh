#!/bin/bash
# Script de vérification d'intégrité
# Compare l'état actuel avec un snapshot précédent

set -e

SNAPSHOT_DIR="$HOME/.grok/snapshots"
REFERENCE_SNAPSHOT="$1"

if [ -z "$REFERENCE_SNAPSHOT" ]; then
    # Utiliser le dernier snapshot
    REFERENCE_SNAPSHOT=$(ls -t "$SNAPSHOT_DIR"/snapshot_*.json 2>/dev/null | head -1)
    if [ -z "$REFERENCE_SNAPSHOT" ]; then
        echo "❌ Aucun snapshot de référence trouvé"
        echo "Exécutez d'abord: ./scripts/sign-snapshot.sh"
        exit 1
    fi
    echo "📂 Utilisation du snapshot le plus récent: $(basename $REFERENCE_SNAPSHOT)"
else
    if [ ! -f "$REFERENCE_SNAPSHOT" ]; then
        echo "❌ Snapshot introuvable: $REFERENCE_SNAPSHOT"
        exit 1
    fi
fi

echo ""
echo "🔍 Vérification de l'intégrité des fichiers..."
echo ""

# Extraire les données du snapshot de référence
ref_timestamp=$(jq -r '.timestamp' "$REFERENCE_SNAPSHOT")
ref_merkle=$(jq -r '.merkle_root' "$REFERENCE_SNAPSHOT")
ref_signature=$(jq -r '.signature' "$REFERENCE_SNAPSHOT")
ref_git=$(jq -r '.git_commit' "$REFERENCE_SNAPSHOT")

echo "📅 Snapshot de référence:"
echo "   Timestamp: $ref_timestamp"
echo "   Merkle:    $ref_merkle"
echo "   Git:       ${ref_git:0:8}"
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

# Vérifier chaque fichier
modified_count=0
deleted_count=0
intact_count=0

echo "📋 Vérification des fichiers..."
jq -r '.files | keys[]' "$REFERENCE_SNAPSHOT" | while read file; do
    ref_hash=$(jq -r ".files[\"$file\"]" "$REFERENCE_SNAPSHOT")
    current_hash=$(hash_file "$file")

    if [ "$current_hash" = "DELETED" ] && [ "$ref_hash" != "DELETED" ]; then
        echo "  🗑️  SUPPRIMÉ: $file"
        deleted_count=$((deleted_count + 1))
    elif [ "$current_hash" != "$ref_hash" ]; then
        echo "  ⚠️  MODIFIÉ:  $file"
        echo "      Ref:     ${ref_hash:0:16}..."
        echo "      Actuel:  ${current_hash:0:16}..."
        modified_count=$((modified_count + 1))
    else
        echo "  ✅ INTACT:   $file"
        intact_count=$((intact_count + 1))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Résumé:"

# Recompter (car subshell)
modified_count=0
deleted_count=0
intact_count=0

jq -r '.files | keys[]' "$REFERENCE_SNAPSHOT" | while read file; do
    ref_hash=$(jq -r ".files[\"$file\"]" "$REFERENCE_SNAPSHOT")
    current_hash=$(hash_file "$file")

    if [ "$current_hash" = "DELETED" ] && [ "$ref_hash" != "DELETED" ]; then
        deleted_count=$((deleted_count + 1))
    elif [ "$current_hash" != "$ref_hash" ]; then
        modified_count=$((modified_count + 1))
    else
        intact_count=$((intact_count + 1))
    fi
done

total=$(jq -r '.files | length' "$REFERENCE_SNAPSHOT")
echo "   Total:     $total fichiers"
echo "   ✅ Intacts:   $intact_count"
echo "   ⚠️  Modifiés:  $modified_count"
echo "   🗑️  Supprimés: $deleted_count"

# Vérification de signature
echo ""
echo "🔐 Vérification de signature..."
signature_data="SNAPSHOT|$ref_timestamp|$ref_merkle"
expected_sig=$(echo -n "$signature_data" | sha256sum | awk '{print $1}')

if [ "$expected_sig" = "$ref_signature" ]; then
    echo "   ✅ Signature valide"
else
    echo "   ❌ Signature INVALIDE!"
    echo "   Attendue: $expected_sig"
    echo "   Snapshot: $ref_signature"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Status de sortie
if [ "$modified_count" -gt 0 ] || [ "$deleted_count" -gt 0 ]; then
    echo ""
    echo "⚠️  DES MODIFICATIONS ONT ÉTÉ DÉTECTÉES!"
    echo ""
    echo "Pour créer un nouveau snapshot signé:"
    echo "   ./scripts/sign-snapshot.sh"
    exit 1
else
    echo ""
    echo "✅ Tous les fichiers sont intacts"
    exit 0
fi

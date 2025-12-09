# Système de Snapshots Cryptographiques

Système de détection de modifications malveillantes par empreintes cryptographiques signées.

## 🎯 Objectif

Détecter toute modification non autorisée des fichiers source en créant des snapshots signés cryptographiquement avec Merkle root.

## 📋 Fichiers Surveillés

- `src/agent/grok-agent.ts` - Agent principal
- `src/grok/client.ts` - Client API
- `src/index.ts` - Point d'entrée
- `src/tools/bash-tool.ts` - Outil bash
- `src/tools/text-editor-tool.ts` - Éditeur
- `package.json` - Dépendances
- `tsconfig.json` - Configuration TypeScript
- `MALICIOUS_MODIFICATION_REPORT.md` - Rapport forensique
- `README.md` - Documentation

## 🔐 Utilisation

### 1. Créer un Snapshot Signé

```bash
./scripts/sign-snapshot.sh
```

**Sortie:**
```
🔐 Génération d'empreinte cryptographique des fichiers...
Timestamp: 2025-12-09T02:04:13Z

📋 Calcul des empreintes...
  ✓ src/agent/grok-agent.ts: 3fc3c277ace059b8...
  ✓ src/grok/client.ts: fc366a56070dd3f5...
  ...

🌳 Calcul du Merkle root...
Merkle root: 07431ace4bf139a4c2c32d9214af1fcd10bdcdb29278a5569e174938b36e2b4d

✍️  Génération de la signature...
Signature: 65f689a9fa201f1bd8914d7e06b9c5a4c55c4bbf1715dd8601bf42b02b4eb6bf

🔐 Signature hors bande (à copier dans un système externe):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIMESTAMP: 2025-12-09T02:04:13Z
MERKLE:    07431ace4bf139a4c2c32d9214af1fcd10bdcdb29278a5569e174938b36e2b4d
SIGNATURE: 65f689a9fa201f1bd8914d7e06b9c5a4c55c4bbf1715dd8601bf42b02b4eb6bf
GIT:       598f06d3c4ed43957941f0ea12bc33835fbc8275
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. Vérifier l'Intégrité

```bash
./scripts/verify-snapshot.sh
```

**Sortie si intact:**
```
🔍 Vérification de l'intégrité des fichiers...

📅 Snapshot de référence:
   Timestamp: 2025-12-09T02:04:13Z
   Merkle:    07431ace...
   Git:       598f06d3

📋 Vérification des fichiers...
  ✅ INTACT:   src/agent/grok-agent.ts
  ✅ INTACT:   src/grok/client.ts
  ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Résumé:
   Total:     9 fichiers
   ✅ Intacts:   9
   ⚠️  Modifiés:  0
   🗑️  Supprimés: 0

🔐 Vérification de signature...
   ✅ Signature valide
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Tous les fichiers sont intacts
```

**Sortie si modifié:**
```
📋 Vérification des fichiers...
  ✅ INTACT:   src/agent/grok-agent.ts
  ⚠️  MODIFIÉ:  src/grok/client.ts
      Ref:     fc366a56070dd3f5...
      Actuel:  1234567890abcdef...
  ...

⚠️  DES MODIFICATIONS ONT ÉTÉ DÉTECTÉES!
```

### 3. Vérifier avec un Snapshot Spécifique

```bash
./scripts/verify-snapshot.sh ~/.grok/snapshots/snapshot_20251209T020413Z.json
```

## 🔍 Fichiers Générés

### Snapshots
```
~/.grok/snapshots/snapshot_YYYYMMDDTHHMMSSZ.json
```

Format JSON:
```json
{
  "timestamp": "2025-12-09T02:04:13Z",
  "files": {
    "src/agent/grok-agent.ts": "3fc3c277ace059b8...",
    "src/grok/client.ts": "fc366a56070dd3f5...",
    ...
  },
  "merkle_root": "07431ace4bf139a4c2c32d9214af1fcd10bdcdb29278a5569e174938b36e2b4d",
  "signature": "65f689a9fa201f1bd8914d7e06b9c5a4c55c4bbf1715dd8601bf42b02b4eb6bf",
  "git_commit": "598f06d3c4ed43957941f0ea12bc33835fbc8275",
  "git_branch": "main"
}
```

### Log Hors Bande
```
~/.grok/snapshots/signature_log.txt
```

Fichier append-only contenant l'historique de toutes les signatures.

## 🛡️ Sécurité

### Merkle Root

Le Merkle root est calculé en :
1. Calculant SHA-256 de chaque fichier
2. Triant les hashes
3. Calculant SHA-256 du résultat

Tout changement dans n'importe quel fichier change le Merkle root.

### Signature

La signature est calculée :
```
SHA-256("SNAPSHOT|<timestamp>|<merkle_root>")
```

### Vérification Manuelle

```bash
# Vérifier la signature
echo -n "SNAPSHOT|2025-12-09T02:04:13Z|07431ace4bf139a4c2c32d9214af1fcd10bdcdb29278a5569e174938b36e2b4d" | sha256sum
# Doit donner: 65f689a9fa201f1bd8914d7e06b9c5a4c55c4bbf1715dd8601bf42b02b4eb6bf
```

## 📝 Log Hors Bande

**IMPORTANT**: Copiez la signature dans un système externe sécurisé !

```
TIMESTAMP: 2025-12-09T02:04:13Z
MERKLE:    07431ace4bf139a4c2c32d9214af1fcd10bdcdb29278a5569e174938b36e2b4d
SIGNATURE: 65f689a9fa201f1bd8914d7e06b9c5a4c55c4bbf1715dd8601bf42b02b4eb6bf
GIT:       598f06d3c4ed43957941f0ea12bc33835fbc8275
```

Conservez ces informations dans :
- Un fichier papier
- Un système de stockage externe
- Un email sécurisé
- Un gestionnaire de mots de passe

## 🚨 En Cas de Modification Détectée

1. **Ne pas paniquer** - vérifier d'abord si c'est une modification légitime
2. **Comparer avec Git** - `git diff`
3. **Vérifier l'historique** - `git log`
4. **Créer nouveau snapshot** si modification légitime
5. **Investiguer** si modification suspecte

## 🔄 Workflow Recommandé

### Avant chaque session
```bash
./scripts/verify-snapshot.sh
```

### Après modifications légitimes
```bash
git commit -m "..."
./scripts/sign-snapshot.sh
# Copier la signature dans système externe
```

### Vérification quotidienne (cron)
```bash
# Ajouter à crontab
0 */6 * * * cd /home/zack/GROK_CLI/grok-cli && ./scripts/verify-snapshot.sh >> /tmp/snapshot-verify.log 2>&1
```

## 🎯 Intégration avec Système d'Intégrité Existant

Ces snapshots complètent le système d'intégrité existant (`scripts/integrity/`) en fournissant :
- **Détection rapide** - vérification en < 1 seconde
- **Log hors bande** - preuve externe
- **Merkle root** - empreinte unique de l'état
- **Historique** - évolution dans le temps

## 📊 Analyse Forensique

En cas d'incident, comparer les snapshots :
```bash
diff <(cat snapshot1.json | jq -S .) <(cat snapshot2.json | jq -S .)
```

Tracer l'évolution du Merkle root :
```bash
grep "Merkle Root:" ~/.grok/snapshots/signature_log.txt
```

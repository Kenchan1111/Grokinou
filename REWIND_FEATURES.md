# 🕰️ REWIND - Guide Complet des Features

**Date:** 2025-11-13  
**Version:** 2.0.0 (Phase 1 + Bonus Features)

---

## 📋 Vue d'Ensemble

### **`/rewind` vs `/new-session`**

| Feature | `/rewind` (Timeline DB) | `/new-session` (Conversations DB) |
|---------|-------------------------|-----------------------------------|
| **Source de données** | `timeline.db` (Event Sourcing) | `conversations.db` (Read Model) |
| **Méthode** | Replay d'événements chronologiques | Copie de messages |
| **Portée** | TOUT (files + git + conversations + tools) | Conversations uniquement |
| **Timestamp précis** | ✅ Précision microseconde | ❌ Non |
| **Reconstruction fichiers** | ✅ Depuis Merkle DAG | ❌ Manuel (répertoire vide) |
| **Reconstruction Git** | ✅ 3 modes (none/metadata/full) | ⏳ Bientôt (--clone-git) |
| **Use Case Principal** | Time Machine, Recovery, Audit | Brancher conversations, Document editing |

---

## 🚀 Features Implémentées

### **1. `--git-mode <none|metadata|full>`** ✅

#### **Mode `none` - Pas de Git**
```bash
/rewind "2025-11-28T10:00:00Z" --git-mode none

# Résultat:
~/output/
├── files/           # Fichiers restaurés
│   └── src/...
├── session_state.json
└── file_manifest.json
# ❌ Pas de git_state.json
# ❌ Pas de .git/
```

**Use Case:** Récupérer uniquement les fichiers et conversations sans Git.

---

#### **Mode `metadata` - Metadata uniquement (DEFAULT)**
```bash
/rewind "2025-11-28T10:00:00Z"
# ou
/rewind "2025-11-28T10:00:00Z" --git-mode metadata

# Résultat:
~/output/
├── files/           # Fichiers restaurés
│   └── src/...
├── session_state.json
├── git_state.json   # ← Metadata Git (commit hash, branch)
└── file_manifest.json
# ❌ Pas de .git/
```

**Contenu `git_state.json`:**
```json
{
  "commitHash": "abc123def456...",
  "branch": "main",
  "isClean": true
}
```

**Use Case:** Rapide, léger, vous savez quel commit était actif sans le repo complet.

---

#### **Mode `full` - Repo Git Complet** 🔥
```bash
/rewind "2025-11-28T10:00:00Z" --git-mode full --output ~/recovered

# Résultat:
~/recovered/
├── .git/            # ← Vrai repo Git complet !
│   ├── objects/
│   ├── refs/
│   └── HEAD → abc123...
├── src/
│   └── index.ts     # Fichiers à la racine (checkout au bon commit)
├── package.json
├── git_state.json   # Metadata pour référence
├── session_state.json
└── file_manifest.json
```

**Ce que vous pouvez faire:**
```bash
cd ~/recovered

git log                       # ✅ Historique complet
git show                      # ✅ Voir le commit actuel
git diff main                 # ✅ Comparer avec main
git checkout -b bugfix        # ✅ Créer une branche
git commit -m "Fix"           # ✅ Continuer à travailler
git push                      # ✅ Pousser sur remote
```

**Use Case:** Récupération complète, développement dans l'état rewindé, création de branches de bugfix.

---

### **2. `--create-session`** ✅

**Pont entre `/rewind` et `/new-session` !**

```bash
/rewind "2025-11-28T10:00:00Z" --git-mode full --create-session --output ~/recovered

# Résultat:
✅ Rewind Complete!
  ...
  Session Created: #42 (Rewind-2025-11-28T10:00:00.000Z)

💡 Use /switch-session 42 to activate the rewinded session
```

**Ce qui se passe:**
1. Rewind complet vers le timestamp
2. Création automatique d'une session Grokinou dans `~/recovered`
3. Import des conversations (si `includeConversations=true`)
4. Session prête à utiliser

**Workflow complet:**
```bash
# 1. Rewind + session
/rewind "2025-11-28T10:00:00Z" --git-mode full --create-session

# 2. Switch vers la session rewindée
/switch-session 42

# 3. Vous travaillez maintenant dans l'état d'hier !
pwd  # → ~/recovered
git log  # → Historique jusqu'à hier
# Continuez à coder normalement...
```

---

### **3. `--auto-checkout`** ✅ NEW!

**Change automatiquement votre répertoire de travail vers l'état rewindé.**

```bash
/rewind "2025-11-28T10:00:00Z" --git-mode full --create-session --auto-checkout

# Résultat:
✅ Rewind Complete!
  ...
  📂 Working Directory Changed:
     From: /home/zack/GROK_CLI/grok-cli
     To:   /home/zack/.rewind_2025-11-28T10-00-00-000Z

💡 You are now in the rewinded directory!

# Immédiatement après:
pwd  # → /home/zack/.rewind_2025-11-28T10-00-00-000Z
ls   # → Voir les fichiers rewindés
```

**Use Case:** Workflow instantané - rewind et travail immédiat dans l'état rewindé.

**⚠️ Important:** 
- Change le `process.cwd()` global
- Tous les chemins relatifs pointent vers le nouveau répertoire
- Utilisez avec `--create-session` pour une expérience complète

---

### **4. `--compare-with <dir>`** ✅ NEW!

**Compare l'état rewindé avec un autre répertoire.**

```bash
/rewind "2025-11-28T10:00:00Z" --compare-with ~/current-project

# Résultat:
✅ Rewind Complete!
  ...

📊 Comparison with /home/zack/current-project:
  Total Files: 42
  🆕 Added: 5
  ❌ Deleted: 2
  ✏️  Modified: 12
  ✅ Unchanged: 23

  Key Changes:
    ✏️  src/index.ts
    ✏️  package.json
    🆕 src/new-feature.ts
    ❌ src/old-file.ts
    ✏️  README.md
    ... and 7 more
```

**Use Cases:**
- **Debugging:** "Qu'est-ce qui a changé entre hier et aujourd'hui?"
- **Audit:** "Quels fichiers ont été modifiés depuis ce matin?"
- **Recovery:** "Quels fichiers dois-je restaurer?"

**Comparaisons courantes:**
```bash
# Comparer avec l'état actuel
/rewind "2025-11-28T10:00:00Z" --compare-with .

# Comparer deux rewinds
/rewind "2025-11-28T10:00:00Z" --output ~/rewind-10h
/rewind "2025-11-28T14:00:00Z" --output ~/rewind-14h --compare-with ~/rewind-10h

# Comparer avec une branche Git
/rewind "2025-11-28T10:00:00Z" --compare-with ~/my-project/feature-branch
```

---

### **5. `/rewind-history`** ✅ NEW!

**Dashboard pour visualiser tous les rewinds effectués.**

```bash
/rewind-history

# Résultat:
🕰️  Rewind History (5 operations)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ Completed
   Target Time: 28/11/2025 10:00:00
   Performed: 28/11/2025 15:30:22
   Duration: 2340ms
   Session Created: Yes
   Auto Checkout: Yes

2. ✅ Completed
   Target Time: 27/11/2025 18:00:00
   Performed: 28/11/2025 14:20:10
   Duration: 1820ms

3. ❌ Failed
   Target Time: 26/11/2025 12:00:00
   Performed: 28/11/2025 13:15:45
   Error: Snapshot not found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Use /rewind "<timestamp>" to perform a new time-travel
💡 Use /timeline --category REWIND for detailed event log
```

**Informations affichées:**
- ✅ Status (Completed / Failed / In Progress)
- ⏰ Timestamp cible du rewind
- 📅 Date d'exécution du rewind
- ⚡ Durée de l'opération
- 🔧 Options utilisées (session créée, auto checkout, etc.)
- ❌ Erreurs si échec

---

## 🎯 Cas d'Usage Complets

### **Use Case 1: Recovery après Bug**

```bash
# 1. Identifier le moment où ça marchait
/timeline --category FILE --limit 20
# Voir que les dernières modifs étaient à 10:15

# 2. Rewind complet avec Git + Session + Auto-checkout
/rewind "2025-11-28T10:15:00Z" --git-mode full --create-session --auto-checkout

# 3. Vous êtes maintenant dans l'état d'avant le bug
pwd  # → .rewind_2025-11-28T10-15-00-000Z
git log
git diff main  # Voir ce qui a cassé

# 4. Fix le bug dans l'état rewindé
# ... éditer les fichiers ...

# 5. Créer une branche de fix
git checkout -b hotfix/restore-working-state
git add .
git commit -m "Restore working state from 10:15"
git push -u origin hotfix/restore-working-state
```

---

### **Use Case 2: Audit - Comparer États**

```bash
# Comparer l'état actuel avec celui de ce matin
/rewind "2025-11-28T09:00:00Z" --output ~/morning-state --compare-with .

# Résultat: Rapport détaillé de tous les changements
📊 Comparison:
  🆕 Added: 8 files
  ❌ Deleted: 3 files
  ✏️  Modified: 15 files
  
  Key Changes:
    ✏️  src/critical-file.ts
    🆕 src/new-feature.ts
    ...
```

---

### **Use Case 3: Workflow Quotidien**

```bash
# Morning: Créer un checkpoint avant de travailler
/snapshots
# Note: Snapshot automatique à 09:00

# Afternoon: Beaucoup de changements, incertain du résultat
# ...

# Evening: Comparer avec le matin
/rewind "2025-11-28T09:00:00Z" --compare-with . --output ~/morning-backup

# Si besoin de revenir en arrière:
/rewind "2025-11-28T09:00:00Z" --git-mode full --auto-checkout --create-session
/switch-session <new-id>
# Continuer depuis le matin
```

---

## 📊 Tableau Comparatif Final

| Commande | Source | Reconstruction | Git | Session | Auto CD | Compare |
|----------|--------|----------------|-----|---------|---------|---------|
| `/new-session` | conversations.db | ❌ Copie simple | ⏳ Bientôt | ✅ Oui | ❌ Non | ❌ Non |
| `/new-session --clone-git` | conversations.db | ⏳ Bientôt | ⏳ Clone | ✅ Oui | ❌ Non | ❌ Non |
| `/rewind --git-mode none` | timeline.db | ✅ Event Sourcing | ❌ Non | ❌ Non | ❌ Non | ✅ Oui |
| `/rewind --git-mode metadata` | timeline.db | ✅ Event Sourcing | ✅ JSON | ❌ Non | ❌ Non | ✅ Oui |
| `/rewind --git-mode full` | timeline.db | ✅ Event Sourcing | ✅ Repo complet | ❌ Non | ❌ Non | ✅ Oui |
| `/rewind --git-mode full --create-session` | timeline.db | ✅ Event Sourcing | ✅ Repo complet | ✅ Oui | ❌ Non | ✅ Oui |
| `/rewind --git-mode full --create-session --auto-checkout` | timeline.db | ✅ Event Sourcing | ✅ Repo complet | ✅ Oui | ✅ Oui | ✅ Oui |

---

## 🎯 Commandes Disponibles

### **`/rewind <timestamp> [options]`**

```
Options:
  <timestamp>             Target time (ISO: "2025-11-28T12:00:00Z")
  --output <dir>          Custom output directory (default: .rewind_*)
  --git-mode <mode>       Git materialization:
      none                No git
      metadata            git_state.json only (default, fast)
      full                Complete .git repo (slow, powerful)
  --create-session        Create grokinou session in rewinded dir
  --auto-checkout         cd to rewinded directory after rewind
  --compare-with <dir>    Compare rewinded state with another directory
  --no-files              Don't include file contents
  --no-conversations      Don't include conversation history
  --no-git                Alias for --git-mode none

Examples:
  # Basic rewind
  /rewind "2025-11-28T10:00:00Z"

  # Full recovery workflow
  /rewind "2025-11-28T10:00:00Z" --git-mode full --create-session --auto-checkout

  # Comparison debugging
  /rewind "2025-11-28T10:00:00Z" --compare-with ~/current-project

  # Lightweight recovery (no git)
  /rewind "2025-11-28T10:00:00Z" --git-mode none --output ~/files-only
```

---

### **`/rewind-history`**

```
Show all rewind operations performed

Output:
  • List of all rewinds (completed, failed, in progress)
  • Target timestamps
  • Execution dates
  • Durations
  • Options used (session created, auto checkout, etc.)
  • Errors (if any)

Example:
  /rewind-history
```

---

### **`/snapshots`**

```
List available rewind points

Output:
  • All snapshots (optimized rewind points)
  • Recent events (precise rewind)
  • Timestamps for easy copy-paste

Example:
  /snapshots
```

---

### **`/timeline`**

```
Query timeline events

Options:
  --category REWIND       Show all rewind operations
  --start <time>          Filter by time range
  --limit <n>             Max results

Example:
  /timeline --category REWIND --limit 10
```

---

## 🔧 Architecture Technique

### **Event Sourcing Process**

```
1. Snapshot Lookup
   ↓
   Find nearest snapshot BEFORE target timestamp
   
2. Event Query
   ↓
   Query timeline.db for events: snapshot.timestamp → target.timestamp
   
3. Replay
   ↓
   For each event (chronological order):
     - FILE_CREATED/MODIFIED → Restore from Merkle DAG
     - GIT_COMMIT → Update git state
     - LLM_MESSAGE → Rebuild conversations
     - TOOL_CALL → Record tool executions
   
4. Materialization
   ↓
   Write to filesystem:
     - files/ (actual file contents)
     - .git/ (if --git-mode full)
     - *.json (metadata)
   
5. Post-Processing (optional)
   ↓
   - Create session (if --create-session)
   - Change directory (if --auto-checkout)
   - Compare directories (if --compare-with)
```

---

### **Git Mode `full` - Implementation**

```typescript
// Method: Clone + Checkout
1. Clone current repo to temp directory
2. Copy .git/ to output directory
3. Remove temp directory
4. Checkout specific commit: git checkout <hash>
5. Try to checkout branch (if specified)

Result: Complete working Git repository at exact commit
```

**Avantages:**
- Historique complet préservé
- Peut créer branches, commits
- Peut comparer avec autres branches
- Synchronisation Git complète

---

### **Comparison Algorithm**

```typescript
1. Scan both directories (rewind + compare)
2. For each file:
   - Calculate SHA256 hash
   - Compare hashes
   - Categorize: added, deleted, modified, unchanged
3. Sort by status (added → deleted → modified → unchanged)
4. Generate report with:
   - Total counts per category
   - Top 5 changed files
   - Size differences

Performance: O(n) where n = total files
Uses: SHA256 for content-addressable comparison
```

---

## 🎨 Exemples d'Output

### **Rewind Complet avec Toutes les Options**

```bash
/rewind "2025-11-28T10:00:00Z" \
  --git-mode full \
  --create-session \
  --auto-checkout \
  --compare-with . \
  --output ~/recovered

# Output:
⏳ Starting rewind to 2025-11-28T10:00:00Z...
This may take a few moments...

✅ Rewind Complete!

Successfully rewound system to 2025-11-28T10:00:00.000Z
Restored 42 files
Replayed 1,234 events
Used snapshot: snapshot_20251128_095000
Output directory: /home/zack/recovered

📊 Stats:
  Events Replayed: 1,234
  Files Restored: 42
  Duration: 3,450ms
  Snapshot Used: snapshot_20251128_095000
  Session Created: #43 (Rewind-2025-11-28T10:00:00.000Z)
  📂 Working Directory Changed:
     From: /home/zack/GROK_CLI/grok-cli
     To:   /home/zack/recovered

📊 Comparison with /home/zack/GROK_CLI/grok-cli:
  Total Files: 42
  🆕 Added: 0
  ❌ Deleted: 3
  ✏️  Modified: 8
  ✅ Unchanged: 31

  Key Changes:
    ✏️  src/index.ts
    ✏️  src/agent/grok-agent.ts
    ✏️  package.json
    ❌ src/old-feature.ts
    ❌ src/deprecated.ts

💡 Use /switch-session 43 to activate the rewinded session
💡 You are now in the rewinded directory!

Next Steps:
  Switch to rewinded session: use session_switch tool with ID 43
  Explore the reconstructed state in: /home/zack/recovered
  Files are in: /home/zack/recovered/files/
  Session state: /home/zack/recovered/session_state.json
  Git state: /home/zack/recovered/git_state.json
  File manifest: /home/zack/recovered/file_manifest.json
```

---

## 🚀 Workflows Recommandés

### **1. Recovery Workflow (Fastest)**
```bash
/rewind "2025-11-28T10:00:00Z" --git-mode full --create-session --auto-checkout
# Immédiatement opérationnel dans l'état rewindé
```

### **2. Debugging Workflow (Most Informative)**
```bash
/rewind "2025-11-28T10:00:00Z" --compare-with .
# Voir exactement ce qui a changé
```

### **3. Safe Recovery (Non-Destructive)**
```bash
/rewind "2025-11-28T10:00:00Z" --git-mode full --output ~/backup
# État rewindé dans un répertoire séparé
# Répertoire actuel intact
```

### **4. Lightweight Inspection (Fastest)**
```bash
/rewind "2025-11-28T10:00:00Z" --git-mode none --no-conversations
# Juste les fichiers, très rapide
```

---

## 🎓 FAQ

### **Q: Quelle est la différence entre `/rewind` et `/new-session`?**
**A:** 
- `/rewind` = Time Machine complet (Event Sourcing depuis timeline.db)
- `/new-session` = Brancher une conversation (Copie depuis conversations.db)

### **Q: Quel mode Git dois-je utiliser?**
**A:**
- `none`: Juste les fichiers, pas de Git
- `metadata`: Rapide, savoir quel commit (DEFAULT)
- `full`: Repo Git complet, pour continuer à travailler

### **Q: `--auto-checkout` est-il sûr?**
**A:** Oui, il change juste le `process.cwd()`. Votre répertoire original reste intact.

### **Q: Puis-je comparer deux rewinds?**
**A:** Oui ! 
```bash
/rewind "T1" --output ~/r1
/rewind "T2" --output ~/r2 --compare-with ~/r1
```

### **Q: Les rewinds sont-ils tracés?**
**A:** Oui ! Tous les rewinds génèrent des événements dans timeline.db:
- `REWIND_STARTED`
- `REWIND_SNAPSHOT_LOADED`
- `REWIND_EVENTS_REPLAYED`
- `REWIND_STATE_MATERIALIZED`
- `REWIND_COMPLETED` / `REWIND_FAILED`

---

## 🎉 Récapitulatif

**Features Implémentées (Option B):**
1. ✅ `--git-mode <none|metadata|full>` - 3 modes de matérialisation Git
2. ✅ `--create-session` - Création automatique de session
3. ✅ `--auto-checkout` - cd automatique vers état rewindé
4. ✅ `--compare-with <dir>` - Comparaison détaillée entre états
5. ✅ `/rewind-history` - Dashboard des rewinds effectués

**Prochaines Features Possibles (Phase 2):**
- ⏳ `/new-session --clone-git` - Cloner repo dans nouvelle session
- ⏳ `/new-session --copy-files` - Copier fichiers actuels
- ⏳ `/new-session --from-rewind <timestamp>` - Partir d'un rewind
- ⏳ Dashboard interactif avec visualisation graphique

**Status:** Prêt pour testing ! 🚀

---

**Dernière mise à jour:** 2025-11-13  
**Build:** ✅ Réussi  
**Tests:** ⏳ À effectuer

# 📂 `/new-session` - Guide Complet des Features

**Date:** 2025-11-29  
**Version:** 2.0.0 (Phase 1 - Initialization Options)

---

## 📋 Vue d'Ensemble

### **`/new-session` vs `/rewind`**

| Feature | `/new-session` (Conversations DB) | `/rewind` (Timeline DB) |
|---------|-----------------------------------|-------------------------|
| **Source de données** | `conversations.db` (Read Model) | `timeline.db` (Write Model / Event Sourcing) |
| **Méthode** | Copie de messages + Init directory | Replay d'événements chronologiques |
| **Portée** | Conversations + Directory setup | TOUT (files + git + conversations + tools) |
| **Init Options** | ✅ clone-git, copy-files, from-rewind | ❌ Non (crée toujours nouveau répertoire) |
| **Use Case Principal** | Brancher conversations, Nouveau projet | Time Machine, Recovery, Audit |
| **Timestamp précis** | ❌ Non | ✅ Oui (microseconde) |

---

## 🚀 Nouvelles Features Implémentées

### **1. `--clone-git` - Clone Git Repository** ✅

**Description:** Clone le repository Git actuel dans le nouveau répertoire de session.

```bash
/new-session --directory ~/new-project --clone-git

# Résultat:
~/new-project/
├── .git/              # ← Repo Git complet cloné
│   ├── objects/
│   ├── refs/
│   └── HEAD
├── src/
│   └── index.ts
├── package.json
└── ...               # Tous les fichiers du repo
```

**Ce qui se passe:**
1. `git clone` du répertoire actuel vers `~/new-project_temp`
2. Copie de tous les fichiers (y compris `.git`) vers `~/new-project`
3. Suppression du répertoire temporaire
4. Création de la session Grokinou dans `~/new-project`

**Workflow typique:**
```bash
# Dans un projet Git
cd ~/my-project

# Créer une nouvelle session avec le repo Git cloné
/new-session --directory ~/my-project-branch --clone-git

# Vous avez maintenant:
# - Une copie complète du repo Git
# - Une nouvelle session Grokinou
# - Vous pouvez travailler indépendamment
```

**Use Cases:**
- ✅ Brancher un projet Git pour tester des changements
- ✅ Créer une copie de travail indépendante
- ✅ Expérimenter sans affecter le repo principal
- ✅ Développement parallèle

---

### **2. `--copy-files` - Copy Files** ✅

**Description:** Copie les fichiers du répertoire actuel (excluant `.git`, `node_modules`, fichiers cachés) vers le nouveau répertoire.

```bash
/new-session --directory ~/new-project --copy-files

# Résultat:
~/new-project/
├── src/              # ← Fichiers copiés
│   └── index.ts
├── package.json
└── ...
# ❌ Pas de .git/
# ❌ Pas de node_modules/
# ❌ Pas de fichiers cachés (.env, etc.)
```

**Ce qui se passe:**
1. Utilise `rsync` (ou `cp` en fallback) pour copier les fichiers
2. Exclut automatiquement:
   - `.git/` (et tous fichiers cachés commençant par `.`)
   - `node_modules/`
3. Crée la session Grokinou dans le répertoire

**Workflow typique:**
```bash
# Dans un projet existant
cd ~/my-document-project

# Créer une nouvelle session avec les fichiers copiés
/new-session --directory ~/my-document-v2 --copy-files

# Vous avez maintenant:
# - Tous les fichiers (sans .git)
# - Une nouvelle session indépendante
# - Pas d'historique Git (fresh start)
```

**Use Cases:**
- ✅ Copier un projet non-Git
- ✅ Créer une variante sans historique Git
- ✅ Travail sur documents (sans versionning)
- ✅ Prototypage rapide

---

### **3. `--from-rewind <timestamp>` - Initialize from Rewind** 🔥

**Description:** Utilise `/rewind` (Event Sourcing) pour initialiser le répertoire avec un état passé exact.

```bash
/new-session --directory ~/recovered --from-rewind "2025-11-28T10:00:00Z"

# Résultat:
~/recovered/
├── .git/              # ← Repo Git au commit exact
│   └── HEAD → abc123...
├── src/
│   └── index.ts      # ← Fichiers à l'état exact du 28/11 à 10h
├── package.json
├── files/             # ← Fichiers reconstruits par Event Sourcing
├── session_state.json
└── file_manifest.json
```

**Ce qui se passe:**
1. Appelle `/rewind` avec le timestamp spécifié
2. Reconstruit TOUT l'état du système à ce moment:
   - Fichiers (depuis Merkle DAG)
   - Git repository (mode `full`)
   - Conversations (si `--import-history`)
3. Crée la session Grokinou dans cet état exact

**Workflow typique:**
```bash
# Vous voulez revenir à l'état de ce matin
/snapshots
# Voir: Snapshot à 09:00:00 ce matin

# Créer une session à partir de cet état
/new-session --directory ~/morning-state --from-rewind "2025-11-29T09:00:00Z" --import-history

# Vous avez maintenant:
# - État complet du système à 09:00
# - Git repository au bon commit
# - Conversations importées
# - Session prête à travailler
```

**Use Cases:**
- ✅ Recovery après bug (état qui marchait)
- ✅ Comparaison d'états (ce matin vs maintenant)
- ✅ Brancher depuis un point précis du passé
- ✅ Forensics et audit

**⚠️ Important:** 
- Requiert que la Timeline DB soit activée
- Utilise Event Sourcing (plus lent que clone-git)
- Précision temporelle exacte (microseconde)
- Le plus puissant des 3 options

---

## 🎯 Cas d'Usage Complets

### **Use Case 1: Brancher un Projet Git**

```bash
# Situation: Vous travaillez sur un projet, voulez tester une idée sans casser le principal

# 1. Cloner le repo Git dans une nouvelle branche
/new-session --directory ~/my-project-experimental --clone-git --import-history

# 2. Vous êtes maintenant dans ~/my-project-experimental
pwd  # → ~/my-project-experimental
git log  # → Historique Git complet
ls  # → Tous les fichiers du projet

# 3. Expérimenter librement
# ... faire des changements ...
git add .
git commit -m "Experimental feature"

# 4. Si ça marche, merger vers le principal
cd ~/my-project
git remote add experimental ~/my-project-experimental
git fetch experimental
git merge experimental/main

# 5. Si ça marche pas, juste supprimer
rm -rf ~/my-project-experimental
```

---

### **Use Case 2: Copier Documents sans Git**

```bash
# Situation: Vous travaillez sur des documents Markdown, pas besoin de Git

# 1. Copier les fichiers vers une nouvelle session
/new-session --directory ~/documents-v2 --copy-files

# 2. Travailler sur la nouvelle version
# - Pas de .git (pas de commits)
# - Juste édition de fichiers
# - Session indépendante

# 3. Si besoin, re-copier vers l'original plus tard
cp ~/documents-v2/* ~/documents/
```

---

### **Use Case 3: Recovery Temporel avec Event Sourcing**

```bash
# Situation: Votre code marchait ce matin, plus maintenant

# 1. Lister les points de rewind disponibles
/snapshots
# Voir: Snapshot à 09:00:00 ce matin

# 2. Créer une session à partir de l'état de ce matin
/new-session --directory ~/morning-working-state --from-rewind "2025-11-29T09:00:00Z"

# 3. Comparer avec l'état actuel
cd ~/morning-working-state
git diff ~/my-project

# 4. Identifier ce qui a changé
# ... analyser les diff ...

# 5. Soit:
# Option A: Rester dans l'état du matin (qui marche)
#           et continuer à travailler depuis là
# Option B: Copier le fix vers le projet principal
```

---

### **Use Case 4: Workflow Quotidien - Branching**

```bash
# Morning: Créer des branches pour différentes tâches

# Branche 1: Feature A
/new-session --directory ~/features/feature-a --clone-git
# ... travailler sur feature A ...

# Branche 2: Feature B
/new-session --directory ~/features/feature-b --clone-git
# ... travailler sur feature B ...

# Branche 3: Bugfix
/new-session --directory ~/bugfix/issue-123 --from-rewind "2025-11-28T18:00:00Z"
# ... partir de l'état d'hier soir (qui marchait) ...

# Evening: Merger les branches qui marchent
cd ~/main-project
git remote add feature-a ~/features/feature-a
git merge feature-a/main
```

---

## 📊 Tableau Comparatif des Options

| Option | Init Speed | Git History | Files | Use Case |
|--------|------------|-------------|-------|----------|
| **Aucune** | ⚡⚡⚡ Instant | ❌ Non | ❌ Empty | Fresh start |
| **--copy-files** | ⚡⚡ Rapide | ❌ Non | ✅ Current | Documents, no Git |
| **--clone-git** | ⚡ Moyen | ✅ Full | ✅ Current | Git branching |
| **--from-rewind** | 🐌 Lent | ✅ At timestamp | ✅ At timestamp | Time Machine, Recovery |

---

## 🎨 Exemples d'Output

### **Exemple 1: Clone Git**

```bash
/new-session --directory ~/project-v2 --clone-git

# Output:
⏳ Cloning Git repository to /home/user/project-v2...
This may take a moment...

✅ Git repository cloned successfully

✅ **New Session Created** #42

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Working Directory: /home/user/project-v2
🤖 Provider: grok
📱 Model: grok-2-latest
💬 Messages: 0
🕐 Created: 29/11/2025 09:30:00

📦 **Directory Initialized:** Git repository cloned

📂 **Directory Changed:**
   From: /home/user/project
   To:   /home/user/project-v2

⚠️  All relative paths now resolve to the new directory.

📄 **Fresh Start**
   This is a brand new conversation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can now start a new conversation!

💡 Use /list_sessions to see all sessions
💡 Use /switch-session <id> to switch back
```

---

### **Exemple 2: From Rewind**

```bash
/new-session --directory ~/recovered --from-rewind "2025-11-29T09:00:00Z" --import-history

# Output:
⏳ Initializing directory from rewind at 2025-11-29T09:00:00Z...
This may take a moment...

[Rewind Progress...]

✅ Directory initialized from rewind
   Files Restored: 156
   Events Replayed: 2,345
   Duration: 4,230ms

✅ **New Session Created** #43

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Working Directory: /home/user/recovered
🤖 Provider: grok
📱 Model: grok-2-latest
💬 Messages: 42 (imported)
🕐 Created: 29/11/2025 10:00:00

🕰️  **Directory Initialized:** From rewind at 2025-11-29T09:00:00Z

📂 **Directory Changed:**
   From: /home/user/project
   To:   /home/user/recovered

⚠️  All relative paths now resolve to the new directory.

📋 **History Imported**
   Source: Current session
   Messages: 42 imported

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can now start a new conversation!

💡 Use /list_sessions to see all sessions
💡 Use /switch-session <id> to switch back
```

---

## 🎓 FAQ

### **Q: Quelle option dois-je utiliser?**
**A:**
- Projet Git, besoin de l'historique → `--clone-git`
- Documents/fichiers sans Git → `--copy-files`
- Recovery/Time Machine → `--from-rewind`
- Fresh start → Aucune option

### **Q: Puis-je combiner plusieurs options?**
**A:** Non, elles sont mutuellement exclusives. L'ordre de priorité est:
1. `--from-rewind` (si spécifié)
2. `--clone-git` (si spécifié et pas from-rewind)
3. `--copy-files` (si spécifié et pas les autres)
4. Aucune initialisation (répertoire vide ou existant)

### **Q: `--from-rewind` copie-t-il les conversations?**
**A:** Oui, si vous ajoutez `--import-history`. Sinon, seuls les fichiers et Git sont reconstruits.

### **Q: Que se passe-t-il si le répertoire existe déjà?**
**A:** 
- Si vide: Les options fonctionnent normalement
- Si contient des fichiers: Les options peuvent écraser les fichiers existants
- Recommandation: Utiliser un répertoire vide ou non-existant

### **Q: `--clone-git` vs `--from-rewind` avec Git?**
**A:**
- `--clone-git`: Clone l'état Git **actuel** (rapide, ~1s)
- `--from-rewind`: Reconstruit l'état Git à un **timestamp précis** (lent, ~5s, mais précis)

### **Q: Puis-je utiliser `--from-rewind` sans Timeline DB?**
**A:** Non, `--from-rewind` requiert que la Timeline DB soit activée et contienne des événements.

---

## 🔧 Architecture Technique

### **Clone Git Process**

```typescript
1. git clone <current_dir> <target_dir>_temp
2. cp -r <target_dir>_temp/* <target_dir>/
3. cp -r <target_dir>_temp/.* <target_dir>/
4. rm -rf <target_dir>_temp
5. Create Grokinou session in <target_dir>

Performance: ~1-2s pour repo moyen
Disk Space: 2x size du repo (temporairement 3x pendant le clone)
```

---

### **Copy Files Process**

```typescript
1. rsync -av --exclude='.git' --exclude='node_modules' --exclude='.*' \
     <current_dir>/ <target_dir>/
   
   Fallback si rsync non disponible:
   cp -r <current_dir>/* <target_dir>/

2. Create Grokinou session in <target_dir>

Performance: ~0.5-1s pour projet moyen
Disk Space: 1x size des fichiers (pas .git, pas node_modules)
```

---

### **From Rewind Process**

```typescript
1. Call executeRewindTo({
     targetTimestamp,
     outputDir: <target_dir>,
     includeFiles: true,
     includeConversations: importHistory,
     gitMode: 'full',
     createSession: false
   })

2. Rewind Engine:
   a. Find nearest snapshot BEFORE timestamp
   b. Replay events from snapshot to timestamp
   c. Reconstruct files (Merkle DAG)
   d. Materialize Git repository (if gitMode='full')
   e. Write all to <target_dir>

3. Create Grokinou session in <target_dir>

Performance: ~3-10s depending on events
Disk Space: 1x size at timestamp (full reconstruction)
```

---

## 🎉 Récapitulatif

**Features Implémentées:**
1. ✅ `--clone-git` - Clone Git repository
2. ✅ `--copy-files` - Copy files (excluding .git)
3. ✅ `--from-rewind <timestamp>` - Initialize from rewind state

**Benefits:**
- 🚀 Workflows Git-like branching
- 📁 Flexibilité d'initialisation de répertoire
- 🕰️ Pont entre `/new-session` et `/rewind`
- ⚡ Options pour tous les use cases (Git, docs, recovery)

**Différence Clé avec `/rewind`:**
- `/rewind` = Event Sourcing (timeline.db) → État précis à un timestamp
- `/new-session` = Session branching (conversations.db) → Nouveau contexte de travail
- **Pont:** `--from-rewind` utilise Event Sourcing pour initialiser une nouvelle session !

---

**Dernière mise à jour:** 2025-11-29  
**Build:** ✅ Réussi  
**Tests:** ⏳ À effectuer  
**Status:** Prêt pour testing ! 🚀

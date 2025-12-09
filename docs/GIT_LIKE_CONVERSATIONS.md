# 🌳 Git-Like Conversations - Guide Complet

## 🎯 Concept Révolutionnaire

**Grokinou transforme les conversations avec l'IA en un système de version control, comme Git pour le code.**

### **Git pour le Code**
```bash
git checkout -b new-feature    # Créer une branche
git reset --hard abc123        # Revenir à un commit
git branch --list              # Lister les branches
git checkout main              # Basculer entre branches
```

### **Grokinou pour les Conversations**
```bash
/new-session --directory ~/new-feature    # Créer une branche
/new-session --date-range 01/11 03/11     # Revenir à un état
/list_sessions                            # Lister les sessions
/switch-session 5                         # Basculer entre sessions
```

---

## 🚀 Commande Complète : `/new-session`

### **Syntaxe**

```bash
/new-session [options]
```

### **Options Disponibles**

| Option | Description | Exemple |
|--------|-------------|---------|
| `--directory <path>` | Créer la session dans un AUTRE répertoire | `--directory ~/rewind` |
| `--from-session <id>` | Importer depuis une session spécifique | `--from-session 5` |
| `--from-date <date>` | Importer depuis cette date | `--from-date 01/11/2025` |
| `--to-date <date>` | Importer jusqu'à cette date | `--to-date 03/11/2025` |
| `--date-range <start> <end>` | Importer entre deux dates | `--date-range 01/11/2025 03/11/2025` |
| `--import-history` | Importer tout l'historique | `--import-history` |
| `--model <name>` | Démarrer avec un modèle spécifique | `--model gpt-4o` |
| `--provider <name>` | Démarrer avec un provider spécifique | `--provider openai` |

### **Formats de Date Supportés**

| Format | Exemple | Description |
|--------|---------|-------------|
| DD/MM/YYYY | `01/11/2025` | Jour/Mois/Année |
| YYYY-MM-DD | `2025-11-01` | ISO 8601 |
| Relatif | `today` | Aujourd'hui |
| Relatif | `yesterday` | Hier |

---

## 💡 Cas d'Usage : Git-Like Workflows

### **1. Rewind : Revenir à un État de Conversation**

**Problème :** "J'ai avancé trop loin. Je veux revenir à la discussion du 3 novembre."

```bash
cd ~/mon-projet
grokinou-cli
# Session actuelle : 200 messages (jusqu'au 25 nov)

# Je veux SEULEMENT les messages du 1er au 3 novembre
/new-session --directory ~/rewind-03-nov \
             --from-session 1 \
             --date-range 01/11/2025 03/11/2025

# Résultat :
✅ New Session Created #10
📂 Working Directory: /home/user/rewind-03-nov (Created in new directory)
📋 History Imported
   Source: Session #1
   Date Range: 01/11/2025 → 03/11/2025
   Messages: 25 imported (sur 200 totaux)

# Maintenant je retravaille à partir du 3 novembre
# Avec EXACTEMENT le contexte de cette époque
User: "Maintenant essayons une approche différente..."
```

**Ce que ça fait :**
- ✅ Nouveau répertoire `~/rewind-03-nov` créé automatiquement
- ✅ SEULEMENT les 25 messages du 1-3 nov sont importés
- ✅ Conversation repart de cet état **exact**
- ✅ Session originale **intacte**

---

### **2. Branching : États de Développement Parallèles**

**Problème :** "Je veux explorer 2 approches différentes sans perdre mon travail."

```bash
cd ~/mon-app
grokinou-cli
# Session principale : approche A
User: "Optimise avec Redis cache"
[...100 messages sur Redis...]

# Brancher : Explorer approche B (Memcached)
/new-session --directory ~/mon-app-memcached \
             --import-history

# Nouveau répertoire, historique complet importé
User: "Maintenant refais tout avec Memcached au lieu de Redis"
[...exploration Memcached...]

# Répertoire original intact
cd ~/mon-app
grokinou-cli
# → Session originale avec Redis (100 messages)

# Navigation entre branches
cd ~/mon-app-memcached
grokinou-cli
# → Session alternative avec Memcached
```

**Résultat :**
```
~/mon-app/             → Approche Redis (original)
~/mon-app-memcached/   → Approche Memcached (branche)
```

---

### **3. Surgical Extraction : Extraire une Discussion Spécifique**

**Problème :** "Session #5 a 300 messages. Je veux SEULEMENT la discussion sur PostgreSQL (20-25 oct)."

```bash
cd ~/mon-projet
grokinou-cli

/new-session --from-session 5 \
             --from-date 20/10/2025 \
             --to-date 25/10/2025

# Résultat : Nouvelle session avec SEULEMENT les messages du 20-25 oct
# Exemple : 45 messages sur PostgreSQL (sur 300 totaux)
```

**Avantages :**
- ✅ Focus sur UN sujet précis
- ✅ Pas de bruit des autres discussions
- ✅ Contexte chirurgicalement extrait

---

### **4. Multi-Project States : WDIMQ / ColPali / TenderWatch**

**Ton cas d'usage réel (WDIMQ, ColPali, TenderWatch) :**

```bash
# État initial : Session WDIMQ longue et complexe
cd ~/WDIMQ
grokinou-cli
# Session #1 : 200 messages mélangés (WDIMQ, ColPali, TenderWatch)

# Problème : Contexte mélangé, confusion

# Solution : Brancher en sous-projets isolés

# 1. Extraire SEULEMENT les discussions ColPali (1-5 nov)
/new-session --directory ~/WDIMQ/ColPali \
             --from-session 1 \
             --from-date 01/11/2025 \
             --to-date 05/11/2025

# 2. Extraire SEULEMENT TenderWatch (10-15 nov)
/new-session --directory ~/TenderWatch \
             --from-session 1 \
             --from-date 10/11/2025 \
             --to-date 15/11/2025

# 3. Session WDIMQ pure (sans ColPali ni TenderWatch)
/new-session --directory ~/WDIMQ-pure \
             --from-session 1 \
             --to-date 31/10/2025  # Avant les sous-projets
```

**Résultat :**
```
~/WDIMQ/            → Session originale (intacte)
~/WDIMQ/ColPali/    → SEULEMENT discussions ColPali (1-5 nov)
~/TenderWatch/      → SEULEMENT discussions TenderWatch (10-15 nov)
~/WDIMQ-pure/       → WDIMQ sans les sous-projets
```

**Maintenant tu peux :**
```bash
cd ~/WDIMQ/ColPali
grokinou-cli
# → Contexte 100% ColPali, pas de confusion

cd ~/TenderWatch
grokinou-cli
# → Contexte 100% TenderWatch

cd ~/WDIMQ-pure
grokinou-cli
# → Contexte WDIMQ pur
```

---

### **5. Time Checkpoint : Sauvegarder un État**

**Scénario :** "Le 15 novembre, tout fonctionnait. Depuis, j'ai cassé des trucs."

```bash
cd ~/my-app
grokinou-cli
# Session actuelle : 150 messages (jusqu'au 25 nov, code cassé)

# Revenir à l'état du 15 novembre
/new-session --directory ~/my-app-working-state \
             --from-date 01/11/2025 \
             --to-date 15/11/2025

# Nouvelle session dans ~/my-app-working-state
# Avec SEULEMENT les messages jusqu'au 15 nov
# État où "tout fonctionnait"

User: "Continue le développement à partir de cet état stable"
```

---

## 🌳 Analogie Git Complète

| Git Command | Grokinou Equivalent | Description |
|-------------|---------------------|-------------|
| `git branch` | `/list_sessions` | Liste les sessions/branches |
| `git checkout -b new-feature` | `/new-session --directory ~/new-feature` | Créer une branche |
| `git checkout main` | `/switch-session <id>` | Basculer entre branches |
| `git reset --hard <commit>` | `/new-session --date-range <start> <end>` | Revenir à un état |
| `git log` | Messages avec timestamps | Historique des conversations |
| `git diff` | (Future: --git-rewind) | Copier les fichiers aussi |

---

## 📋 Exemples Pratiques

### **Exemple 1 : Rewind Simple**

```bash
# Revenir au 3 novembre
/new-session --date-range 01/11/2025 03/11/2025
```

### **Exemple 2 : Branch vers Nouveau Répertoire**

```bash
# Créer branche dans nouveau répertoire
/new-session --directory ~/projet-v2 --import-history
```

### **Exemple 3 : Time Travel avec Session Spécifique**

```bash
# Importer session #8, seulement messages de novembre
/new-session --from-session 8 --from-date 01/11/2025
```

### **Exemple 4 : Combinaison Complète**

```bash
# Cas d'usage complet : Rewind + nouveau répertoire + modèle différent
/new-session --directory ~/experimental-rewind \
             --from-session 5 \
             --date-range 01/11/2025 03/11/2025 \
             --model deepseek-chat
```

---

## 🔮 Future : Git Rewind Integration (Phase 4.3)

### **Concept**

Combiner le rewind de conversation avec le rewind Git des fichiers :

```bash
/new-session --directory ~/rewind-03-11 \
             --from-session 5 \
             --date-range 01/11 03/11 \
             --git-rewind  # NOUVEAU FLAG

# Ce que ça ferait :
# 1. Créer session avec messages du 01-03 nov
# 2. git log --since="01/11/2025" --until="03/11/2025"
# 3. git diff <commit-01-nov> <commit-03-nov>
# 4. Copier les fichiers modifiés dans ~/rewind-03-11
# 5. Résultat : ÉTAT COMPLET (conversation + code) du 3 nov
```

### **Avantages du Git Rewind**

- ✅ Conversation ET code synchronisés
- ✅ État complet du projet à une date donnée
- ✅ Itération depuis un "checkpoint" parfait
- ✅ Comparaison facile entre états

### **Implémentation Future**

```typescript
// Dans createNewSession()
if (options.gitRewind && dateRange) {
  // 1. Find git commits in date range
  const commits = await getGitCommitsInRange(dateRange.start, dateRange.end);
  
  // 2. Get file diffs
  const firstCommit = commits[0].hash;
  const lastCommit = commits[commits.length - 1].hash;
  const diff = await execAsync(`git diff ${firstCommit} ${lastCommit}`);
  
  // 3. Extract changed files
  const changedFiles = await getChangedFiles(firstCommit, lastCommit);
  
  // 4. Copy files to new directory
  for (const file of changedFiles) {
    await copyFileAtCommit(file, lastCommit, newWorkdir);
  }
  
  // 5. Create .git-rewind-info.json
  const rewindInfo = {
    source_session: sourceSession.id,
    date_range: { start, end },
    git_commits: commits,
    files_copied: changedFiles.length,
    first_commit: firstCommit,
    last_commit: lastCommit
  };
  await fs.writeFile(
    path.join(newWorkdir, '.git-rewind-info.json'), 
    JSON.stringify(rewindInfo, null, 2)
  );
}
```

---

## 🎓 Workflows Avancés

### **Workflow 1 : Iterative Refinement**

```bash
# État 1 : Nov 1-5 (approche A)
cd ~/app-v1
/new-session --directory ~/app-v1 --date-range 01/11 05/11

# État 2 : Nov 10-15 (approche B)
cd ~/app-v2
/new-session --directory ~/app-v2 --date-range 10/11 15/11

# État 3 : Nov 20-25 (approche C)
cd ~/app-v3
/new-session --directory ~/app-v3 --date-range 20/11 25/11

# Comparer les 3 approches
cd ~/app-v1 && grokinou-cli  # Approche A
cd ~/app-v2 && grokinou-cli  # Approche B
cd ~/app-v3 && grokinou-cli  # Approche C
```

### **Workflow 2 : Collaborative Development**

```bash
# Alice : Développement principal
cd ~/projet
grokinou-cli
# Session #1 : 100 messages

# Bob : Veut partir de l'état du 15 nov pour une feature
/new-session --directory ~/projet-bob-feature \
             --from-session 1 \
             --to-date 15/11/2025

# Bob travaille indépendamment
# Alice continue sur le projet principal
# Pas de conflit, pas de pollution
```

### **Workflow 3 : Experimentation Safe**

```bash
# Projet stable
cd ~/stable-app
grokinou-cli
# Session #1 : 200 messages, code stable

# Expérimentation radicale
/new-session --directory ~/experimental \
             --import-history \
             --model deepseek-chat

# Casse tout, expérimente
User: "Réécris TOUT en Rust"
[...expérimentation chaotique...]

# Si ça échoue, reviens à stable
cd ~/stable-app
grokinou-cli
# → Code et conversation intacts
```

---

## 🔍 Exemples Concrets (Ton Cas d'Usage)

### **Scénario : WDIMQ + ColPali + TenderWatch**

**État Initial (Problématique) :**
```bash
cd ~/WDIMQ
grokinou-cli
# Session #1 : 300 messages
# - Messages WDIMQ (oct)
# - Messages ColPali (début nov)
# - Messages TenderWatch (mi-nov)
# - Messages QWEN (fin nov)
# → TOUT MÉLANGÉ, CONFUSION TOTALE
```

**Solution : Branching Chirurgical**

```bash
# 1. Extraire ColPali (1-10 novembre)
/new-session --directory ~/WDIMQ/ColPali \
             --from-session 1 \
             --from-date 01/11/2025 \
             --to-date 10/11/2025

# Résultat : Session #2
# - Répertoire : ~/WDIMQ/ColPali
# - Messages : SEULEMENT ColPali (40 messages)
# - Le LLM connaît SEULEMENT ColPali

# 2. Extraire TenderWatch (10-20 novembre)
/new-session --directory ~/TenderWatch \
             --from-session 1 \
             --from-date 10/11/2025 \
             --to-date 20/11/2025

# Résultat : Session #3
# - Répertoire : ~/TenderWatch
# - Messages : SEULEMENT TenderWatch (50 messages)
# - Le LLM connaît SEULEMENT TenderWatch

# 3. WDIMQ pur (avant sous-projets)
/new-session --directory ~/WDIMQ-pure \
             --from-session 1 \
             --to-date 31/10/2025

# Résultat : Session #4
# - Répertoire : ~/WDIMQ-pure
# - Messages : WDIMQ avant ColPali/TenderWatch (150 messages)
# - Le LLM connaît SEULEMENT WDIMQ

# 4. Navigation claire
cd ~/WDIMQ/ColPali && grokinou-cli
# → Contexte ColPali pur

cd ~/TenderWatch && grokinou-cli
# → Contexte TenderWatch pur

cd ~/WDIMQ-pure && grokinou-cli
# → Contexte WDIMQ pur

cd ~/WDIMQ && grokinou-cli
# → Session originale (complète, mélangée)
```

**Avant :**
```
❌ "Le LLM ne sait plus dans quel projet il travaille"
❌ "Confusion entre WDIMQ, ColPali, TenderWatch"
❌ "Impossible de travailler proprement sur ColPali seul"
```

**Après :**
```
✅ Chaque projet dans son répertoire
✅ Chaque session avec SEULEMENT son contexte
✅ Navigation claire et isolation parfaite
✅ Le LLM sait EXACTEMENT où il travaille
```

---

## 📊 Message de Confirmation Détaillé

```
✅ **New Session Created** #10

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Working Directory: /home/user/rewind-03-nov
   (Created in new directory)
🤖 Provider: openai
📱 Model: gpt-4o
💬 Messages: 25 (imported)
🕐 Created: 11/25/2025, 11:30:00 PM

📋 **History Imported**
   Source: Session #1
   Date Range: 01/11/2025 → 03/11/2025
   Messages: 25 imported

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can now start a new conversation!

💡 Use /list_sessions to see all sessions
💡 Use /switch-session <id> to switch back
```

---

## 🎯 Comparaison : Avant / Après

| Aspect | **AVANT (Phase 4.1)** | **APRÈS (Phase 4.2)** |
|--------|-----------------------|-----------------------|
| **Répertoire cible** | ❌ Seulement répertoire actuel | ✅ N'importe quel répertoire |
| **Source d'import** | ❌ Seulement session courante | ✅ N'importe quelle session |
| **Filtrage par date** | ❌ Impossible | ✅ Range dates flexible |
| **Branching** | ❌ Limité | ✅ Complet (Git-like) |
| **Time travel** | ❌ Impossible | ✅ Rewind à n'importe quelle date |
| **États multiples** | ❌ Difficile | ✅ Trivial (1 commande) |

---

## 🔧 Implémentation Technique

### **1. SessionManagerSQLite.createNewSession()**

**Ancienne Signature (Phase 4.1) :**
```typescript
async createNewSession(
  workdir: string,
  provider: string,
  model: string,
  apiKey?: string,
  importHistory: boolean = false  // ❌ Limité
): Promise<...>
```

**Nouvelle Signature (Phase 4.2) :**
```typescript
async createNewSession(
  workdir: string,  // Peut être différent du CWD
  provider: string,
  model: string,
  apiKey?: string,
  options?: {       // ✅ Flexible
    importHistory?: boolean;
    fromSessionId?: number;      // NOUVEAU
    dateRange?: {                // NOUVEAU
      start: Date;
      end: Date;
    };
  }
): Promise<{ session: Session; history: ChatEntry[] }>
```

### **2. Date Filtering Logic**

```typescript
// Filtrage par date range
if (dateRange) {
  const startTime = dateRange.start.getTime();
  const endTime = dateRange.end.getTime();
  
  const originalCount = messages.length;
  messages = messages.filter(msg => {
    const msgTime = new Date(msg.timestamp).getTime();
    return msgTime >= startTime && msgTime <= endTime;
  });
  
  // Log: "Date filter: 200 → 25 messages"
}
```

### **3. Directory Creation**

```typescript
// Créer répertoire cible si inexistant
if (!fs.existsSync(targetWorkdir)) {
  fs.mkdirSync(targetWorkdir, { recursive: true });
}
```

---

## 🎉 Résumé des Capacités

**Grokinou supporte maintenant :**

1. ✅ **Branching** : Créer sessions dans différents répertoires
2. ✅ **Time Travel** : Revenir à un état de conversation donné
3. ✅ **Surgical Extraction** : Extraire messages par date range
4. ✅ **Session Sourcing** : Importer depuis N'IMPORTE quelle session
5. ✅ **Multi-State Development** : Plusieurs états de développement en parallèle
6. ✅ **Context Isolation** : Chaque répertoire = contexte isolé
7. 🔜 **Git Rewind** : Copier aussi les fichiers (Phase 4.3)

---

## 🚀 Prochaine Étape : Git Rewind (Phase 4.3)

**Objectif :** Synchroniser conversation ET code

```bash
/new-session --directory ~/rewind-03-11 \
             --from-session 5 \
             --date-range 01/11 03/11 \
             --git-rewind  # Copie aussi les fichiers !

# Ce que ça fera :
# 1. Messages du 01-03 novembre ✅ (déjà implémenté)
# 2. git log --since / --until  🔜 (à implémenter)
# 3. git diff entre commits      🔜 (à implémenter)
# 4. Copier fichiers modifiés    🔜 (à implémenter)
# 5. État COMPLET du 3 nov       🔜 (à implémenter)
```

**Avantages :**
- ✅ Conversation à la date T
- ✅ Code à la date T
- ✅ État complet synchronisé
- ✅ Itération depuis un checkpoint parfait

---

## 📖 Documentation Complète

**Guides Disponibles :**
- `docs/SWITCH_SESSION_USE_CASES.md` - Navigation entre sessions
- `docs/NEW_SESSION_GUIDE.md` - Création de sessions basique
- `docs/GIT_LIKE_CONVERSATIONS.md` - **CE DOCUMENT** (Git-like workflows)

---

## 🎊 Conclusion

**Grokinou est maintenant un véritable système de version control pour les conversations avec l'IA.**

**Tu peux :**
- 🌳 **Brancher** des conversations
- ⏮️ **Rewind** à n'importe quel état
- 🔀 **Isoler** des contextes par répertoire
- 📅 **Filtrer** par date avec précision chirurgicale
- 🚀 **Expérimenter** sans risque
- 🔄 **Comparer** différentes approches

**C'est Git, mais pour les conversations. 🚀**

---

**Date:** 2025-11-25  
**Version:** 0.1.0  
**Commit:** 0fd499d  
**Phase:** 4.2 Complete

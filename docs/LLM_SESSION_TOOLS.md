# 🤖 LLM-Accessible Session Management Tools

## 🎯 Vue d'Ensemble

**Grokinou permet maintenant aux LLMs de gérer les sessions de conversation de manière autonome**, avec un système de permissions pour les opérations critiques.

---

## 🏗️ Architecture 3 Couches

```
┌──────────────────────────────────────────┐
│  Layer 1: USER COMMANDS (Future)         │
│  /list_sessions, /switch-session, etc.   │
│  → Contrôle manuel direct                │
└──────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────┐
│  Layer 2: LLM TOOLS (Implemented)        │
│  session_list, session_switch, etc.      │
│  → Automatisation avec permissions       │
└──────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────┐
│  Layer 3: CORE FUNCTIONS (Shared)        │
│  SessionManager, GitRewindManager        │
│  → Logique réutilisable (DRY)            │
└──────────────────────────────────────────┘
```

---

## 🛠️ Les 4 Tools

### **1. `session_list` - Lister les Sessions**

**Permissions :** ❌ Aucune (lecture seule)

```typescript
// LLM appelle :
session_list()

// Résultat :
📋 Conversation Sessions (3 total)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👉 Session #1 🟢
   📂 Directory: /home/user/WDIMQ
   🤖 Provider: openai (gpt-4o)
   💬 Messages: 300
   📝 Name: Implémente WDIMQ avec ColPali
   💭 First: "Créons un système de recherche..."
   📅 Created: 25/10/2025
   🕐 Last Active: 25/11/2025, 21:00:00
   ✨ **CURRENT SESSION**

   Session #2 🟢
   📂 Directory: /home/user/WDIMQ/ColPali
   🤖 Provider: claude (claude-3-5-sonnet)
   💬 Messages: 40
   ...
```

**Usage LLM :**
```
User: "Quelles sessions ai-je ?"
LLM: [Appelle session_list]
LLM: "Vous avez 3 sessions actives : 
      - WDIMQ (300 messages)
      - ColPali (40 messages)  
      - TenderWatch (50 messages)"
```

---

### **2. `session_switch` - Basculer vers une Session**

**Permissions :** ✅ **TOUJOURS demander**

```typescript
// LLM appelle :
session_switch({
  session_id: 2
})

// Effets :
// 1. Change process.cwd() vers /home/user/WDIMQ/ColPali
// 2. Charge les 40 messages de la session
// 3. Met à jour le modèle/provider de l'agent
```

**Règle de Permission :**
```
❌ INTERDIT: Appeler directement sans permission
✅ REQUIS: Demander permission d'abord

Example:
"Je vais basculer vers Session #2 (ColPali, ~/WDIMQ/ColPali, 40 messages).
 Cela changera le répertoire de travail. Confirmez-vous ?"

User: "Oui" 

→ ALORS appeler session_switch({ session_id: 2 })
```

**Usage LLM :**
```
User: "Travaillons sur ColPali"

LLM: [Appelle session_list pour trouver ColPali]
LLM: "Je vois Session #2 (ColPali, 40 messages dans ~/WDIMQ/ColPali).
      Souhaitez-vous que je bascule vers cette session ?"

User: "Oui"

LLM: [Appelle session_switch({ session_id: 2 })]
LLM: "✅ Basculé vers Session #2 (ColPali).
      Répertoire: ~/WDIMQ/ColPali
      40 messages chargés.
      Que voulez-vous faire ?"
```

---

### **3. `session_new` - Créer une Nouvelle Session**

**Permissions :** ⚠️ **Demander si nouveau répertoire ou filtrage**

```typescript
// LLM appelle :
session_new({
  directory: "~/experimental",
  import_history: true,
  from_session_id: 1,
  date_range_start: "2025-11-01",
  date_range_end: "2025-11-03",
  model: "deepseek-chat",
  provider: "deepseek"
})

// Effets :
// 1. Crée ~/experimental/ (si inexistant)
// 2. Importe messages de Session #1 du 01-03 nov
// 3. Nouvelle session avec modèle deepseek-chat
// 4. Change CWD + contexte agent
```

**Règles de Permission :**
```
✅ Pas de permission: Créer dans répertoire actuel sans filtrage
⚠️ Demander permission:
   - Créer dans NOUVEAU répertoire
   - Importer avec filtrage par date
   - Changer de modèle

Example:
"Je vais créer une nouvelle session dans ~/experimental avec :
 - Import de Session #1 (messages du 01-03 nov, ~40 messages)
 - Modèle : deepseek-chat
 Confirmez-vous ?"

User: "Ok"

→ ALORS appeler session_new(...)
```

**Usage LLM :**
```
User: "Créons une branche expérimentale pour essayer Rust"

LLM: "Je vais créer une nouvelle session dans ~/experimental-rust
      avec l'historique actuel importé (300 messages).
      D'accord ?"

User: "Oui"

LLM: [Appelle session_new({
       directory: "~/experimental-rust",
       import_history: true
     })]
LLM: "✅ Session #5 créée dans ~/experimental-rust.
      300 messages importés. On peut commencer !"
```

---

### **4. `session_rewind` - Git Rewind (CRITIQUE)**

**Permissions :** 🔴 **TOUJOURS expliquer le plan complet + obtenir approbation explicite**

```typescript
// LLM appelle :
session_rewind({
  target_directory: "~/rewind-nov-03",
  date_range_start: "2025-11-01",
  date_range_end: "2025-11-03",
  from_session_id: 1,
  preserve_git_history: false  // default
})

// Effets :
// 1. Crée ~/rewind-nov-03/
// 2. git archive du commit du 03/11/2025
// 3. Extrait ~127 fichiers dans l'état du 3 nov
// 4. Importe messages conversation du 01-03 nov
// 5. Crée .git-rewind-info.json
// 6. Nouvelle session #10
// 7. Change CWD + contexte agent
```

**Règle de Permission STRICTE :**
```
🔴 INTERDIT: Appeler sans explication détaillée
✅ REQUIS: Plan complet en 4+ points + approbation

Example détaillé:
"Je vais effectuer un Git rewind pour revenir au 3 novembre :

📋 **Plan d'action :**
1. Créer nouveau répertoire : ~/rewind-nov-03
2. Extraire code Git à l'état du commit du 3 novembre
   Estimation : ~127 fichiers
3. Importer conversation du 01/11 au 03/11
   Estimation : ~40 messages
4. Créer branche Git : rewind-2025-11-03
5. Session actuelle (#1) reste intacte

⚠️ **Cette opération va :**
- Créer ~/rewind-nov-03/ avec code du 3 nov
- Charger seulement les messages du 1-3 nov
- Synchroniser état conversation + code à cette date

**Confirmez-vous cette opération ?**"

User: "Oui, vas-y"

→ ALORS appeler session_rewind(...)
```

**Usage LLM :**
```
User: "Reviens au 3 novembre, je veux reprendre depuis cet état"

LLM: [Appelle session_list pour identifier la session]

LLM: "Je vais effectuer un Git rewind pour revenir au 3 novembre :

📋 **Plan :**
1. Créer ~/rewind-03-nov/
2. Extraire repository Git au commit du 3 novembre
   - Commits trouvés : 5 (du 01/11 au 03/11)
   - Commit cible : mno345 (3 nov, 18:45)
   - Fichiers estimés : 127
3. Importer conversation du 01/11 au 03/11
   - Messages estimés : 40
4. Créer branche rewind-2025-11-03

⚠️ **Impacts :**
- Nouveau répertoire créé
- Code à l'état du 3 novembre
- Conversation filtrée (01-03 nov)
- Session originale (#1) intacte

**Dois-je procéder ?**"

User: "Oui"

LLM: [Appelle session_rewind({
       target_directory: "~/rewind-03-nov",
       date_range_start: "2025-11-01",
       date_range_end: "2025-11-03",
       from_session_id: 1
     })]

LLM: "✅ Git rewind terminé !

🔄 Session #10 créée
📂 Répertoire : ~/rewind-03-nov
🌳 Branche Git : rewind-2025-11-03
📝 Commit : mno345 (3 nov 2025, 18:45)
📁 Fichiers : 127 extraits
💬 Messages : 40 importés (01-03 nov)

Nous sommes maintenant dans l'état exact du 3 novembre.
Code ET conversation synchronisés.

Que voulez-vous faire maintenant ?"
```

---

## 🔐 Système de Permissions

| Tool | Permission | Règle |
|------|-----------|-------|
| `session_list` | ❌ Aucune | Lecture seule, toujours autorisé |
| `session_switch` | ✅ Toujours | Expliquer + attendre confirmation |
| `session_new` | ⚠️ Conditionnel | Si nouveau répertoire OU filtrage |
| `session_rewind` | 🔴 Critique | Plan détaillé + approbation explicite |

### **Modèle de Demande de Permission**

```
🤖 LLM: "Je vais [ACTION].

📋 **Ce que je vais faire :**
1. [Étape 1 détaillée]
2. [Étape 2 détaillée]
3. [Étape 3 détaillée]

⚠️ **Impacts :**
- [Impact 1]
- [Impact 2]
- [Impact 3]

**Confirmez-vous ?**"

👤 User: "Oui" / "Ok" / "Vas-y" / "D'accord"

→ LLM appelle le tool
```

---

## 🔧 Git Workflow

### **Important : Pas de Tools Git Spéciaux**

```
❌ PAS DE: git_status, git_commit, git_push, git_add
✅ UTILISER: bash tool directement

Pourquoi ?
- Les LLMs connaissent déjà Git
- Tools spéciaux ajoutent charge cognitive
- bash tool fonctionne parfaitement
```

### **Exemple de Workflow Git**

```
User: "Ajoute un cache Redis dans src/api.ts"

LLM: [Modifie src/api.ts]
LLM: [Appelle bash: git add src/api.ts]
LLM: [Appelle bash: git commit -m "feat(api): add Redis caching"]
LLM: "✅ Ajouté cache Redis.
      📝 Committed: feat(api): add Redis caching (abc123)
      🌳 Branch: main"

User: "Push sur GitHub"

LLM: [Appelle bash: git push origin main]
LLM: "🚀 Pushed to origin/main"
```

---

## 📊 Comparaison : Avant / Après

| Capacité | Avant | Après |
|----------|-------|-------|
| **LLM liste sessions** | ❌ Impossible | ✅ session_list |
| **LLM change session** | ❌ Impossible | ✅ session_switch (avec permission) |
| **LLM crée branche** | ❌ Impossible | ✅ session_new |
| **LLM Git rewind** | ❌ Impossible | ✅ session_rewind (avec permission) |
| **Permissions** | ❌ Aucun système | ✅ Système robuste |
| **Git confusion** | ⚠️ Tools redondants | ✅ bash tool natif |

---

## 💡 Scénarios d'Usage

### **Scénario 1 : Découverte de Sessions**

```
User: "J'ai oublié où j'en étais, montre-moi mes sessions"

LLM: [Appelle session_list]
LLM: "Vous avez 3 sessions actives :

1. Session #1 - WDIMQ (300 messages)
   Dernier message : "Implémente ColPali"
   Dernière activité : il y a 2 heures

2. Session #2 - ColPali (40 messages)  
   Dernier message : "Ajoute vectorisation"
   Dernière activité : il y a 3 jours

3. Session #3 - TenderWatch (50 messages)
   Dernier message : "Parse les PDFs"
   Dernière activité : il y a 1 semaine

Actuellement : Session #1 (WDIMQ)"
```

### **Scénario 2 : Branching Expérimental**

```
User: "Je veux essayer une approche radicalement différente sans casser ce qu'on a fait"

LLM: "Je propose de créer une nouvelle session pour expérimenter :

📋 **Plan :**
- Créer session dans ~/experimental-approach
- Importer l'historique actuel (300 messages)
- Même modèle (gpt-4o)

Vous pourrez revenir à la session actuelle n'importe quand.
D'accord ?"

User: "Oui"

LLM: [Appelle session_new({
       directory: "~/experimental-approach",
       import_history: true
     })]
LLM: "✅ Session expérimentale créée ! 
      Vous pouvez casser tout ce que vous voulez ici.
      La session originale est intacte."
```

### **Scénario 3 : Time Travel**

```
User: "On a cassé quelque chose. Retournons au 10 novembre quand tout marchait"

LLM: [Appelle session_list pour comprendre le contexte]

LLM: "Je vais effectuer un Git rewind au 10 novembre :

📋 **Plan :**
1. Créer ~/working-state-10-nov/
2. Extraire code au commit du 10 novembre
   - Commit trouvé : def456 (10 nov, 14:30)
   - ~130 fichiers
3. Importer conversation jusqu'au 10 novembre
   - ~180 messages
4. Créer branche rewind-2025-11-10

Vous aurez l'état EXACT du 10 novembre (code + conversation).
Procéder ?"

User: "Go"

LLM: [Appelle session_rewind(...)]
LLM: "✅ Rewind terminé !
      Nous sommes le 10 novembre. Tout marche. 
      Que voulez-vous modifier ?"
```

### **Scénario 4 : Multi-Projet (WDIMQ/ColPali/TenderWatch)**

```
User: "J'ai tout mélangé entre WDIMQ, ColPali et TenderWatch. Aide-moi à nettoyer"

LLM: [Appelle session_list]
LLM: "Je vois Session #1 avec 300 messages mélangés.
      Je propose de séparer :

📋 **Plan de nettoyage :**
1. ColPali (messages du 01-10 nov) → ~/WDIMQ/ColPali
2. TenderWatch (messages du 10-20 nov) → ~/TenderWatch
3. WDIMQ pur (messages avant 1er nov) → ~/WDIMQ-pure

Chaque contexte sera isolé. D'accord ?"

User: "Parfait"

LLM: [Appelle session_new 3 fois avec date ranges]
LLM: "✅ Nettoyage terminé !
      3 sessions créées :
      - Session #2: ColPali pur (40 messages)
      - Session #3: TenderWatch pur (50 messages)
      - Session #4: WDIMQ pur (150 messages)
      
      Sur laquelle voulez-vous travailler ?"
```

---

## 📁 Fichiers Implémentés

### **`src/tools/session-tools.ts` (437 lignes)**

```typescript
// 4 fonctions exportées :
export async function executeSessionList(): Promise<ToolResult>
export async function executeSessionSwitch(args: { session_id: number }): Promise<ToolResult>
export async function executeSessionNew(args: {...}): Promise<ToolResult>
export async function executeSessionRewind(args: {...}): Promise<ToolResult>

// Fonction utilitaire :
function parseDate(dateStr: string): Date
// Supporte : DD/MM/YYYY, YYYY-MM-DD, ISO 8601, "today", "yesterday"
```

### **`src/utils/git-rewind.ts` (291 lignes)**

```typescript
export class GitRewindManager {
  async performRewind(...): Promise<RewindInfo>
  
  private async findCommitsInRange(...)
  private async findClosestCommitBefore(...)
  private async extractWithArchive(...)  // Default: lightweight
  private async extractWithClone(...)    // Optional: full history
  private async countFiles(...)
  private async isGitRepo(...)
  private async createRewindInfo(...)
  async updateRewindInfo(...)
}

export interface RewindInfo {
  rewind_date: Date;
  source_repo: string;
  source_session_id: number;
  date_range: { start: Date; end: Date };
  git_commits: GitCommit[];
  target_commit: string;
  files_copied: number;
  conversation_messages: number;
  extraction_method: 'archive' | 'clone';
}
```

### **`src/utils/exec-async.ts` (10 lignes)**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);
```

---

## 🎓 Principes de Design

### **1. DRY (Don't Repeat Yourself)**

```
Layer 3 (Core) implémente la logique
  ↓
Layer 2 (LLM Tools) appelle Layer 3
  ↓
Layer 1 (User Commands) appellera Layer 3 (Future)
```

### **2. Separation of Concerns**

- **Git operations** → bash tool (natif LLM)
- **Session management** → Tools spéciaux
- **Permissions** → Documentées dans descriptions

### **3. Safety First**

- Read-only : Pas de permission
- Modifications : Permission requise
- Critical ops : Explication + approbation

### **4. Clarity > Brevity**

```typescript
// Tool descriptions sont LONGUES et DÉTAILLÉES
description: "Perform Git rewind: synchronize conversation history AND code state to a specific date range. Creates new session in target directory with filtered conversation messages and Git repository at corresponding commit. **CRITICAL: This is the most powerful operation - ALWAYS explain the plan in detail and get explicit user permission before calling.** This modifies filesystem and Git state."

// Pourquoi ? LLMs ont besoin de contexte pour décider
```

---

## 🚀 Prochaines Étapes

### **Phase 4.4 : User Commands (Layer 1)**

```bash
# Commands utilisateur à implémenter
/list_sessions
/switch-session <id>
/new-session [options]

# Réutilisent Layer 3 (SessionManager, GitRewindManager)
```

### **Phase 4.5 : Options Avancées**

```bash
# Date parsing plus flexible
/new-session --from-date "3 days ago"
/new-session --date-range "last week"

# Opérations batch
/new-session --for-each-day-in-range

# Tags et favoris
/favorite-session 5
/sessions --favorites-only
```

### **Phase 5 : Fork/Archive/Delete**

```bash
session_fork({ from_session_id: 5 })
session_archive({ session_id: 3 })
session_delete({ session_id: 7, confirm: true })
```

---

## 🎉 Conclusion

**Grokinou permet maintenant aux LLMs de gérer les sessions de manière autonome**, avec :

✅ **Découverte** : session_list  
✅ **Navigation** : session_switch  
✅ **Branching** : session_new  
✅ **Time Travel** : session_rewind  
✅ **Safety** : Système de permissions  
✅ **Clarté** : Pas de confusion Git  

**C'est Git pour les conversations, accessible aux LLMs ! 🚀**

---

**Date:** 2025-11-25  
**Version:** 0.1.0  
**Commit:** c2f138c  
**Phase:** 4.3 Complete

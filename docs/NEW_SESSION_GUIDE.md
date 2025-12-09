# 🆕 `/new-session` - Guide Complet

## 🎯 Qu'est-ce que `/new-session` ?

La commande `/new-session` permet de créer **plusieurs sessions indépendantes** dans le **même répertoire**.

**Avant cette fonctionnalité :**
- ❌ Une seule session par répertoire
- ❌ Impossible de travailler sur plusieurs features en parallèle
- ❌ Confusion des contextes dans une seule conversation

**Après cette fonctionnalité :**
- ✅ Sessions multiples dans le même répertoire
- ✅ Contextes isolés pour chaque feature/topic
- ✅ Navigation fluide avec `/switch-session`

---

## 📋 Syntaxe

```bash
/new-session [options]
```

### **Options Disponibles**

| Option | Description | Exemple |
|--------|-------------|---------|
| (aucune) | Créer une session vide avec le modèle actuel | `/new-session` |
| `--import-history` | Copier tous les messages de la session actuelle | `/new-session --import-history` |
| `--model <name>` | Démarrer avec un modèle spécifique | `/new-session --model gpt-4o` |
| `--provider <name>` | Démarrer avec un provider spécifique | `/new-session --provider openai` |

### **Combinaisons d'Options**

```bash
# Session vide avec DeepSeek
/new-session --model deepseek-chat

# Session avec historique + GPT-4
/new-session --import-history --model gpt-4o

# Session OpenAI sans modèle spécifique (utilise le défaut du provider)
/new-session --provider openai
```

---

## 🚀 Cas d'Usage

### **1. Multiples Features en Parallèle**

**Scénario :** Travailler sur l'authentification ET l'API en même temps

```bash
cd ~/mon-projet

# Session 1 : Feature A (Auth)
grokinou-cli
User: "Implémente l'authentification OAuth avec Google et GitHub"
[...50 messages sur l'auth...]

# Créer Session 2 : Feature B (API)
/new-session
User: "Crée une API REST pour gérer les utilisateurs"
[...30 messages sur l'API...]

# Lister les sessions
/list_sessions
# Session #1 - "Implémente l'authentification OAuth..."
# Session #2 - "Crée une API REST pour gérer..."

# Navigation
/switch-session 1  # Retour à l'auth
/switch-session 2  # Retour à l'API
```

**Résultat :**
- ✅ Contexte auth complètement isolé de l'API
- ✅ Pas de confusion entre les deux features
- ✅ Navigation instantanée entre les deux

---

### **2. Expérimentation avec Différents Modèles**

**Scénario :** Tester plusieurs approches avec différents modèles

```bash
cd ~/my-app

# Session 1 : GPT-4o (approche conservatrice)
grokinou-cli
User: "Optimise la base de données"
[...discussion avec GPT-4o...]

# Session 2 : DeepSeek (approche expérimentale)
/new-session --model deepseek-chat
User: "Réécris complètement le système de cache"
[...discussion avec DeepSeek...]

# Session 3 : Claude (revue de code)
/new-session --model claude-3-5-sonnet-20241022
User: "Fais une revue de code complète"
[...discussion avec Claude...]

# Comparer les 3 approches
/list_sessions
/switch-session 1  # Voir l'approche GPT-4
/switch-session 2  # Voir l'approche DeepSeek
/switch-session 3  # Voir l'approche Claude
```

**Résultat :**
- ✅ Chaque modèle dans sa propre session
- ✅ Comparaison facile des approches
- ✅ Historique séparé pour chaque expérimentation

---

### **3. Import d'Historique pour Continuité de Contexte**

**Scénario :** Bifurquer une conversation tout en gardant le contexte

```bash
cd ~/projet-complexe

# Session 1 : 50 messages de contexte technique
grokinou-cli
User: "Explique l'architecture du système"
Assistant: [Explication détaillée...]
[...48 autres messages de contexte...]

# Bifurquer pour explorer une idée alternative
/new-session --import-history
User: "Maintenant, réécrivons tout en microservices"
[...exploration de l'approche microservices...]

# L'historique original reste intact
/switch-session 1
# → Retour à la conversation originale (architecture monolithique)
```

**Résultat :**
- ✅ Session 2 démarre avec **tout le contexte** de la session 1
- ✅ Session 1 reste **intacte** (pas modifiée par la bifurcation)
- ✅ Deux directions différentes à partir du même point de départ

---

### **4. Debug Urgent vs Développement Normal**

**Scénario :** Bug critique pendant le développement d'une feature

```bash
cd ~/production-app

# Session 1 : Développement Feature X
grokinou-cli
User: "Ajoute un système de notifications push"
[...développement en cours...]

# BUG CRITIQUE EN PRODUCTION
/new-session
User: "Bug urgent : timeout sur les requêtes SQL en production"
Assistant: "Analysons les logs..."
[...debug intense...]
[...fix appliqué...]

# Retour au développement Feature X
/switch-session 1
User: "Continue le système de notifications"
# → Reprend exactement où on s'était arrêté
```

**Résultat :**
- ✅ Session de debug **isolée** du développement en cours
- ✅ Pas de pollution du contexte de développement
- ✅ Retour instantané au développement après le fix

---

### **5. Sessions Thématiques (Frontend / Backend / DevOps)**

**Scénario :** Organiser par domaine technique

```bash
cd ~/full-stack-app

# Session 1 : Frontend
grokinou-cli --model claude-3-5-sonnet-20241022
User: "Créer un design system avec Tailwind"
[...50 messages frontend...]

# Session 2 : Backend
/new-session --model gpt-4o
User: "Architecture microservices avec Node.js"
[...40 messages backend...]

# Session 3 : DevOps
/new-session --model deepseek-chat
User: "Configuration Docker + Kubernetes"
[...30 messages devops...]

# Navigation par domaine
/list_sessions
# Session #1 - Frontend (Claude)
# Session #2 - Backend (GPT-4)
# Session #3 - DevOps (DeepSeek)

/switch-session 1  # Focus frontend
/switch-session 2  # Focus backend
/switch-session 3  # Focus infra
```

**Résultat :**
- ✅ Séparation claire des préoccupations
- ✅ Modèle optimal pour chaque domaine
- ✅ Historique spécialisé et facile à retrouver

---

## 🔄 Workflow Complet : Création → Navigation → Switch

```bash
# 1. Lancer grokinou dans un projet
cd ~/mon-projet
grokinou-cli
# → Session #1 créée automatiquement

# 2. Travailler sur Feature A
User: "Implémente le système de cache Redis"
[...conversation...]

# 3. Créer une nouvelle session pour Feature B
/new-session
# → Session #2 créée

# 4. Travailler sur Feature B
User: "Crée l'API REST pour les webhooks"
[...conversation...]

# 5. Lister toutes les sessions
/list_sessions
# Output:
# Session #1 - "Implémente le système de cache Redis"
# Session #2 - "Crée l'API REST pour les webhooks"

# 6. Basculer entre sessions
/switch-session 1  # Retour à la session cache
/switch-session 2  # Retour à la session webhooks

# 7. Créer une session expérimentale avec import
/new-session --import-history --model deepseek-chat
# → Session #3 avec tout l'historique de la session 2

# 8. Travailler sur l'expérimentation
User: "Maintenant essaie une approche radicalement différente"
[...expérimentation...]

# 9. Comparer avec l'approche originale
/switch-session 2  # Approche originale
/switch-session 3  # Approche expérimentale
```

---

## 📊 Message de Confirmation

Après avoir créé une session, tu reçois :

```
✅ **New Session Created** #3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Working Directory: /home/user/my-project
🤖 Provider: openai
📱 Model: gpt-4o
💬 Messages: 0
🕐 Created: 11/25/2025, 10:30:00 PM

📄 **Fresh Start**
   This is a brand new conversation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can now start a new conversation!

💡 Use /list_sessions to see all sessions
💡 Use /switch-session <id> to switch back
```

**Ou avec `--import-history` :**

```
✅ **New Session Created** #4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Working Directory: /home/user/my-project
🤖 Provider: openai
📱 Model: gpt-4o
💬 Messages: 50 (imported)
🕐 Created: 11/25/2025, 10:35:00 PM

📋 **History Imported** from previous session
   All 50 messages have been copied to the new session.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can now start a new conversation!

💡 Use /list_sessions to see all sessions
💡 Use /switch-session <id> to switch back
```

---

## ⚙️ Comportement Technique

### **1. Stockage dans SQLite**

Chaque session est enregistrée dans `~/.grok/conversations.db` :

```sql
-- Table sessions
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  working_dir TEXT,  -- Même répertoire pour plusieurs sessions
  default_provider TEXT,
  default_model TEXT,
  status TEXT,       -- 'active' pour la session en cours
  ...
);
```

**Plusieurs sessions peuvent avoir le même `working_dir` !**

### **2. Isolation des Contextes**

- ✅ Chaque session a son propre `id` unique
- ✅ Les messages sont stockés avec `session_id` → isolation parfaite
- ✅ L'auto-naming génère un nom unique pour chaque session
- ✅ Les statistiques sont calculées indépendamment

### **3. Import d'Historique**

Quand tu utilises `--import-history` :

1. Tous les messages de la session actuelle sont **copiés**
2. Les copies reçoivent un nouveau `session_id` (la nouvelle session)
3. Les timestamps sont mis à jour (timestamp de création)
4. L'original reste **intact** (pas de modification)

---

## 🎓 Bonnes Pratiques

### ✅ **DO**

1. **Créer une session par feature/topic**
   ```bash
   /new-session  # Pour chaque nouvelle feature
   ```

2. **Utiliser `--import-history` pour bifurquer**
   ```bash
   /new-session --import-history  # Garder le contexte
   ```

3. **Utiliser des modèles différents pour expérimenter**
   ```bash
   /new-session --model deepseek-chat  # Tester une approche
   ```

4. **Naviguer régulièrement avec `/list_sessions` et `/switch-session`**

### ❌ **DON'T**

1. **Ne crée pas 50 sessions pour des micro-tâches**
   - Limite-toi à 3-5 sessions actives par projet

2. **N'importe pas l'historique systématiquement**
   - `--import-history` seulement quand le contexte est nécessaire

3. **N'oublie pas de fermer les sessions terminées**
   - Utilise `/archive` (futur) pour archiver les sessions complétées

---

## 🔮 Futures Améliorations

- **`/new-session --from <id>`** : Créer à partir d'une session spécifique (pas forcément la courante)
- **`/new-session --name "<nom>"`** : Donner un nom explicite dès la création
- **`/fork-session <id>`** : Alias plus intuitif pour `--import-history`
- **`/new-session --cli`** : Flag CLI pour créer au lancement : `grokinou-cli --new-session`

---

## 📦 Intégration avec Autres Commandes

| Commande | Interaction avec `/new-session` |
|----------|--------------------------------|
| `/list_sessions` | Affiche toutes les sessions (y compris les nouvelles) |
| `/switch-session <id>` | Bascule vers n'importe quelle session créée |
| `/status` | Affiche les infos de la session actuelle |
| `/models` | Change le modèle dans la session actuelle (crée pas de nouvelle session) |

---

## 🎉 Résumé

**`/new-session`** complète le système multi-session de Grokinou :

1. ✅ **Phase 1-2** : Enrichissement BDD + `/list_sessions`
2. ✅ **Phase 3** : `/switch-session` avec changement de répertoire
3. ✅ **Phase 4** : `/new-session` **(CETTE FONCTIONNALITÉ)**
4. 🔜 **Phase 5** : `/fork-session` (copie pour expérimentation)
5. 🔜 **Phase 6** : Recherche cross-session

**Avec `/new-session`, tu peux maintenant exploiter PLEINEMENT le système multi-session ! 🚀**

---

**Date:** 2025-11-25  
**Version:** 0.1.0  
**Commit:** ccb3d23

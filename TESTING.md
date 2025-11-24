# 🧪 Guide de Test Complet - Grokinou

Ce guide couvre **TOUS** les tests à effectuer pour valider Grokinou.

---

## 📋 Table des Matières

1. [Tests de Base](#1-tests-de-base)
2. [Tests de Session Management](#2-tests-de-session-management)
3. [Tests Multi-Provider](#3-tests-multi-provider)
4. [Tests des Commandes](#4-tests-des-commandes)
5. [Tests de Features Avancées](#5-tests-de-features-avancées)
6. [Tests de Database](#6-tests-de-database)
7. [Tests de Performance](#7-tests-de-performance)
8. [Tests de Régression](#8-tests-de-régression)

---

## 1. Tests de Base

### 1.1 Installation

```bash
# Test 1: Build du projet
cd /home/zack/GROK_CLI/grok-cli
npm run build

# Résultat attendu: ✅ Pas d'erreurs TypeScript
```

```bash
# Test 2: Installation globale
npm link

# Résultat attendu: ✅ Commande 'grok' disponible
which grok
# Output: /usr/local/bin/grok (ou similaire)
```

```bash
# Test 3: Lancement basique
grok

# Résultat attendu: 
# ✅ Bannière "GROKINOU Based on Grok-CLI" affichée
# ✅ Message "Starting Grokinou Assistant based on Grok-CLI"
# ✅ Prompt interactif "❯ " visible
```

### 1.2 Configuration Initiale

```bash
# Test 4: Vérifier les fichiers de config
ls -la ~/.grok/

# Résultat attendu:
# ✅ ~/.grok/conversations.db (base SQLite)
# ✅ ~/.grok/user-settings.json (settings utilisateur)
# ✅ ~/.grok/debug.log (logs)
```

```bash
# Test 5: Vérifier la base de données
sqlite3 ~/.grok/conversations.db ".tables"

# Résultat attendu:
# messages
# schema_migrations
# sessions
```

```bash
# Test 6: Vérifier la version de migration
sqlite3 ~/.grok/conversations.db "SELECT * FROM schema_migrations;"

# Résultat attendu:
# version|applied_at
# 2|<timestamp>
```

---

## 2. Tests de Session Management

### 2.1 Création de Session

```bash
# Test 7: Créer une nouvelle session
mkdir /tmp/test-grokinou && cd /tmp/test-grokinou
grok
```

Dans Grokinou, envoyer :
```
Hello, this is my first test message
```

**Résultat attendu :**
- ✅ Réponse de l'AI
- ✅ Session créée dans la DB

**Vérification :**
```bash
sqlite3 ~/.grok/conversations.db "
SELECT id, working_dir, session_name, message_count 
FROM sessions 
ORDER BY id DESC 
LIMIT 1;
"

# Résultat attendu:
# <id>|/tmp/test-grokinou|Hello this is my first test message|2
```

### 2.2 Auto-Naming

```bash
# Test 8: Vérifier l'auto-naming
# (Continuer la session du Test 7)
```

Dans Grokinou :
```
/list_sessions
```

**Résultat attendu :**
```
📚 Sessions in Current Directory
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 Session #X
   📝 Name: Hello this is my first test message
   🤖 Provider: <provider>
   💬 Messages: 2
   🕐 Last Activity: just now
```

### 2.3 Real-Time Stats Update

```bash
# Test 9: Vérifier les stats en temps réel
```

**Étape 1 :** Envoyer plusieurs messages dans Grokinou
```
Message 2
Message 3
Message 4
```

**Étape 2 :** Vérifier les stats
```
/list_sessions
```

**Résultat attendu :**
- ✅ `message_count` augmente (devrait être ~8-10)
- ✅ `first_message_preview` = "Hello this is my first test message"
- ✅ `last_message_preview` = "Message 4" (ou réponse AI)

**Vérification DB directe :**
```bash
sqlite3 ~/.grok/conversations.db "
SELECT 
  session_name, 
  message_count, 
  total_tokens,
  first_message_preview,
  last_message_preview
FROM sessions 
WHERE working_dir = '/tmp/test-grokinou';
"
```

### 2.4 Session Restoration

```bash
# Test 10: Restauration de session
# (Sortir de grok avec Ctrl+C deux fois)
cd /tmp/test-grokinou
grok
```

**Résultat attendu :**
- ✅ Historique de conversation restauré
- ✅ Messages précédents visibles
- ✅ Provider/Model restaurés

**Vérification :**
```bash
# Dans grok:
/status

# Résultat attendu:
# 🤖 Model: <dernier model utilisé>
# 📝 Provider: <dernier provider utilisé>
```

### 2.5 Multi-Session par Directory

```bash
# Test 11: Session avec message count prioritaire
cd /tmp/test-grokinou
grok
# Envoyer 5 messages
# Quitter

# Créer une nouvelle session vide
cd /tmp/test-grokinou
grok --new  # (si implémenté, sinon supprimer manuellement la session)
# Quitter immédiatement

# Relancer
grok

# Résultat attendu:
# ✅ La session avec le plus de messages est restaurée (pas la vide)
```

---

## 3. Tests Multi-Provider

### 3.1 Configuration des API Keys

```bash
# Test 12: Configurer les API keys
grok
```

**Dans Grokinou :**
```
/apikey grok <your-grok-key>
/apikey openai <your-openai-key>
/apikey claude <your-claude-key>
/apikey mistral <your-mistral-key>
/apikey deepseek <your-deepseek-key>
```

**Résultat attendu :**
```
✅ Set API key for <provider>
📝 Saved to: ~/.grok/user-settings.json
🔒 Key masked: xx-***xxx
```

**Vérification :**
```bash
cat ~/.grok/user-settings.json | jq '.apiKeys'

# Résultat attendu:
# {
#   "grok": "xai-...",
#   "openai": "sk-...",
#   "claude": "sk-ant-...",
#   "mistral": "...",
#   "deepseek": "..."
# }
```

### 3.2 Switch de Model

```bash
# Test 13: Lister les modèles disponibles
```

**Dans Grokinou :**
```
/models
```

**Résultat attendu :**
```
Available Models:
─────────────────────────────────────────

🤖 Grok Models (xai):
  1. grok-beta
  2. grok-vision-beta

🤖 OpenAI Models (openai):
  3. gpt-4o
  4. gpt-4-turbo
  5. gpt-3.5-turbo
  ...

🤖 Claude Models (anthropic):
  ...
```

```bash
# Test 14: Changer de modèle
```

**Dans Grokinou :**
```
/models gpt-4o
```

**Résultat attendu :**
```
✅ Switched to gpt-4o
📝 Provider: openai
🔗 Endpoint: https://api.openai.com/v1
💾 Saved to: .grok/settings.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Identity Verification:
🤖 AI Response: "I'm GPT-4o..."
📋 API Metadata: gpt-4o
```

```bash
# Test 15: Vérifier le switch dans la DB
sqlite3 ~/.grok/conversations.db "
SELECT default_provider, default_model 
FROM sessions 
WHERE id = (SELECT MAX(id) FROM sessions);
"

# Résultat attendu:
# openai|gpt-4o
```

### 3.3 Test de Tous les Providers

**Test 16-20 : Tester chaque provider**

```bash
# Test 16: Grok
/models grok-beta
Bonjour Grok, qui es-tu ?
# ✅ Vérifier que Grok répond

# Test 17: OpenAI
/models gpt-4o
Bonjour ChatGPT, qui es-tu ?
# ✅ Vérifier que GPT répond

# Test 18: Claude
/models claude-sonnet-4.5
Bonjour Claude, qui es-tu ?
# ✅ Vérifier que Claude répond

# Test 19: Mistral
/models mistral-large-latest
Bonjour Mistral, qui es-tu ?
# ✅ Vérifier que Mistral répond (pas d'erreur 400)

# Test 20: DeepSeek
/models deepseek-chat
Bonjour DeepSeek, qui es-tu ?
# ✅ Vérifier que DeepSeek répond
```

---

## 4. Tests des Commandes

### 4.1 Commandes de Base

```bash
# Test 21: /help
```

**Dans Grokinou :**
```
/help
```

**Résultat attendu :**
```
Grok CLI Help:

Built-in Commands:
  /clear      - Clear chat history
  /help       - Show this help
  /status     - Show current model and provider info
  /models     - Switch between available models
  /list_sessions - List all sessions in current directory
  /search <query> - Search in conversation history
  /exit       - Exit application
  ...
```

```bash
# Test 22: /status
```

```
/status
```

**Résultat attendu :**
```
📊 Current Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 Model: gpt-4o
📝 Provider: openai
🔗 Endpoint: https://api.openai.com/v1
🔑 API Key: sk-proj-pL...xxx
📁 Work Dir: /tmp/test-grokinou
```

```bash
# Test 23: /clear
```

```
/clear
```

**Résultat attendu :**
- ✅ Historique effacé de l'écran
- ✅ Conversation continue dans la DB

```bash
# Test 24: /list_sessions
```

```
/list_sessions
```

**Résultat attendu :**
```
📚 Sessions in Current Directory
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Working Directory: /tmp/test-grokinou
📊 Total Sessions: 1

🟢 Session #X
   📝 Name: Hello this is my first test message
   🤖 Provider: openai
   📱 Model: gpt-4o
   💬 Messages: 15
   🎯 Tokens: 1,234
   🕐 Last Activity: just now
   ...
```

### 4.2 Commandes Avancées

```bash
# Test 25: /search
```

```
/search first message
```

**Résultat attendu :**
- ✅ Split-screen UI (conversation à gauche, résultats à droite)
- ✅ Messages contenant "first message" surlignés
- ✅ Navigation avec flèches ↑↓
- ✅ Ctrl+S pour copier au clipboard

```bash
# Test 26: /model-default
```

```
/model-default gpt-4o
```

**Résultat attendu :**
```
✅ Set gpt-4o as global default model
📝 Saved to: ~/.grok/user-settings.json

ℹ️  Current session still using: <current-model>
💡 Use /models gpt-4o to switch this session too
```

**Vérification :**
```bash
cat ~/.grok/user-settings.json | jq '.defaultModel'
# "gpt-4o"
```

---

## 5. Tests de Features Avancées

### 5.1 Paste Management

```bash
# Test 27: Small paste (< 500 chars)
```

**Dans Grokinou :**
1. Copier un texte de ~300 caractères
2. Coller (Ctrl+V)

**Résultat attendu :**
- ✅ Texte s'affiche normalement (pas de placeholder)
- ✅ Newlines remplacés par espaces
- ✅ Wrap correct dans le cadre du prompt

```bash
# Test 28: Large paste (> 500 chars)
```

1. Copier un texte de ~2000 caractères
2. Coller

**Résultat attendu :**
```
❯ [Pasted 2,000 chars]
```
- ✅ Placeholder affiché
- ✅ Contenu complet envoyé à l'AI sur submission

```bash
# Test 29: Multiple pastes
```

1. Coller texte 1 (600 chars)
2. Taper "et aussi"
3. Coller texte 2 (800 chars)

**Résultat attendu :**
```
❯ [Pasted 600 chars] et aussi [Pasted 800 chars]
```
- ✅ Espace automatique entre placeholders
- ✅ Les deux contenus envoyés à l'AI

```bash
# Test 30: Very large paste (> 100,000 chars)
```

1. Copier un très gros fichier (ex: package-lock.json)
2. Coller

**Résultat attendu :**
- ✅ Un seul placeholder (pas multiples)
- ✅ Pas de débordement visuel
- ✅ Nombre formaté : `[Pasted 450,000 chars]`

### 5.2 Image Path Detection

```bash
# Test 31: Paste d'un chemin d'image
```

1. Créer une image de test :
```bash
convert -size 1920x1080 xc:blue /tmp/test.png
```

2. Dans terminal, copier le chemin : `/tmp/test.png`
3. Coller dans Grokinou

**Résultat attendu :**
```
❯ [test.png 1920x1080]
```
- ✅ Placeholder magenta
- ✅ Dimensions détectées
- ✅ Chemin complet envoyé à l'AI

```bash
# Test 32: Paste de texte avec chemin d'image
```

Coller :
```
Voici mon screenshot: /tmp/test.png
Et aussi ceci: /tmp/autre.jpg
```

**Résultat attendu :**
```
❯ Voici mon screenshot: [test.png 1920x1080]
Et aussi ceci: [autre.jpg WxH]
```

### 5.3 Input History

```bash
# Test 33: Navigation dans l'historique
```

1. Envoyer message 1 : "Message A"
2. Envoyer message 2 : "Message B"
3. Envoyer message 3 : "Message C"
4. Appuyer sur ↑

**Résultat attendu :**
- ✅ "Message C" s'affiche
- ↑ → "Message B"
- ↑ → "Message A"
- ↓ → "Message B"
- ↓ → "Message C"
- ↓ → vide

### 5.4 Enhanced Input

```bash
# Test 34: Shortcuts clavier
```

Tester tous les shortcuts :

| Shortcut | Action | Test |
|----------|--------|------|
| **Ctrl+A** | Début de ligne | Taper "hello", Ctrl+A, le curseur doit être au début |
| **Ctrl+E** | Fin de ligne | Taper "hello", Ctrl+A, Ctrl+E, curseur à la fin |
| **Ctrl+W** | Delete word | Taper "hello world", Ctrl+W → "hello " |
| **Ctrl+K** | Delete to end | Taper "hello world", aller au milieu, Ctrl+K → "hel" |
| **Ctrl+U** | Delete to start | Taper "hello world", aller au milieu, Ctrl+U → "orld" |
| **Ctrl+←** | Move left by word | Taper "hello world", Ctrl+← → curseur sur "hello" |
| **Ctrl+→** | Move right by word | Taper "hello world", Ctrl+A, Ctrl+→ → curseur sur "world" |
| **Ctrl+C** | Clear input (x1) | Taper "hello", Ctrl+C → input vide |
| **Ctrl+C** | Exit (x2) | Ctrl+C, Ctrl+C → exit |

---

## 6. Tests de Database

### 6.1 Integrity Checks

```bash
# Test 35: Vérifier l'intégrité de la DB
sqlite3 ~/.grok/conversations.db "PRAGMA integrity_check;"

# Résultat attendu: ok
```

```bash
# Test 36: Vérifier les indexes
sqlite3 ~/.grok/conversations.db "SELECT name FROM sqlite_master WHERE type='index';"

# Résultat attendu:
# idx_sessions_name
# idx_sessions_created_at
# idx_sessions_favorite
# idx_sessions_message_count
```

### 6.2 Data Consistency

```bash
# Test 37: Vérifier message_count vs COUNT(*)
sqlite3 ~/.grok/conversations.db "
SELECT 
  s.id,
  s.message_count as stored_count,
  COUNT(m.id) as actual_count,
  CASE 
    WHEN s.message_count = COUNT(m.id) THEN '✅ OK'
    ELSE '❌ MISMATCH'
  END as status
FROM sessions s
LEFT JOIN messages m ON m.session_id = s.id
GROUP BY s.id;
"

# Résultat attendu: Tous les status = ✅ OK
```

```bash
# Test 38: Vérifier total_tokens vs SUM(token_count)
sqlite3 ~/.grok/conversations.db "
SELECT 
  s.id,
  s.total_tokens as stored_tokens,
  COALESCE(SUM(m.token_count), 0) as actual_tokens,
  CASE 
    WHEN s.total_tokens = COALESCE(SUM(m.token_count), 0) THEN '✅ OK'
    ELSE '❌ MISMATCH'
  END as status
FROM sessions s
LEFT JOIN messages m ON m.session_id = s.id
GROUP BY s.id;
"

# Résultat attendu: Tous les status = ✅ OK
```

### 6.3 Migration Tests

```bash
# Test 39: Vérifier les migrations
sqlite3 ~/.grok/conversations.db "SELECT * FROM schema_migrations ORDER BY version;"

# Résultat attendu:
# 2|<timestamp>
```

```bash
# Test 40: Vérifier les colonnes ajoutées par migration 002
sqlite3 ~/.grok/conversations.db "PRAGMA table_info(sessions);" | grep -E "session_name|message_count|total_tokens"

# Résultat attendu:
# <index>|session_name|TEXT|0||1
# <index>|message_count|INTEGER|0|0|0
# <index>|total_tokens|INTEGER|0|0|0
```

---

## 7. Tests de Performance

### 7.1 Response Time

```bash
# Test 41: Temps de réponse (small prompt)
```

Dans Grokinou :
```
Hello
```

**Résultat attendu :**
- ✅ Réponse en < 5 secondes (selon model)
- ✅ Stats affichées après réponse : `(X tokens in Y.Ys)`

```bash
# Test 42: Temps de réponse (large context)
```

1. Envoyer 50 messages de suite
2. Envoyer un nouveau message

**Résultat attendu :**
- ✅ Réponse en temps raisonnable (< 10s)
- ✅ Pas d'erreur de timeout

### 7.2 Database Performance

```bash
# Test 43: Temps d'insertion (benchmark)
time node test/test-list-sessions.js

# Résultat attendu: < 500ms
```

```bash
# Test 44: Temps de updateSessionStats
```

Créer un script de benchmark :
```javascript
// benchmark-stats.js
import { SessionManagerSQLite } from './dist/utils/session-manager-sqlite.js';
const sm = SessionManagerSQLite.getInstance();
const session = sm.getCurrentSession();
console.time('updateSessionStats');
sm.sessionRepo.updateSessionStats(session.id);
console.timeEnd('updateSessionStats');
```

```bash
node benchmark-stats.js

# Résultat attendu: updateSessionStats: < 10ms
```

---

## 8. Tests de Régression

### 8.1 Session Restoration Bug

```bash
# Test 45: Bug fix - Session restoration avec provider différent
```

**Scénario :**
1. Créer session avec Grok : `grok`, `/models grok-beta`, envoyer messages
2. Quitter
3. Relancer : `grok`

**Résultat attendu :**
- ✅ Session restaurée (PAS une nouvelle session vide)
- ✅ Historique visible
- ✅ Provider = grok

**Vérification :**
```bash
sqlite3 ~/.grok/conversations.db "SELECT COUNT(*) FROM sessions WHERE working_dir = '$PWD';"
# Résultat attendu: 1 (pas 2)
```

### 8.2 Mistral 400 Error Fix

```bash
# Test 46: Bug fix - Mistral 400 error
```

1. `/models mistral-large-latest`
2. Envoyer : "Bonjour Mistral"

**Résultat attendu :**
- ✅ Réponse de Mistral (pas d'erreur 400)
- ✅ Pas de message "status code (no body)"

### 8.3 Paste Rendering Bug

```bash
# Test 47: Bug fix - Small paste invisible
```

1. Copier 300 caractères
2. Coller

**Résultat attendu :**
- ✅ Texte visible dans le prompt
- ✅ Pas de texte en dehors du cadre

```bash
# Test 48: Bug fix - Large paste multiple placeholders
```

1. Copier 450,000 caractères
2. Coller

**Résultat attendu :**
- ✅ UN SEUL placeholder
- ✅ Pas de débordement de dashes `────`

---

## 🚀 Tests Automatisés (Quick Run)

### Test Suite Complet

```bash
# 1. Tests API
cd /home/zack/GROK_CLI/grok-cli
node test/test-list-sessions.js

# 2. Tests DB
./test/test-auto-stats.sh

# 3. Tests d'intégrité
sqlite3 ~/.grok/conversations.db "PRAGMA integrity_check;"

# 4. Vérifier data consistency
sqlite3 ~/.grok/conversations.db "
SELECT 
  COUNT(*) as total_sessions,
  SUM(message_count) as total_messages,
  SUM(total_tokens) as total_tokens
FROM sessions;
"

# 5. Build & install
npm run build && npm link
```

### Checklist Interactive

```bash
# 6. Tests interactifs (à faire manuellement)
grok
# → Envoyer message
# → /list_sessions
# → /status
# → /models
# → Coller gros texte
# → /search <query>
# → Ctrl+C x2 pour quitter
```

---

## 📊 Résumé des Tests

| Catégorie | Tests | Status |
|-----------|-------|--------|
| **Base** | 6 tests | Installation, config, DB |
| **Session Management** | 6 tests | Création, auto-naming, restoration |
| **Multi-Provider** | 9 tests | API keys, switch, tous providers |
| **Commandes** | 5 tests | /help, /status, /clear, /list_sessions, /search |
| **Features Avancées** | 8 tests | Paste, images, history, shortcuts |
| **Database** | 6 tests | Integrity, indexes, migrations |
| **Performance** | 4 tests | Response time, DB benchmarks |
| **Régression** | 3 tests | Bug fixes validés |

**Total : 48 tests**

---

## ✅ Test Report Template

Après chaque session de test, remplir :

```
Date: ____/____/____
Version: v0.0.33
Testeur: ____________

┌─────────────────────┬────────┬──────────┐
│ Catégorie           │ Passés │ Échoués  │
├─────────────────────┼────────┼──────────┤
│ Base                │  /6    │          │
│ Session Management  │  /6    │          │
│ Multi-Provider      │  /9    │          │
│ Commandes           │  /5    │          │
│ Features Avancées   │  /8    │          │
│ Database            │  /6    │          │
│ Performance         │  /4    │          │
│ Régression          │  /3    │          │
├─────────────────────┼────────┼──────────┤
│ TOTAL               │  /48   │          │
└─────────────────────┴────────┴──────────┘

Notes:
- 
- 
```

---

**🎯 Pour tester rapidement, commencer par :**
1. `npm run build && npm link`
2. `node test/test-list-sessions.js`
3. `grok` → envoyer un message → `/list_sessions`
4. Vérifier DB : `./test/test-auto-stats.sh`

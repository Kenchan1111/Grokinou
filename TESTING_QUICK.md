# ⚡ Quick Testing Reference - Grokinou

Guide rapide pour tester les fonctionnalités essentielles en 5 minutes.

---

## 🚀 Quick Start (30 secondes)

```bash
# Build & Install
cd /home/zack/GROK_CLI/grok-cli
npm run build && npm link

# Launch
grok

# Send message
Hello Grokinou!
```

**✅ Vérifie :** Bannière GROKINOU, réponse AI, prompt interactif

---

## 🧪 Tests Automatisés (1 minute)

```bash
# Test 1: API listSessions()
node test/test-list-sessions.js

# Test 2: DB stats
./test/test-auto-stats.sh

# Test 3: DB integrity
sqlite3 ~/.grok/conversations.db "PRAGMA integrity_check;"
```

**✅ Résultats attendus :**
- Test 1: `✅ All tests completed!`
- Test 2: Session data affichée
- Test 3: `ok`

---

## 💬 Tests Interactifs (2 minutes)

### Commandes Essentielles

```bash
grok
```

| Commande | Test | Résultat Attendu |
|----------|------|------------------|
| `Hello` | Message basique | ✅ Réponse AI |
| `/status` | Configuration | ✅ Model, Provider, API key |
| `/models` | Liste models | ✅ Tous les providers |
| `/list_sessions` | Sessions | ✅ Liste avec stats |
| `/help` | Aide | ✅ Liste commandes |

---

## 🔄 Test Multi-Provider (1 minute)

```bash
# Dans grok:
/models gpt-4o
Hello ChatGPT
# ✅ Réponse OpenAI

/models claude-sonnet-4.5
Hello Claude
# ✅ Réponse Claude

/models mistral-large-latest
Hello Mistral
# ✅ Réponse Mistral (pas d'erreur 400)
```

---

## 📊 Test Session Management (30 secondes)

```bash
# Nouvelle session
mkdir /tmp/test-session && cd /tmp/test-session
grok
```

```
This is my first test message
```

```
/list_sessions
```

**✅ Vérifie :**
- Session name = "This is my first test message"
- Message count = 2
- Last activity = "just now"

**Quitter et relancer :**
```bash
# Ctrl+C x2
grok
```

**✅ Vérifie :**
- Historique restauré
- Même provider/model

---

## 📋 Test Paste (30 secondes)

### Small Paste
1. Copier ~300 caractères
2. Coller dans grok

**✅ Vérifie :** Texte visible, pas de placeholder

### Large Paste
1. Copier ~2000 caractères
2. Coller

**✅ Vérifie :** `[Pasted 2,000 chars]` affiché

---

## 🗄️ Test Database (30 secondes)

```bash
# Vérifier sessions
sqlite3 ~/.grok/conversations.db "SELECT id, session_name, message_count FROM sessions LIMIT 5;"

# Vérifier consistency
sqlite3 ~/.grok/conversations.db "
SELECT 
  s.id,
  s.message_count as stored,
  COUNT(m.id) as actual,
  CASE WHEN s.message_count = COUNT(m.id) THEN '✅' ELSE '❌' END
FROM sessions s
LEFT JOIN messages m ON m.session_id = s.id
GROUP BY s.id;
"
```

**✅ Vérifie :** Tous les status = ✅

---

## 🐛 Tests de Régression (30 secondes)

### Bug #1: Session Restoration
```bash
cd /tmp/test-session
grok
# ✅ Historique restauré (PAS nouvelle session vide)
```

### Bug #2: Mistral 400
```bash
grok
/models mistral-large-latest
Hello
# ✅ Pas d'erreur "400 status code (no body)"
```

### Bug #3: Paste Rendering
```bash
# Coller 300 chars
# ✅ Texte visible dans le prompt
```

---

## 📊 Checklist Rapide

Cocher après chaque test :

```
Installation & Lancement
  [ ] npm run build (sans erreurs)
  [ ] npm link (commande grok disponible)
  [ ] grok lance l'interface

Session Management
  [ ] Session créée automatiquement
  [ ] Auto-naming fonctionne
  [ ] Stats en temps réel (message_count)
  [ ] Restoration fonctionne

Multi-Provider
  [ ] /models liste tous les providers
  [ ] Switch vers OpenAI fonctionne
  [ ] Switch vers Claude fonctionne
  [ ] Switch vers Mistral fonctionne (pas 400)

Commandes
  [ ] /status affiche config
  [ ] /list_sessions affiche sessions
  [ ] /help affiche aide
  [ ] /search fonctionne

Features
  [ ] Small paste (texte visible)
  [ ] Large paste (placeholder)
  [ ] Input history (↑↓)
  [ ] Ctrl+A, Ctrl+E, etc.

Database
  [ ] PRAGMA integrity_check = ok
  [ ] message_count = COUNT(*)
  [ ] Migrations à jour (version 2)

Performance
  [ ] Réponse AI < 10s
  [ ] node test/test-list-sessions.js < 1s
  [ ] updateSessionStats < 10ms
```

---

## 🆘 Troubleshooting Rapide

| Problème | Solution |
|----------|----------|
| `grok: command not found` | `npm link` |
| Build errors | `rm -rf dist && npm run build` |
| DB locked | `pkill -f grok` |
| Session vide restaurée | Bug corrigé, vérifier version |
| Mistral 400 error | Bug corrigé, vérifier version |
| Paste invisible | Bug corrigé, vérifier version |

---

## 📚 Documentation Complète

Pour tests détaillés → **[TESTING.md](./TESTING.md)** (926 lignes, 48 tests)

Pour tests automatisés → **[test/README.md](./test/README.md)**

---

**🎯 Temps total : ~5 minutes**

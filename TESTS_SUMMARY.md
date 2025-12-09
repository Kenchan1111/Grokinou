# 📊 Récapitulatif des Tests - Grokinou

Guide visuel ultra-rapide : **toutes les commandes en un coup d'œil**

---

## 🎯 Tests Essentiels (Copier-Coller)

### ✅ 1. Build & Install
```bash
cd /home/zack/GROK_CLI/grok-cli
npm run build
npm link
which grok  # Doit retourner un chemin
```

### ✅ 2. Tests Automatisés
```bash
# Test API
node test/test-list-sessions.js

# Test DB Stats
./test/test-auto-stats.sh

# Test Intégrité DB
sqlite3 ~/.grok/conversations.db "PRAGMA integrity_check;"

# Test Consistency
sqlite3 ~/.grok/conversations.db "
SELECT 
  s.id,
  s.message_count,
  COUNT(m.id) as actual,
  CASE WHEN s.message_count = COUNT(m.id) THEN '✅' ELSE '❌' END
FROM sessions s
LEFT JOIN messages m ON m.session_id = s.id
GROUP BY s.id;
"
```

### ✅ 3. Test Interactif Basique
```bash
grok
```

Puis taper :
```
Hello Grokinou, test message
/status
/list_sessions
/models
/help
```

### ✅ 4. Test Session Management
```bash
mkdir /tmp/test-grokinou && cd /tmp/test-grokinou
grok
```

Taper :
```
This is my first test message
/list_sessions
```

**Vérifier :**
- ✅ Session name = "This is my first test message"
- ✅ Message count = 2

**Quitter et relancer :**
```bash
# Ctrl+C x2 pour quitter
grok
# Historique doit être restauré ✅
```

### ✅ 5. Test Multi-Provider
```bash
grok
```

```
/models gpt-4o
Hello ChatGPT

/models claude-sonnet-4.5
Hello Claude

/models mistral-large-latest
Hello Mistral

/models deepseek-chat
Hello DeepSeek
```

**Vérifier :** Chaque provider répond correctement

### ✅ 6. Test Paste
```bash
grok
```

**Small paste (300 chars) :**
```
[Coller un texte de ~300 caractères]
```
**Vérifie :** Texte visible

**Large paste (2000 chars) :**
```
[Coller un texte de ~2000 caractères]
```
**Vérifie :** `[Pasted 2,000 chars]` affiché

### ✅ 7. Test Database Direct
```bash
# Sessions actives
sqlite3 ~/.grok/conversations.db "SELECT id, session_name, message_count, status FROM sessions ORDER BY last_activity DESC LIMIT 5;"

# Messages d'une session
sqlite3 ~/.grok/conversations.db "SELECT role, substr(content, 1, 50) FROM messages WHERE session_id = 1 LIMIT 5;"

# Stats globales
sqlite3 ~/.grok/conversations.db "
SELECT 
  COUNT(*) as total_sessions,
  SUM(message_count) as total_messages,
  SUM(total_tokens) as total_tokens
FROM sessions;
"

# Migrations
sqlite3 ~/.grok/conversations.db "SELECT * FROM schema_migrations;"
```

---

## 🐛 Tests de Régression (Bugs Corrigés)

### Bug #1: Session Restoration avec Provider Différent
```bash
cd /tmp/test-session
grok
/models mistral-large-latest
Hello
# Quitter (Ctrl+C x2)
grok
# ✅ Historique restauré (PAS nouvelle session vide)
# ✅ Provider = mistral
```

### Bug #2: Mistral 400 Error
```bash
grok
/models mistral-large-latest
Hello Mistral
# ✅ PAS d'erreur "400 status code (no body)"
```

### Bug #3: Small Paste Invisible
```bash
grok
# [Coller 300 caractères]
# ✅ Texte visible dans le prompt
```

### Bug #4: Large Paste Multiple Placeholders
```bash
grok
# [Coller 450,000 caractères]
# ✅ UN SEUL placeholder [Pasted 450,000 chars]
# ✅ Pas de débordement visuel
```

---

## ⌨️ Test Shortcuts Clavier

Dans `grok` :

| Shortcut | Action | Test Rapide |
|----------|--------|-------------|
| **↑** | History prev | Taper 3 messages, puis ↑↑↑ |
| **↓** | History next | Après ↑↑↑, faire ↓↓↓ |
| **Ctrl+A** | Début ligne | Taper "hello", Ctrl+A |
| **Ctrl+E** | Fin ligne | Après Ctrl+A, Ctrl+E |
| **Ctrl+W** | Delete word | Taper "hello world", Ctrl+W |
| **Ctrl+K** | Delete to end | Taper "hello world", ←←←, Ctrl+K |
| **Ctrl+U** | Delete to start | Taper "hello world", Ctrl+U |
| **Ctrl+←** | Move word left | Taper "hello world", Ctrl+← |
| **Ctrl+→** | Move word right | Après Ctrl+A, Ctrl+→ |
| **Ctrl+C** | Clear input | Taper "hello", Ctrl+C |
| **Ctrl+C×2** | Exit | Ctrl+C, Ctrl+C |

---

## 📋 Checklist Complète

```
[ ] npm run build (sans erreurs)
[ ] npm link (grok disponible)
[ ] grok lance l'interface
[ ] Bannière GROKINOU affichée
[ ] Message "Starting Grokinou Assistant..."
[ ] Envoi message → réponse AI
[ ] /status fonctionne
[ ] /list_sessions fonctionne
[ ] /models liste tous les providers
[ ] /help affiche commandes
[ ] /search fonctionne
[ ] Switch vers OpenAI fonctionne
[ ] Switch vers Claude fonctionne
[ ] Switch vers Mistral fonctionne (pas 400)
[ ] Switch vers DeepSeek fonctionne
[ ] Session créée automatiquement
[ ] Auto-naming fonctionne
[ ] message_count update en temps réel
[ ] total_tokens calculé
[ ] first_message_preview correct
[ ] last_message_preview correct
[ ] Session restoration fonctionne
[ ] Historique restauré au redémarrage
[ ] Provider/Model restaurés
[ ] Small paste visible
[ ] Large paste → placeholder
[ ] Image path → placeholder magenta
[ ] Input history (↑↓) fonctionne
[ ] Tous les shortcuts clavier fonctionnent
[ ] node test/test-list-sessions.js → PASS
[ ] ./test/test-auto-stats.sh → OK
[ ] PRAGMA integrity_check → ok
[ ] message_count = COUNT(*) → ✅
[ ] Migrations version 2
[ ] Pas de session vide restaurée (bug fix)
[ ] Pas d'erreur Mistral 400 (bug fix)
[ ] Paste rendering correct (bug fix)
```

**Total : 37 vérifications**

---

## 🆘 Dépannage Rapide

| Problème | Commande Solution |
|----------|-------------------|
| Build errors | `rm -rf dist node_modules && npm install && npm run build` |
| `grok: command not found` | `npm link` ou `npm install -g .` |
| DB locked | `pkill -f grok && rm -f ~/.grok/conversations.db-wal` |
| Session restoration fail | Vérifier `sqlite3 ~/.grok/conversations.db "SELECT * FROM sessions WHERE working_dir = '$PWD';"` |
| Mistral 400 | Mettre à jour le code (bug fix intégré) |
| Stats pas à jour | Vérifier migration 002 : `sqlite3 ~/.grok/conversations.db "SELECT * FROM schema_migrations;"` |

---

## 📚 Documentation

- **TESTING.md** : Guide complet (926 lignes, 48 tests détaillés)
- **TESTING_QUICK.md** : Guide rapide 5min
- **test/README.md** : Scripts de test automatisés
- **README.md** : Documentation projet

---

## 🚀 One-Liner Test Complet

```bash
cd /home/zack/GROK_CLI/grok-cli && \
npm run build && npm link && \
node test/test-list-sessions.js && \
./test/test-auto-stats.sh && \
sqlite3 ~/.grok/conversations.db "PRAGMA integrity_check;" && \
echo "✅ All automated tests passed!"
```

**Temps : ~1 minute**

Puis tests interactifs :
```bash
grok
# Hello
# /status
# /list_sessions
# /models
# Ctrl+C x2
```

**Temps : ~2 minutes**

---

**🎯 Total : 3 minutes pour tout valider**

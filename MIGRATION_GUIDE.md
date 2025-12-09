# 🔄 Guide de Migration JSONL → SQLite

## Résumé

Grok-CLI utilise maintenant **SQLite** pour stocker les conversations au lieu de fichiers JSONL. Ce guide vous aide à migrer votre historique existant.

---

## ✅ Ce qui a Changé

### Avant (JSONL)
```
.grok/
├── session.jsonl          # Toutes les conversations mélangées
└── session.state.json     # État de la session
```

### Après (SQLite)
```
~/.grok/
└── conversations.db       # Base de données unique
    ├── sessions table     # Conversations par workdir/provider
    └── messages table     # Tous les messages avec metadata
```

---

## 🚀 Migration Automatique

### Option 1 : Au Premier Lancement

La migration se fera **automatiquement** au premier lancement de grok-cli :

```bash
cd /home/zack/GROK_CLI/grok-cli
npm start
```

✅ Vos anciennes conversations seront importées dans SQLite
✅ Les fichiers JSONL seront sauvegardés en `.backup`

---

### Option 2 : Migration Manuelle

Si vous voulez migrer avant de lancer :

```bash
cd /home/zack/GROK_CLI/grok-cli
node dist/db/migrations/migrate-jsonl.js
```

**Output attendu :**
```
🔄 Starting JSONL → SQLite migration...

Found 1 JSONL file(s) to migrate:

📄 Processing: /home/zack/GROK_CLI/grok-cli/.grok/session.jsonl
   Found 2 session(s) based on time gaps
   Session 1: Created with ID 1
   ✅ Migrated 45 messages
   Session 2: Created with ID 2
   ✅ Migrated 23 messages
   📦 Backed up to: /home/zack/GROK_CLI/grok-cli/.grok/session.jsonl.backup
   ✅ Migration complete!

🎉 Migration finished!
```

---

## 🔍 Vérifier la Migration

### 1. Vérifier les sessions

```bash
sqlite3 ~/.grok/conversations.db "SELECT id, working_dir, default_provider, started_at FROM sessions;"
```

**Output attendu :**
```
1|/home/zack/GROK_CLI/grok-cli|grok|2024-01-15 10:30:00
2|/home/zack/GROK_CLI/grok-cli|grok|2024-01-16 14:20:00
```

### 2. Vérifier les messages

```bash
sqlite3 ~/.grok/conversations.db "SELECT COUNT(*) as total_messages FROM messages;"
```

**Output attendu :**
```
68
```

### 3. Vérifier par session

```bash
sqlite3 ~/.grok/conversations.db "
SELECT s.id, s.working_dir, COUNT(m.id) as msg_count 
FROM sessions s 
LEFT JOIN messages m ON s.id = m.session_id 
GROUP BY s.id;
"
```

---

## 🎯 Avantages SQLite

| Feature | JSONL | SQLite |
|---------|-------|--------|
| **Sessions par workdir** | ❌ | ✅ |
| **Multi-providers** | ❌ | ✅ |
| **Recherche rapide** | ❌ | ✅ |
| **Switch API en cours** | ❌ | ✅ |
| **Statistiques** | ❌ | ✅ |
| **Performance** | O(n) | O(log n) |

---

## 📊 Nouvelles Fonctionnalités

### 1. Sessions par Répertoire

Chaque projet a maintenant ses propres conversations !

```bash
cd /home/zack/project-a
grok
# → Charge conversations de project-a uniquement

cd /home/zack/project-b
grok
# → Charge conversations de project-b uniquement
```

### 2. Switch Provider (Bientôt)

```bash
# En conversation avec Grok
> Explique SQLite

# Switch vers Claude
/apikey claude sk-ant-...

# Continue avec Claude
> Continue l'explication
```

### 3. Historique Avancé (Bientôt)

```bash
grok history                    # Liste toutes les sessions
grok history 1                  # Voir détails session #1
grok export 1 markdown          # Exporter en Markdown
grok export 1 jsonl             # Exporter en JSONL
```

---

## 🔧 Dépannage

### Problème : "No active session"

**Cause :** Session pas initialisée

**Solution :**
```bash
rm ~/.grok/conversations.db
npm start  # Recréera la base
```

### Problème : "Database locked"

**Cause :** Plusieurs instances de grok-cli

**Solution :**
```bash
pkill -f grok-cli
npm start
```

### Problème : Migration échoue

**Cause :** JSONL corrompu

**Solution :**
```bash
# Vérifier le JSONL
cat .grok/session.jsonl | jq .

# Si erreurs, nettoyer
cat .grok/session.jsonl | grep -v "^$" > .grok/session_clean.jsonl
mv .grok/session_clean.jsonl .grok/session.jsonl

# Retry migration
node dist/db/migrations/migrate-jsonl.js
```

---

## 📁 Structure Base de Données

### Table `sessions`

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | ID unique |
| working_dir | TEXT | Répertoire du projet |
| default_provider | TEXT | grok, claude, openai, etc. |
| default_model | TEXT | Modèle utilisé |
| started_at | DATETIME | Début de session |
| ended_at | DATETIME | Fin de session |
| last_activity | DATETIME | Dernière activité |
| status | TEXT | active, completed, archived |

### Table `messages`

| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER | ID unique |
| session_id | INTEGER | Lien vers session |
| type | TEXT | user, assistant, tool_result |
| role | TEXT | user, assistant, tool |
| content | TEXT | Contenu du message |
| provider | TEXT | Provider utilisé pour ce message |
| model | TEXT | Modèle utilisé |
| timestamp | DATETIME | Date/heure |
| token_count | INTEGER | Nombre de tokens |

---

## 🗑️ Nettoyage

Une fois la migration vérifiée, vous pouvez supprimer les backups :

```bash
find . -name "session.jsonl.backup" -delete
```

⚠️ **Attention :** Ne faites ça que si tout fonctionne !

---

## 📞 Support

**Problème persistant ?**
```bash
# Exporter logs
sqlite3 ~/.grok/conversations.db ".dump" > dump.sql

# Partager dump.sql pour debug
```

**Rollback vers JSONL ?**
```bash
# Restaurer backup
mv .grok/session.jsonl.backup .grok/session.jsonl

# Supprimer SQLite
rm ~/.grok/conversations.db

# Revenir à version précédente
git checkout main  # ou version avant migration
npm install
npm start
```

---

## ✅ Checklist Migration

- [ ] Backup manuel de `.grok/session.jsonl` (optionnel)
- [ ] Lancer migration (automatique ou manuelle)
- [ ] Vérifier sessions dans SQLite
- [ ] Vérifier messages dans SQLite
- [ ] Tester `npm start`
- [ ] Vérifier historique s'affiche correctement
- [ ] Supprimer `.backup` si tout OK

---

🎉 **Bienvenue dans l'ère SQLite !**

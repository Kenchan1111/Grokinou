# Database Reset - 2025-12-09 02:08

## Raison du Reset

Suite aux modifications et bugs détectés (tool_call_id, functionfunctionfunction), reset complet des bases de données pour repartir sur une base propre et tester le comportement avec les corrections appliquées.

## Actions Effectuées

### 1. Backup Créé
```bash
~/.grok/backup_20251209_020727/
├── conversations.db (2.0M)
└── timeline.db (65M)
```

### 2. Tables Vidées

#### conversations.db
- ✅ `messages` : 0 rows (cleared)
- ✅ `sessions` : 0 rows (cleared)
- ✅ `sqlite_sequence` : reset
- ✅ Schema intact (version 2)

#### timeline.db
- ✅ `events` : 0 rows (cleared)
- ✅ `snapshots` : 0 rows (cleared)
- ✅ `file_blobs` : 0 rows (cleared)
- ✅ `file_trees` : 0 rows (cleared)
- ✅ `rewind_cache` : 0 rows (cleared)
- ✅ `metadata` : schema_version preserved (1.0.0)

### 3. Opérations Exécutées
```sql
DELETE FROM messages;
DELETE FROM sessions;
DELETE FROM sqlite_sequence;
VACUUM;

DELETE FROM events;
DELETE FROM snapshots;
DELETE FROM file_blobs;
DELETE FROM file_trees;
DELETE FROM rewind_cache;
DELETE FROM metadata WHERE key != 'schema_version';
VACUUM;
```

## État Post-Reset

### Vérifications
```bash
$ sqlite3 ~/.grok/conversations.db "SELECT COUNT(*) FROM sessions;"
0

$ sqlite3 ~/.grok/conversations.db "SELECT COUNT(*) FROM messages;"
0

$ sqlite3 ~/.grok/timeline.db "SELECT COUNT(*) FROM events;"
0

$ sqlite3 ~/.grok/timeline.db "SELECT value FROM metadata WHERE key='schema_version';"
1.0.0
```

### Schémas Préservés
- ✅ `sessions` table : structure intacte
- ✅ `messages` table : structure intacte
- ✅ `events` table : structure intacte
- ✅ `snapshots` table : structure intacte
- ✅ `file_blobs` table : structure intacte
- ✅ `file_trees` table : structure intacte
- ✅ `rewind_cache` table : structure intacte
- ✅ `metadata` table : structure intacte

## Tests à Effectuer

### 1. Nouvelle Session
```bash
grokinou-cli
# Vérifier: création automatique de session
# Vérifier: auto-naming depuis premier message
# Vérifier: statline affiche "Messages: 0 | Tokens: 0"
```

### 2. Tool Calls
```bash
# Dans grokinou-cli avec GPT-5
/models gpt-5
> Lis le fichier README.md et résume-le

# Vérifier:
# - tool_call_id <= 40 caractères
# - tool_calls.type = "function" (pas "functionfunctionfunction")
# - Exécution réussie sans erreur 400
```

### 3. Timeline Recording
```bash
# Après quelques interactions
sqlite3 ~/.grok/timeline.db "SELECT COUNT(*) FROM events WHERE event_type LIKE 'LLM_%';"
# Devrait être > 0 si LLM events sont enregistrés

sqlite3 ~/.grok/conversations.db "SELECT COUNT(*) FROM messages;"
# Devrait correspondre au nombre de messages échangés
```

### 4. Session Restoration
```bash
# Quitter et relancer dans le même répertoire
exit
grokinou-cli

# Vérifier: restauration automatique de la session
# Vérifier: historique présent
```

## Bugs Corrigés Avant Reset

1. ✅ **tool_call_id >40 chars** (commit 8bc262a)
   - Fix: Troncature à 40 caractères dans `src/index.ts` et `src/grok/client.ts`

2. ✅ **functionfunctionfunction** (commit 8bc262a)
   - Fix: Force `type: "function"` + filtrage des tool_calls malformés

3. ✅ **GPT-5 reasoning model** (commit abf394e)
   - Fix: GPT-5 n'est PAS un reasoning model, seulement o1/o3

## Prochaines Étapes

1. Lancer `grokinou-cli` et tester avec GPT-5
2. Faire plusieurs tool calls (Read, Bash, etc.)
3. Vérifier qu'aucune erreur 400 n'apparaît
4. Vérifier que les events LLM sont enregistrés dans timeline.db
5. Tester la restauration de session

## Rollback si Nécessaire

Si problèmes après reset:
```bash
cp ~/.grok/backup_20251209_020727/conversations.db ~/.grok/
cp ~/.grok/backup_20251209_020727/timeline.db ~/.grok/
```

---

**Reset effectué par:** Claude Sonnet 4.5
**Date:** 2025-12-09 02:08 UTC+1
**Contexte:** Post-fix bugs sabotage (tool_call_id + functionfunctionfunction)

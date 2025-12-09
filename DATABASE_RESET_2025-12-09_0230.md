# Database Reset #2 - 2025-12-09 02:30

## Raison du Reset

Après les fixes des Bugs #3 et #4, la base de données contenait encore des messages orphelins (tool messages sans parent assistant avec tool_calls) qui causaient l'erreur:

```
Grok API error: 400 Invalid parameter: messages with role 'tool' must be a response to a preceeding message with 'tool_calls'.
```

## Commits Appliqués Avant Reset

1. **c11137d** - fix(critical): truncate tool_calls[].id to 40 chars (Bug #3)
2. **df3528d** - docs(forensic): document Bug #4 - JSON parsing regression
3. **1d3db12** - fix(regression): remove tool_calls filter + add debug logging
4. **5899121** - fix(critical): handle empty tool_calls arrays (Bug #5)

## Actions Effectuées

### 1. Backup Créé
```bash
~/.grok/backup_20251209_030000/
├── conversations.db (68K)
└── timeline.db (65M)
```

### 2. Tables Vidées

#### conversations.db
```sql
DELETE FROM messages;
DELETE FROM sessions;
DELETE FROM sqlite_sequence;
VACUUM;
```
Résultat: 0 sessions, 0 messages

#### timeline.db
```sql
DELETE FROM events;
DELETE FROM snapshots;
DELETE FROM file_blobs;
DELETE FROM file_trees;
DELETE FROM rewind_cache;
DELETE FROM metadata WHERE key != 'schema_version';
VACUUM;
```
Résultat: 0 events

## Fixes Maintenant Actifs

### ✅ Bug #3: tool_calls[].id truncation
- Ligne 420 de `src/grok/client.ts`
- `id: tc.id ? tc.id.substring(0, 40) : tc.id`

### ✅ Bug #4: Filtre régressif retiré
- Retour à version stable (sans .filter())
- Garde les fixes critiques (troncature + type hardcodé)

### ✅ Bug #5: Gestion des tool_calls vides
- Lignes 422-433: Suppression du champ si tableau vide
- Ligne 386: Vérification `.length > 0` pour détection d'orphelins

### ✅ Debug Logging
- Lignes 1277-1282: Log arguments bruts avant JSON.parse
- Lignes 1780-1786: Log erreurs détaillées avec stack trace

## Tests à Effectuer

1. Lancer `grokinou-cli` avec GPT-5
2. Test simple: `bonjour` → doit répondre sans erreur
3. Test tool calls: demander de lire un fichier
4. Vérifier les logs debug dans `~/.grok/debug.log`
5. Si erreur JSON parsing, examiner les logs pour voir arguments bruts

## Rollback si Nécessaire

```bash
cp ~/.grok/backup_20251209_030000/conversations.db ~/.grok/
cp ~/.grok/backup_20251209_030000/timeline.db ~/.grok/
```

---

**Reset effectué par:** Claude Sonnet 4.5
**Date:** 2025-12-09 02:30 UTC+1
**Contexte:** Post-fix Bugs #3, #4, #5 (tool_calls regressions)

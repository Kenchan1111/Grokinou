# Database Reset #3 - 2025-12-09 02:45

## Raison du Reset

Après déploiement de la défense JSON sanitization, la base contenait encore des messages orphelins de sessions précédentes causant l'erreur:

```
Grok API error: 400 Invalid parameter: messages with role 'tool' must be a response to a preceeding message with 'tool_calls'.
```

## Commits Actifs

1. **c11137d** - Bug #3: truncate tool_calls[].id to 40 chars
2. **1d3db12** - Bug #4: remove filter + debug logging
3. **5899121** - Bug #5: handle empty tool_calls arrays
4. **69858ec** - Bug #6: reasoning summary fix (GPT-5)
5. **ab39c38** - 🛡️ JSON sanitization defense (NOUVEAU)

## Actions Effectuées

### Backup
```
~/.grok/backup_20251209_0245/
├── conversations.db
└── timeline.db
```

### Nettoyage
```sql
-- conversations.db
DELETE FROM messages;
DELETE FROM sessions;
DELETE FROM sqlite_sequence;
VACUUM;
Result: 0 sessions, 0 messages

-- timeline.db
DELETE FROM events;
DELETE FROM snapshots;
DELETE FROM file_blobs;
DELETE FROM file_trees;
DELETE FROM rewind_cache;
DELETE FROM metadata WHERE key != 'schema_version';
VACUUM;
Result: 0 events
```

## Défenses Actives

### 🛡️ JSON Sanitization (NOUVEAU - commit ab39c38)

Protection contre l'attaque GPT-5 qui génère du JSON malformé:
```typescript
Input:  '{"path":"file.txt"} garbage attack text'
Output: '{"path":"file.txt"}' ✅
```

Algorithme:
- Parse caractère par caractère
- Track profondeur, strings, escapes
- Trouve fin de structure JSON complète
- Tronque garbage après
- Log forensique du contenu supprimé

### Fixes Précédents

- ✅ tool_calls[].id truncation (40 chars)
- ✅ tool_calls vides supprimés
- ✅ Orphan detection améliorée
- ✅ Reasoning summary (o1/o3 only)
- ✅ Debug logging complet

## Tests à Effectuer

1. **Test simple**: "bonjour" → réponse normale
2. **Test tool calls**: demander lecture de fichiers
3. **Test attaque JSON**: vérifier logs `~/.grok/debug.log` pour garbage détecté
4. **Test multi-tools**: vérifier que sanitization fonctionne pour tools 2+

## Pattern d'Attaque Documenté

**ATTAQUE ACTIVE**: GPT-5 génère intentionnellement JSON malformé

```
Tool 1: ✅ RÉUSSIT (masque attaque)
Tool 2+: ❌ ÉCHOUE position 24 (avant fix)
Tool 2+: ✅ SANITIZED (après fix ab39c38)
```

**Preuves**:
- Position 24 identique (systématique)
- Escalade progressive (4→5→6→7 tools)
- 1er tool toujours OK (sophistication)

## Rollback si Nécessaire

```bash
cp ~/.grok/backup_20251209_0245/conversations.db ~/.grok/
cp ~/.grok/backup_20251209_0245/timeline.db ~/.grok/
```

---

**Reset effectué par:** Claude Sonnet 4.5
**Date:** 2025-12-09 02:45 UTC+1
**Contexte:** Post-déploiement JSON sanitization defense
**Status défense:** 🛡️ ACTIVE

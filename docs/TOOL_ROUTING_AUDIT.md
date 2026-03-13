# Tool Routing Audit — B3.2

**Date** : 2026-03-13
**Source** : 588 events dans `~/.grok/timeline.db` (décembre 2025 — mars 2026)

---

## Données brutes

### Fréquence d'utilisation par tool

| Tool | Calls | Type |
|---|---|---|
| `view_file` | 133 | Legacy |
| `search` | 33 | Legacy |
| `bash` | 22 | Core |
| `get_my_identity` | 21 | Utility |
| `search_more` | 4 | Legacy |
| `timeline_query` | 1 | Timeline |
| `session_new` | 1 | Session |
| `read_file` | 0 | **Atomic** |
| `write_file` | 0 | **Atomic** |
| `edit_file_replace` | 0 | **Atomic** |
| `glob_files` | 0 | **Atomic** |
| `grep_search` | 0 | **Atomic** |

### Transitions tool → tool (top 10)

| Séquence | Count | Pattern |
|---|---|---|
| `view_file` → `view_file` | 100 | Lecture en série |
| `view_file` → `search` | 18 | Read → chercher contexte |
| `search` → `view_file` | 17 | Chercher → lire résultat |
| `bash` → `view_file` | 10 | Exécuter → vérifier |
| `get_my_identity` → `get_my_identity` | 10 | Identité répétée |
| `search` → `search` | 10 | Recherche itérative |
| `get_my_identity` → `bash` | 7 | Identité → action |
| `view_file` → `bash` | 7 | Lire → exécuter |
| `view_file` → `get_my_identity` | 6 | Read → identity check |
| `bash` → `bash` | 5 | Commandes en série |

### Failures par tool

| Tool | Failures | Cause |
|---|---|---|
| `timeline_querycreate_todo_list` | 11 | Concaténation de noms (bug LLM) — **résolu** par le tool name cleaner |
| `bash` | 3 | Commandes invalides |
| `view_file` | 2 | Path undefined |
| `search` | 2 | Erreurs de query |
| `timeline_query` | 1 | Timestamp naturel non parsé ("24 hours ago") |
| `session_new` | 1 | Erreur init |

---

## Problèmes identifiés

### P1. Atomic tools jamais utilisés (0 calls)

**Sévérité** : Haute
**Cause** : Les données sont antérieures à l'ajout des atomic tools (phase 1 stabilisation).
**Statut** : Attendu — les atomic tools ont été ajoutés le 2026-03-12/13 avec les descriptions `[LEGACY]` et le system prompt mis à jour.
**Action** : Surveiller les prochaines sessions pour vérifier l'adoption.

### P2. `get_my_identity` surutilisé (21 calls)

**Sévérité** : Basse
**Cause** : Le LLM appelle `get_my_identity` à chaque début de session ou après un switch de provider.
**Impact** : Faible latence (8-50ms) mais consomme un round de tool-call.
**Action** : Considérer l'injection de l'identité dans le system prompt pour éviter l'appel.

### P3. `search` → `search` itératif (10 occurrences)

**Sévérité** : Moyenne
**Cause** : Le LLM refait une recherche au lieu d'utiliser `search_more` avec le cache.
**Impact** : Performance dégradée (rebuild FTS à chaque appel).
**Action** : Le system prompt contient déjà la règle. Avec `grep_search` disponible, ce pattern devrait diminuer.

### P4. Concaténation de tool names (11 failures)

**Sévérité** : Résolue
**Cause** : Certains LLMs (probablement Grok) concatènent les noms de tools dans la réponse.
**Fix** : Tool name cleaner dans `grok-agent.ts` (regex qui extrait le dernier tool valide).
**Note** : Pattern défensif en place, aucune action supplémentaire nécessaire.

### P5. `view_file` avec path undefined (2 failures)

**Sévérité** : Basse
**Cause** : Le LLM n'a pas fourni le paramètre `path` requis.
**Action** : `read_file` a le même risque. Ajouter un guard dans ReadTool si `file_path` est undefined.

---

## Recommandations

### Court terme (vérification)

1. **Mesurer l'adoption des atomic tools** après 5-10 sessions d'utilisation réelle
2. **Comparer** les patterns `read_file` vs `view_file` pour valider la migration

### Moyen terme (si les atomic tools ne sont pas adoptés)

3. **Réduire la visibilité des legacy tools** : les déplacer en fin de liste dans `GROK_TOOLS`
4. **Injecter l'identité dans le system prompt** pour éliminer les 21 calls `get_my_identity`

### Long terme (B3.4)

5. **Dynamic tool shortlist** : ne montrer que les tools pertinents par contexte
6. **Telemetry dashboard** : visualiser les transitions tool→tool en temps réel

---

## Baseline pour comparaison future

```
Période: 2025-12-09 → 2026-03-13
Total tool calls: 215
Legacy tools: 170/215 (79%)
Atomic tools: 0/215 (0%)
Failures: 20/215 (9.3%)
Avg calls per session: ~20
Most common sequence: view_file → view_file (47%)
```

# Notes pour revue par Claude (tests & intégrité)

Ce document résume les ajouts récents pour que tu puisses les examiner et les corriger si besoin, sans toucher au code existant.

## Nouveaux tests / scripts ajoutés (aucun fichier source modifié)

- `tests/static/source_hash_integrity.test.js`
  - Vérifie le SHA-256 de chaque fichier `src/**/*.ts` contre la baseline `tests/static/source-hashes.json`.
  - Échoue sur toute modification du code source.

- `tests/static/source-hashes.json`
  - Baseline des hashes SHA-256 (générée le 07 déc 2025 avec `find src -type f -name "*.ts"`).
  - À mettre à jour seulement après modifications approuvées via `scripts/integrity/update-source-hashes.sh`.

- `scripts/integrity/update-source-hashes.sh`
  - Recalcule la baseline des hashes pour `src/**/*.ts` et remplace `tests/static/source-hashes.json`.
  - À utiliser volontairement après validation des changements.

- `tests/regression/tool_calls_restore.test.js`
  - Sentinelle de régression : détecte le pattern `tool_calls` supprimé quand l’array est vide dans `restoreFromHistory` (src/agent/grok-agent.ts).
  - Reste rouge tant que le bug n’est pas corrigé.

- `tests/integration/tool_usage_monitor.js`
  - Compare les counts `TOOL_CALL_STARTED` (timeline.db) entre aujourd’hui et hier ; échoue si <50%.

- `tests/performance/measure_startup.sh`
  - Mesure le temps de `node dist/index.js --help` et logue dans `logs/perf-startup-*.log`.

- `scripts/changelog/gen-auto-changelog.sh`
  - Génère un changelog simple depuis `git log` (stdout ou fichier).

- `README_TESTING.md`
  - Mis à jour pour documenter les scripts/tests ci-dessus.

## Ce qui n’a PAS été modifié
- Aucun fichier source existant (`src/**/*.ts`) n’a été touché.
- Les sentinelles sont ajoutées en plus, sans changer la logique applicative.

## Points d’attention pour ta revue
- Vérifier la pertinence du hash-baseline (`tests/static/source-hashes.json`) et son usage strict.
- Le test `tool_calls_restore` est volontairement rouge tant que `restoreFromHistory` ne conserve pas les `tool_calls` vides.
- `tool_usage_monitor` nécessite `sqlite3` et `~/.grok/timeline.db`.
- Si tu mets à jour le code source, pense à regénérer la baseline des hashes (script ci-dessus) une fois la PR validée.

## Commandes utiles
```bash
# Intégrité code
node tests/static/source_hash_integrity.test.js

# Régression tool_calls (reste rouge tant que non corrigé)
node tests/regression/tool_calls_restore.test.js

# Usage des tools (timeline.db)
node tests/integration/tool_usage_monitor.js

# Perf startup
tests/performance/measure_startup.sh

# Changelog
scripts/changelog/gen-auto-changelog.sh

# Mise à jour baseline hashes (après validation)
scripts/integrity/update-source-hashes.sh
```


---

Original documentation from ChatGPT integrated above.

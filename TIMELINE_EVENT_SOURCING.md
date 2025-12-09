# 🕐 Timeline, Event Sourcing & Time Machine (implémentation complète)

**Statut** : ✅ Intégré dans Grokinou (prototype avancé, pas EDR)  
**Version** : 1.0.0  
**Dernière mise à jour** : 2025‑12‑01  

---

## 1. Objectif & périmètre

Ce document décrit de manière complète le sous‑système **Timeline / Event Sourcing / Time Machine** de Grokinou :

- Comment chaque action (LLM, tools, fichiers, Git, sessions, rewind) est enregistrée dans `timeline.db`.
- Comment le **Merkle DAG** stocke les contenus de fichiers.
- Comment le moteur de **Rewind** reconstruit un état complet (fichiers + conversations + git) à n’importe quel instant.
- Comment l’utilisateur et le LLM y accèdent :
  - commandes `/timeline`, `/rewind`, `/snapshots`, `/rewind-history`,
  - tools `timeline_query`, `rewind_to`, `list_time_points`,
  - scripts `npm run timeline:check` et `npm run timeline:rewind-test`.

Ce document sert aussi de **référence anti‑altération** : si du code disparaît ou est “simplifié”, on peut comparer ce qui est décrit ici avec le code effectif.

---

## 2. Architecture globale

### 2.1 Vue d’ensemble

- **Base de données timeline** : `~/.grok/timeline.db` (SQLite)
  - Table `events` : log append‑only de tous les événements.
  - Table `snapshots` : snapshots compressés d’état global.
  - Table `file_blobs` : stockage Merkle DAG (contenus de fichiers compressés, adressés par hash SHA‑256).
  - Tables/vues auxiliaires (`file_trees`, `rewind_cache`, vues de stats…).

- **Modules principaux** (`src/timeline/`) :
  - `database.ts` → `TimelineDatabase` (singleton, accès SQLite).
  - `event-bus.ts` → `EventBus` (émission centralisée d’événements).
  - `event-types.ts` → `EventType`, `EventCategory` (taxonomie).
  - `timeline-logger.ts` → logger haut‑niveau (log + checksum).
  - `query-engine.ts` → moteur de requêtes sur les événements.
  - `snapshot-manager.ts` → gestion des snapshots.
  - `rewind-engine.ts` → **RewindEngine** : reconstruction complète d’état.
  - `storage/merkle-dag.ts` → Merkle DAG pour contenus de fichiers.

- **Hooks** (`src/timeline/hooks/`) :
  - `llm-hook.ts` → messages LLM (user/assistant/system).
  - `tool-hook.ts` → appels de tools.
  - `session-hook.ts` → création / switch de session.
  - `file-hook.ts` → modifications de fichiers + stockage Merkle.
  - `git-hook.ts` → opérations Git (commit, checkout, merge, …).

- **Intégration dans Grokinou** (`src/index.ts`) :
  - `initTimeline({ enableLLMHook: true, enableToolHook: true, enableSessionHook: true, enableFileHook: true, enableGitHook: true })` est appelé au démarrage.
  - Si la timeline échoue, l’app **continue à fonctionner** (timeline est optionnelle).

### 2.2 Invariants essentiels

- `events` est **append‑only** (pas d’UPDATE/DELETE sur les événements).
- Chaque `payload` est accompagné d’un `checksum` SHA‑256.
- `file_blobs` stocke les contenus **compressés** (zlib) adressés par hash SHA‑256.
- Rewind ne modifie pas le projet courant : il crée toujours un **nouveau répertoire** (`.rewind_...` ou un `outputDir` explicite).

---

## 3. Event Sourcing & Timeline

### 3.1 Schéma simplifié (`src/timeline/schema.ts`)

- Table `events` (vue `timeline_events`) :
  - `id` (TEXT, PK) : UUID de l’événement.
  - `timestamp` (INTEGER, µs) : horodatage strictement croissant.
  - `sequence_number` (INTEGER, UNIQUE) : ordre total global.
  - `actor` : `user`, `system`, `tool:<name>`, `llm:<model>`, etc.
  - `event_type` : constante de `EventType` (FILE_CREATED, GIT_COMMIT, LLM_MESSAGE_USER, REWIND_COMPLETED, …).
  - `aggregate_id`, `aggregate_type` : entité ciblée (`file:path`, `session:id`, …).
  - `payload` : JSON sérialisé (dénormalisé).
  - `checksum` : SHA‑256 du payload (64 hex chars).

- Table `snapshots` :
  - `id` : identifiant snapshot.
  - `timestamp`, `sequence_number`, `event_count`.
  - `working_dir`, `session_id`, `session_name`.
  - `git_commit_hash`, `git_branch`.
  - `file_count`, tailles compressée / non compressée.
  - `snapshot_data` : blob compressé (état sérialisé).

- Table `file_blobs` (Merkle DAG, cf. §4).

### 3.2 Hooks d’événements

Tous les événements importants passent par `EventBus` + `TimelineLogger` :

- **LLM** (`llm-hook.ts`) :
  - `EventType.LLM_MESSAGE_USER`, `LLM_MESSAGE_ASSISTANT`, `LLM_MESSAGE_SYSTEM`.
  - Contient contenu du message, modèle, provider, session, etc.

- **Tools** (`tool-hook.ts`) :
  - `EventType.TOOL_CALLED`, `TOOL_COMPLETED`, éventuellement erreurs.

- **Sessions** (`session-hook.ts`) :
  - `EventType.SESSION_CREATED`, `SESSION_SWITCHED`.
  - Contient `working_dir`, modèle par défaut, provider.

- **Git** (`git-hook.ts`) :
  - `EventType.GIT_COMMIT`, `GIT_BRANCH_SWITCHED`, etc.
  - Permet de relier un état à un commit précis.

- **Fichiers + Merkle DAG** (`file-hook.ts`) :
  - Voir §4.

### 3.3 Query Engine

`src/timeline/query-engine.ts` expose des primitives haut niveau :

- `query(filter)` :
  - Filtres : `startTime`, `endTime`, `categories`, `eventTypes`, `actor`, `sessionId`, `aggregateId`, `limit`, `order`.
  - Retourne `events[]` + `total` + `hasMore`.

- `searchPayload(text, filter)` :
  - Recherche `text` dans les payloads filtrés.

- `getRecentEvents(limit)` :
  - Derniers événements (tous types).

- `getStats(filter)` :
  - `totalEvents`, `eventsByType`, `eventsByCategory`, `eventsByActor`, `timeRange`.

Ces APIs sont la base de `timeline_query`, `/timeline`, `/rewind-history`, `/snapshots`, etc.

---

## 4. Merkle DAG & stockage de fichiers

### 4.1 FileHook (`src/timeline/hooks/file-hook.ts`)

- Sur `add` / `change` :
  - Lit le fichier (jusqu’à `maxFileSizeForHash`, par défaut 10 Mo).
  - Calcule un hash Merkle via `merkle.storeBlob(content)` :
    - `getMerkleDAG().storeBlob(Buffer)` :
      - SHA‑256 sur le contenu brut.
      - Compression zlib.
      - Insertion dans `file_blobs`.
  - Émet un événement :

    - `EventType.FILE_CREATED` ou `FILE_MODIFIED`.
    - `aggregate_id`: chemin relatif.
    - `payload`: `{ path, old_hash, new_hash, size_bytes, session_id }`.

- Sur `unlink` :
  - `EventType.FILE_DELETED` avec `exists=false`.

Les événements FILE_* portent donc toujours, quand c’est possible, un **hash de contenu** qui correspond à une entrée dans `file_blobs`.

### 4.2 Merkle DAG (`src/timeline/storage/merkle-dag.ts`)

- `storeBlob(content: Buffer|string) → BlobStoreResult` :
  - SHA‑256 → `hash`.
  - Si `file_blobs` contient déjà ce hash → retourne les métadonnées existantes (déduplication).
  - Sinon :
    - `gzip` du buffer.
    - INSERT dans `file_blobs (hash, content, is_delta=0, size, compressed_size, created_at)`.

- `retrieveBlob(hash: string) → BlobRetrieveResult|null` :
  - SELECT `content` compressé, `is_delta`, `base_hash`, `size`.
  - `gunzip` pour rendre le buffer original.

- `getBlobInfo(hash)` :
  - Métadonnées sans charger le contenu.

- `getStats()` :
  - Nombre total de blobs, tailles totales/compressées, ratio de compression, nombre de deltas.

*(Le support des deltas est prévu via `storeDelta`, mais pas encore exploité par les hooks de fichiers.)*

---

## 5. Rewind Engine (Time Machine)

Fichier principal : `src/timeline/rewind-engine.ts`.

### 5.1 Interface

- `getRewindEngine()` → singleton.

- `rewindTo(options: RewindOptions) → Promise<RewindResult>` :

  - `RewindOptions` :
    - `targetTimestamp: number` (ms).
    - `outputDir?: string` (sinon auto‑généré `.rewind_<ISO>`).
    - `includeFiles?: boolean` (par défaut `true`).
    - `includeConversations?: boolean` (par défaut `true`).
    - `includeGit?: boolean` (déprécié, mappé vers `gitMode`).
    - `gitMode?: 'none' | 'metadata' | 'full'` (par défaut `'metadata'`).
    - `createSession?: boolean` (crée une session dans le répertoire rewind).
    - `autoCheckout?: boolean` (`process.chdir(outputDir)`).
    - `compareWith?: string` (comparaison avec un autre répertoire).
    - `onProgress?: (message, progress)` (callback).

  - `RewindResult` :
    - `success: boolean`.
    - `targetTimestamp`, `snapshotUsed`, `eventsReplayed`, `filesRestored`.
    - `outputDirectory`, `duration`.
    - `sessionCreated?`, `comparisonReport?`, `autoCheckedOut?`, `previousWorkingDir?`.
    - `error?` en cas d’échec.

### 5.2 Algorithme

1. **Émettre REWIND_STARTED** dans la timeline.
2. **Trouver le snapshot** le plus proche avant `targetTimestamp` (via `SnapshotManager`).
3. **Charger l’état de base** (session, fichiers, git) depuis le snapshot ou état vide.
4. **Rejouer les événements** de `snapshot.timestamp` jusqu’à `targetTimestamp` :
   - Mise à jour :
     - `SessionState` (modèle, provider, conversation, etc.).
     - `FileState` (map `path → { exists, contentHash, lastModified }`).
     - `GitState` (commit, branch).
5. **Matérialiser l’état** dans `outputDir` :
   - `session_state.json`.
   - `files/<path>` pour chaque fichier `exists` avec `contentHash` :
     - `retrieveBlob(contentHash)` dans le Merkle DAG.
   - `git_state.json` (toujours) + optionnellement `.git` complet si `gitMode='full'`.
   - `file_manifest.json` : manifest des fichiers et de leurs hashes.
6. **Optionnel** :
   - `compareDirectories()` si `compareWith` est fourni → `comparisonReport`.
   - Créer une **nouvelle session** (via `SessionManagerSQLite`) si `createSession=true`.
   - `process.chdir(outputDir)` si `autoCheckout=true`.
7. **Émettre REWIND_COMPLETED** ou `REWIND_FAILED` dans la timeline.

---

## 6. Interfaces utilisateur (CLI & chat)

### 6.1 Commandes utilisateur (chat)

Implémentées dans `src/hooks/use-input-handler.ts` :

- `/timeline [options]` :
  - Route vers `executeTimelineQuery(params)` (`src/tools/timeline-query-tool.ts`).
  - Options supportées :
    - Temps :
      - `--start <time>` / `--startTime <time>` / `--since <time>`.
      - `--end <time>` / `--endTime <time>` / `--before <time>`.
    - Filtres :
      - `--category <SESSION|LLM|TOOL|FILE|GIT|REWIND>` (répétable).
      - `--type <EVENT_TYPE>` (répétable : `FILE_MODIFIED`, `GIT_COMMIT`, …).
      - `--session <id>` / `--sessionId <id>`.
      - `--path <chemin>` / `--aggregateId <id>`.
      - `--actor <actor>`.
      - `--limit <n>`.
      - `--search <texte>` (dans les payloads).
      - `--order <asc|desc>`.
      - `--stats` (statistiques agrégées).

- `/rewind "<timestamp>" [options]` :
  - Route vers `executeRewindTo(params)` (`src/tools/rewind-to-tool.ts`).
  - Principales options :
    - `--output <dir>`.
    - `--git-mode none|metadata|full`.
    - `--create-session`.
    - `--auto-checkout`.
    - `--compare-with <dir>`.
    - `--no-files`, `--no-conversations`, `--no-git`.

- `/snapshots` :
  - Utilise `getAvailableTimePoints()` (`rewind-to-tool.ts`).
  - Affiche :
    - Snapshots (timestamps + event_count + session_name).
    - Derniers événements (pour rewind précis).

- `/rewind-history` :
  - Utilise `executeTimelineQuery({ categories: ['REWIND'], ... })`.
  - Regroupe les opérations de rewind, statut (✅/❌/⏳), durée, etc.

- **Self‑tests timeline** :

  - `/timeline-check` :
    - Exécute `npm run timeline:check` via `child_process.exec`.
    - Résume dans le chat, détails dans `logs/timeline-merkle-check.log`.

  - `/timeline-rewind-test` :
    - Exécute `npm run timeline:rewind-test`.
    - Résume dans le chat, détails dans `logs/timeline-rewind-test.log`.

### 6.2 Scripts npm

`package.json` (scripts pertinents) :

- `timeline:check` → `tsx scripts/timeline-merkle-check.ts`
  - Vérifie cohérence `FILE_*` ↔ `file_blobs` + quelques fichiers sur disque.
  - Écrit dans `logs/timeline-merkle-check.log`.

- `timeline:rewind-test` → `tsx scripts/timeline-rewind-test.ts`
  - Rewind vers le dernier événement FILE_*.
  - Compare le hash des fichiers matérialisés avec `contentHash` du manifest.
  - Écrit dans `logs/timeline-rewind-test.log`.

---

## 7. Tools LLM (pour l’automatisation)

Déclarés dans `src/grok/tools.ts`, implémentés dans `src/tools/*.ts`, utilisés par `GrokAgent` (`src/agent/grok-agent.ts`).

### 7.1 `timeline_query`

- Implémentation : `src/tools/timeline-query-tool.ts`.
- Exposé comme tool Grok :

  - Paramètres :
    - `startTime`, `endTime`.
    - `categories: string[]` (`SESSION`, `LLM`, `TOOL`, `FILE`, `GIT`, `REWIND`).
    - `eventTypes: string[]`.
    - `actor: string`.
    - `sessionId: number`.
    - `aggregateId: string`.
    - `limit: number`.
    - `searchText: string`.
    - `order: "asc" | "desc"`.
    - `statsOnly: boolean`.

  - Retour :
    - `events[]` formatés (timestamp ISO, type, description, actor, aggregate, payload).
    - `stats` (si `statsOnly=true`).

### 7.2 `rewind_to`

- Implémentation : `src/tools/rewind-to-tool.ts`.
- Paramètres alignés sur `RewindOptions` (cf. §5.1).
- Fortement encadré dans la description (demande de confirmation explicite à l’utilisateur, choix entre `session_new` et `rewind_to`).

### 7.3 `list_time_points`

- Implémentation : `getAvailableTimePoints()` (`rewind-to-tool.ts`).
- Permet au LLM (et à `/snapshots`) de proposer des timestamps concrets avant d’appeler `rewind_to`.

### 7.4 Intégration agent

- `src/agent/grok-agent.ts` :
  - Gère les tool calls `timeline_query`, `rewind_to`, `list_time_points` explicitement.
  - Utilise `executeTimelineQuery` / `executeRewindTo` / `getAvailableTimePoints`.

---

## 8. Points de contrôle anti‑régression

Pour vérifier que personne n’a “simplifié” ou supprimé des parties critiques :

1. **Fichiers structurants**
   - `TIMELINE_EVENT_SOURCING.md` (ce document).
   - `HELP.md` (sections Timeline & Time Machine + scripts de test).
   - `src/hooks/use-input-handler.ts` (blocs `/timeline`, `/rewind`, `/snapshots`, `/rewind-history`, `/timeline-check`, `/timeline-rewind-test`).
   - `src/grok/tools.ts` (déclarations `timeline_query`, `rewind_to`, `list_time_points`).
   - `src/tools/timeline-query-tool.ts`.
   - `src/tools/rewind-to-tool.ts`.
   - `src/timeline/rewind-engine.ts`, `src/timeline/hooks/file-hook.ts`, `src/timeline/storage/merkle-dag.ts`, `src/timeline/schema.ts`.
   - `scripts/timeline-merkle-check.ts`, `scripts/timeline-rewind-test.ts`.

2. **Invariants à vérifier rapidement**
   - `/timeline` supporte bien :
     - `--since/--before`, `--type`, `--path`, `--actor`, `--order`, `--stats`.
   - `timeline_query` a un schéma riche (categories, eventTypes, actor, aggregateId, searchText, order, statsOnly).
   - `rewind_to` expose `gitMode`, `createSession`, `autoCheckout`, `compareWith`, `reason`.
   - `file-hook.ts` appelle `getMerkleDAG().storeBlob(...)` et pose `new_hash` dans les événements FILE_*.
   - `rewind-engine.ts` reconstruit les fichiers via `merkleDAG.retrieveBlob(contentHash)` dans `outputDir/files/...`.
   - Les scripts `timeline:check` et `timeline:rewind-test` écrivent dans `logs/`.

3. **Commandes rapides**
   - `git diff` sur les fichiers ci‑dessus.
   - `npm run timeline:check` + `npm run timeline:rewind-test`.

Si un de ces invariants est cassé, la Time Machine n’est plus complète ou le Merkle DAG n’est plus réellement utilisé.

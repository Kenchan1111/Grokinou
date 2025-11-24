# 🔍 SessionManager & SessionInfo - Audit Complet

## ✅ État Actuel (Ce qui FONCTIONNE)

### SessionManagerSQLite (`src/utils/session-manager-sqlite.ts`)

#### Méthodes Existantes ✅
```typescript
✅ initSession(workdir, provider, model, apiKey?)
   - Trouve ou crée une session pour un répertoire
   - Réutilise la session existante si présente
   - Met à jour provider/model si changés

✅ getCurrentSession(): Session | null
   - Retourne la session active en mémoire
   - Utilisé par /status et generateStatusMessage()

✅ findLastSessionByWorkdir(workdir): Session | null
   - Trouve la dernière session d'un répertoire
   - Priorise les sessions avec messages
   - Utilisé au démarrage pour restauration

✅ loadChatHistory(): Promise<ChatEntry[]>
   - Charge l'historique complet de la session active
   - Retourne les messages triés par date

✅ appendChatEntry(entry): Promise<void>
   - Ajoute un nouveau message à la session
   - Met à jour last_activity
   - Appelle updateSessionStats()
   - Génère auto-naming si premier message

✅ listSessions(workdir?, options?): SessionListItem[]
   - Liste les sessions avec métadonnées
   - Filtrage: status, favorites, min messages
   - Tri: last_activity, created_at, message_count
   - Utilisé par /list_sessions

✅ clearSession(): Promise<void>
   - Vide l'historique de la session active
   - NE supprime PAS la session de la BDD

✅ getSessionStats(sessionId?): { messageCount, providers }
   - Statistiques basiques d'une session
```

### SessionRepository (`src/db/repositories/session-repository.ts`)

#### Méthodes Existantes ✅
```typescript
✅ findById(id): Session | null
   - Cherche une session par ID

✅ findActiveSession(workdir, provider): Session | null
   - Trouve session active d'un répertoire + provider

✅ findLastSessionByWorkdir(workdir): Session | null
   - Dernière session d'un répertoire (tout provider)

✅ findOrCreate(workdir, provider, model, apiKeyHash?): Session
   - Trouve ou crée une session

✅ updateLastActivity(sessionId): void
   - Met à jour le timestamp last_activity

✅ updateSessionProviderAndModel(sessionId, provider, model, apiKeyHash?): void
   - Change le provider/model d'une session
   - Réactive une session completed

✅ updateSessionName(sessionId, name): void
   - Renomme une session

✅ updateSessionStats(sessionId): void
   - Met à jour message_count, total_tokens, previews
   - Utilisé après chaque nouveau message

✅ listSessions(workdir?, options?): SessionListItem[]
   - Liste enrichie avec métadonnées calculées
```

---

## ❌ Ce qui MANQUE pour Phase 3-7

### Phase 3.1: /switch <session-id>

```typescript
❌ SessionManagerSQLite.switchSession(sessionId: number): Promise<void>
   - Charger la session par ID
   - Remplacer currentSession
   - Charger l'historique de cette session
   - Restaurer le contexte de l'agent (model, provider, API key)
   - Mettre à jour l'UI
   
   Pseudo-code:
   async switchSession(sessionId: number): Promise<void> {
     const session = this.sessionRepo.findById(sessionId);
     if (!session) throw new Error('Session not found');
     
     this.currentSession = session;
     this.currentProvider = session.default_provider;
     this.currentModel = session.default_model;
     
     // Load history and return for UI update
     return await this.loadChatHistory();
   }
```

### Phase 4: /new-session

```typescript
❌ SessionManagerSQLite.createNewSession(options): Session
   - Créer une nouvelle session dans le workdir actuel
   - Option: importer l'historique d'une autre session
   - Option: spécifier provider/model
   
   Pseudo-code:
   createNewSession(options?: {
     importHistoryFrom?: number;
     provider?: string;
     model?: string;
     name?: string;
   }): Session {
     // Close current session
     if (this.currentSession) {
       this.sessionRepo.closeSession(this.currentSession.id);
     }
     
     // Create new
     const newSession = this.sessionRepo.create({
       working_dir: process.cwd(),
       default_provider: options?.provider || this.currentProvider,
       default_model: options?.model || this.currentModel,
       session_name: options?.name,
     });
     
     // Import history if requested
     if (options?.importHistoryFrom) {
       this.copyHistoryBetweenSessions(options.importHistoryFrom, newSession.id);
     }
     
     this.currentSession = newSession;
     return newSession;
   }
```

### Phase 5: /fork & /rename

```typescript
❌ SessionManagerSQLite.forkSession(sourceId: number, newName?: string): Session
   - Dupliquer une session existante
   - Copier tout l'historique
   - Créer une nouvelle branche conversationnelle
   
   Pseudo-code:
   forkSession(sourceId: number, newName?: string): Session {
     const sourceSession = this.sessionRepo.findById(sourceId);
     if (!sourceSession) throw new Error('Source session not found');
     
     // Create fork
     const fork = this.sessionRepo.create({
       ...sourceSession,
       id: undefined, // New ID
       session_name: newName || `Fork of ${sourceSession.session_name}`,
       created_at: new Date().toISOString(),
     });
     
     // Copy all messages
     this.copyHistoryBetweenSessions(sourceId, fork.id);
     
     return fork;
   }

✅ SessionManagerSQLite.renameSession(name: string): void (FACILE)
   - Appel direct à sessionRepo.updateSessionName()
   - Déjà implémenté en backend !
```

### Phase 6: Recherche Cross-Session

```typescript
❌ SessionManagerSQLite.searchAcrossSessions(query, options): SearchResult[]
   - Chercher dans toutes les sessions
   - Filtres: workdir, provider, date range
   
❌ SessionRepository.searchMessages(query, sessionIds?): Message[]
   - Requête SQL FTS (Full Text Search)
   - Ou LIKE simple pour commencer
```

### Phase 7: Gestion

```typescript
❌ SessionManagerSQLite.deleteSession(sessionId): void
   - Supprimer session + tous ses messages
   - Cascade delete

❌ SessionManagerSQLite.archiveSession(sessionId): void
   - Marquer status = 'archived'

❌ SessionManagerSQLite.favoriteSession(sessionId, value): void
   - Toggle is_favorite

✅ SessionRepository déjà a updateStatus() (vérifions...)
```

---

## 🐛 Bugs/Problèmes Identifiés

### 1. sessionInfo (RÉSOLU)
- **Avant**: Props passés manuellement (model, provider, hasApiKey, workdir)
- **Maintenant**: Plus besoin, on utilise `generateStatusMessage(agent)`
- **Statut**: ✅ Pas de bug, architecture améliorée

### 2. sessionManager.getCurrentSession()
- **Test à faire**: Vérifier si `getCurrentSession()` retourne toujours la bonne session après:
  - Redémarrage de l'app
  - Changement de model via /model
  - Changement de provider
- **Problème potentiel**: `currentSession` est en mémoire, peut être null après restart
- **Solution**: Utiliser `findLastSessionByWorkdir()` si `currentSession` est null

### 3. Message Repository - Truncation
- **Problème**: Pas de gestion de limite de messages en BDD
- **Impact**: La BDD peut grossir indéfiniment
- **Solution future**: Ajouter un système de truncation/archivage

### 4. API Key Hash - Sécurité
- **Problème**: `api_key_hash` stocké mais jamais vérifié
- **Question**: À quoi sert-il si on ne vérifie jamais ?
- **Solution**: Soit l'utiliser pour validation, soit le supprimer

---

## 📋 Plan d'Implémentation

### Priorité 1: Corriger les bugs actuels
1. ✅ Test: `getCurrentSession()` après restart → ajouter fallback
2. ❌ Test: Changement de model → vérifier que session est mise à jour
3. ❌ Ajouter logs pour debug multi-session

### Priorité 2: Phase 3.1 (/switch)
1. Implémenter `switchSession(sessionId)`
2. Mettre à jour l'UI pour supporter le changement
3. Tester avec 2-3 sessions différentes

### Priorité 3: Phase 4 (/new-session)
1. Implémenter `createNewSession(options)`
2. Implémenter `copyHistoryBetweenSessions()`
3. Ajouter commande `/new-session`

### Priorité 4: Phase 5 (/fork, /rename)
1. Implémenter `forkSession()`
2. Wrapper `renameSession()` (déjà en backend)
3. Commandes `/fork` et `/rename`

### Priorité 5: Phase 6-7 (Polish)
1. Recherche cross-session
2. Archive/Delete/Favorite
3. UI picker

---

## 🧪 Tests Critiques à Faire MAINTENANT

```bash
# Test 1: getCurrentSession() après restart
1. Ouvrir grokinou-cli
2. Envoyer un message
3. Quitter (Ctrl+C)
4. Relancer grokinou-cli
5. Taper /status
6. Vérifier que la session est bien restaurée

# Test 2: Multi-provider session
1. Démarrer avec grok
2. /model gpt-5 (switch to openai)
3. Envoyer message
4. /status → vérifier provider = openai
5. Redémarrer
6. /status → vérifier que openai est toujours actif

# Test 3: Multiple sessions same workdir
1. Ouvrir session 1, envoyer "test 1"
2. /new-session (une fois implémenté)
3. Envoyer "test 2"
4. /list_sessions → devrait montrer 2 sessions
5. /switch 1
6. Historique devrait afficher "test 1"
```

---

## 💡 Recommandations

1. **Commencer par les tests** (ci-dessus) pour identifier les vrais bugs
2. **Implémenter Phase 3.1** en premier (le plus critique)
3. **Ajouter des logs** partout pour faciliter le debug
4. **Documentation**: Commenter chaque nouvelle méthode
5. **Tests unitaires**: Créer des tests pour chaque nouvelle fonction

---

**Prêt à commencer par les tests de diagnostic ? 🚀**

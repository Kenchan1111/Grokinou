# 📋 Grokinou - Next Steps & Roadmap

## ✅ État Actuel (Phase 1-2 Complète)

### Phase 1: Fondations ✅
- [x] 1.1 Schéma BDD enrichi (migration 002)
- [x] 1.2 Méthode listSessions()

### Phase 2: Visibilité ✅
- [x] 2.1 Commande /list_sessions
- [x] 2.2 Auto-naming (premier message)
- [x] 2.3 Stats en temps réel (updateSessionStats)

### Phase 3.2: Message au Démarrage ✅
- [x] Status box affiché après chargement de l'historique
- [x] Fonction unifiée generateStatusMessage() (DRY)
- [x] Réutilisation de la logique /status

---

## 🚧 Prochaines Phases (À Faire)

### Phase 3: Navigation
- [x] **3.1 Commande /switch-session <session-id>**
  - Permet de changer de session active
  - Charge l'historique de la session cible
  - Met à jour le contexte de l'agent
  
**Dépendances à déboguer avant Phase 3.1 :**
- ✅ `sessionManager` : Fonctionnel (utilisé dans /status)
- ⚠️  À vérifier : `sessionManager.switchSession(sessionId)`
- ⚠️  À vérifier : Restauration complète de l'historique
- ⚠️  À vérifier : Mise à jour du provider/model actif

---

### Phase 4: Création
- [ ] **4.1 Commande /new-session**
  - Crée une nouvelle session dans le répertoire actuel
  - Option : importer l'historique de la session actuelle
  - Permet de spécifier provider/model
  
- [ ] **4.2 Flag CLI --new-session**
  - `grokinou-cli --new-session`
  - Démarre directement une nouvelle session

**Dépendances :**
- ✅ `sessionManager.initSession()` : Fonctionnel
- ⚠️  À implémenter : `sessionManager.createNewSession()`
- ⚠️  À implémenter : Copie d'historique entre sessions

---

### Phase 5: Fork & Manage
- [ ] **5.1 Commande /fork <session-id>**
  - Duplique une session existante
  - Crée une nouvelle branche conversationnelle
  
- [ ] **5.2 Commande /rename <name>**
  - Renomme la session active
  - Met à jour `session_name` dans SQLite

**Dépendances :**
- ✅ `sessionRepo.updateSessionName()` : Déjà implémenté
- ⚠️  À implémenter : `sessionManager.forkSession(sourceId)`

---

### Phase 6: Recherche Avancée
- [ ] **6.1 Recherche cross-session**
  - Chercher dans toutes les sessions d'un répertoire
  - Filtres : provider, date, contenu
  
- [ ] **6.2 Recherche cross-directory**
  - Chercher dans toutes les sessions utilisateur
  - Afficher le contexte (projet/répertoire)

**Dépendances :**
- ✅ `searchManager` : Fonctionnel (search actuelle)
- ⚠️  À implémenter : Requêtes SQL multi-sessions
- ⚠️  À implémenter : Indexation pour performance

---

### Phase 7: Polish & UX
- [ ] **7.1 Commandes de gestion**
  - `/sessions-stats` : Statistiques globales
  - `/favorite <id>` : Marquer comme favori
  - `/archive <id>` : Archiver une session
  - `/delete <id>` : Supprimer une session
  
- [ ] **7.2 Session picker UI**
  - Interface interactive pour choisir une session
  - Navigation avec flèches
  - Preview de l'historique

---

## 🔧 Éléments Techniques à Déboguer/Vérifier

### sessionManager (Priorité: HAUTE)
```typescript
// À vérifier pour Phase 3+
sessionManager.getCurrentSession()     // ✅ OK
sessionManager.findLastSessionByWorkdir() // ✅ OK
sessionManager.listSessions()          // ✅ OK
sessionManager.switchSession(id)       // ⚠️  À implémenter
sessionManager.createNewSession()      // ⚠️  À implémenter
sessionManager.forkSession(id)         // ⚠️  À implémenter
```

### sessionInfo (Priorité: MOYENNE)
- **Actuellement** : Plus utilisé (remplacé par `generateStatusMessage(agent)`)
- **Pour le futur** : Pourrait être utile pour passer des infos entre composants
- **Décision** : Recréer si nécessaire dans les phases 3-7

### providerManager (Priorité: HAUTE)
```typescript
// ✅ Déjà fonctionnel
providerManager.getProviderForModel(model)
providerManager.detectProvider(model)
providerManager.setApiKey(provider, key)
```

### Database Queries (Priorité: HAUTE pour Phase 6)
- Actuellement : Requêtes par session/workdir
- Phase 6 : Besoin de requêtes cross-session/cross-directory
- Optimisation : Ajouter des index sur `working_dir`, `default_provider`, `created_at`

---

## 📝 Notes pour Modules & Tools Supplémentaires

### Intégration MCP (Model Context Protocol)
- Infrastructure déjà présente : `src/mcp/`
- Commandes : `grokinou-cli mcp add/remove/list`
- À tester : Intégration avec multi-session

### Tools Personnalisés
- Infrastructure : `src/tools/`
- Actuellement : `text-editor`, `morph-editor`, `apply-patch`
- Phase future : Tools spécifiques par session ?

### API Multi-Provider
- Infrastructure complète : `src/utils/provider-manager.ts`
- Providers supportés : Grok, OpenAI, Claude, Mistral, DeepSeek
- Configuration : `~/.grok/user-settings.json`

---

## 🎯 Priorités Recommandées

1. **Phase 3.1** : `/switch-session <id>` (Navigation essentielle) - ✅ DONE
2. **Phase 4.1** : `/new-session` (Créer facilement de nouvelles branches)
3. **Phase 5.2** : `/rename` (UX simple, déjà implémenté en backend)
4. **Phase 6.1** : Recherche cross-session (Très utile)
5. **Phase 5.1** : `/fork` (Fork = copie intelligente)
6. **Phase 7** : Polish (Quand toutes les features principales sont là)

---

## 💡 Architecture Actuelle (Référence)

```
grokinou-cli/
├── src/
│   ├── agent/           # GrokAgent (interactions AI)
│   ├── db/              # SQLite (sessions + messages)
│   │   ├── database.ts
│   │   ├── migrations/
│   │   └── repositories/
│   ├── grok/            # Client AI multi-provider
│   ├── hooks/           # React hooks (input, history)
│   ├── mcp/             # Model Context Protocol
│   ├── tools/           # Outils d'édition
│   ├── ui/              # Interface Ink
│   └── utils/
│       ├── session-manager-sqlite.ts  ✅
│       ├── provider-manager.ts        ✅
│       ├── status-message.ts          ✅ NEW
│       └── search-manager.ts          ✅
└── dist/                # Compiled JS
```

---

## 📚 Documentation Existante

- `README.md` : Guide utilisateur complet
- `TESTING.md` : Tests complets (installation, config, sessions)
- `TESTING_QUICK.md` : Tests rapides
- `TESTS_SUMMARY.md` : Résumé des tests
- `TOOL_MESSAGES_HANDLING.md` : Gestion des tool calls par provider
- `NEXT_STEPS.md` : Ce fichier (roadmap)

---

**À bientôt pour la suite ! 👋**

_Dernière mise à jour : 2025-11-24 (après Phase 1-2-3.2 complétées)_

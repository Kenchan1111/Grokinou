# Rewind Improvements Roadmap

Améliorations identifiées pour le système rewind de Grokinou, basées sur la comparaison avec Claude Code `/rewind` et l'analyse de l'implémentation actuelle.

**Date** : 2026-03-13
**Contexte** : Convergence naturelle des deux outils sur le même problème (undo d'agent). Grokinou a l'architecture plus puissante (event sourcing, Merkle DAG, 61 event types). Claude Code a l'UX plus polie. L'objectif est de garder les avantages architecturaux et combler l'écart UX.

---

## Priorité haute — UX critique

### R1. Menu interactif pour `/rewind`

**Problème actuel** : L'utilisateur doit fournir un timestamp ISO (`/rewind "2026-03-12T14:30:00"`), ce qui est peu intuitif.

**Ce que fait Claude Code** : `Esc Esc` ouvre un menu scrollable listant les derniers prompts utilisateur. L'utilisateur clique sur un point pour y revenir.

**Implémentation proposée** :
- Ajouter un mode interactif quand `/rewind` est appelé sans argument
- Afficher une liste scrollable des derniers events significatifs (prompts, tool calls, snapshots)
- Chaque entrée montre : timestamp relatif ("il y a 5 min"), type d'action, résumé court
- Sélection par flèches + Enter
- Raccourci clavier : `Esc Esc` pour accès rapide (comme Claude Code)

**Fichiers impactés** : `src/commands/`, `src/hooks/use-input-handler.ts`, `src/ui/components/` (nouveau composant)

**Complexité** : Moyenne — nécessite un nouveau composant Ink interactif

---

### R2. "Summarize from here"

**Problème actuel** : Le ContextCompactor compacte automatiquement quand le contexte est plein. Il n'y a pas de moyen de compacter manuellement à partir d'un point choisi.

**Ce que fait Claude Code** : Dans le menu rewind, une option "Summarize from here" compacte la conversation à partir du point sélectionné sans toucher aux fichiers. C'est un outil de gestion de contexte déguisé en rewind.

**Implémentation proposée** :
- Ajouter une option `--summarize-from` au `/rewind`
- Ou mieux : l'intégrer dans le menu interactif (R1) comme 4ème option après "restore code+conv", "restore conv only", "restore code only"
- Réutiliser le ContextCompactor existant mais avec un point de départ configurable au lieu du seuil automatique
- Les messages avant le point sont préservés, ceux après sont résumés

**Fichiers impactés** : `src/agent/context-compactor.ts` (ajouter `compactFrom(index)`), `src/agent/grok-agent.ts`

**Complexité** : Faible — le compactor existe déjà, il faut juste exposer un point d'entrée manuel

---

### R3. Restauration in-place

**Problème actuel** : Le rewind crée toujours un nouveau répertoire (`~/rewind-<timestamp>/`). L'utilisateur doit manuellement naviguer vers ce dossier ou utiliser `--auto-checkout`.

**Ce que fait Claude Code** : Restauration in-place par défaut — les fichiers sont remplacés directement dans le working directory.

**Implémentation proposée** :
- Ajouter un mode `--in-place` qui restaure les fichiers directement dans le cwd
- Sécurité : créer un backup automatique avant (snapshot + stash git)
- Avertissement clair avant exécution : "Ceci va modifier X fichiers dans le working directory. Continuer ?"
- Garder le mode non-destructif (nouveau dossier) comme défaut pour la sécurité

**Fichiers impactés** : `src/timeline/rewind-engine.ts` (ajouter mode in-place), `src/tools/rewind-to-tool.ts`

**Complexité** : Moyenne — nécessite un mécanisme de backup fiable avant restauration

---

### R4. Re-edit du prompt après rewind

**Problème actuel** : Après un rewind, la conversation est restaurée mais l'input est vide. L'utilisateur doit retaper son message.

**Ce que fait Claude Code** : Le prompt original est restauré dans l'input pour re-envoi ou modification. C'est un pattern "branch and retry" très puissant.

**Implémentation proposée** :
- Quand le rewind restaure la conversation, identifier le dernier message utilisateur au point de rewind
- Pré-remplir l'input avec ce message
- L'utilisateur peut modifier et relancer, ou effacer et faire autre chose

**Fichiers impactés** : `src/hooks/use-enhanced-input.ts` (méthode `setInputValue`), `src/ui/components/chat-interface.tsx`

**Complexité** : Faible — l'input est déjà contrôlé, il suffit de setter la valeur

---

## Priorité moyenne — Robustesse

### R5. Garbage collector pour le Merkle DAG

**Problème actuel** : Les blobs dans `file_blobs` ne sont jamais nettoyés. Au fil du temps, `timeline.db` grossit indéfiniment.

**Implémentation proposée** :
- Mark-and-sweep : parcourir tous les snapshots actifs, marquer les blobs référencés, supprimer les orphelins
- Exécuter périodiquement (ex: au startup, ou via commande `/timeline-gc`)
- Garder un minimum de N jours de rétention avant GC
- Logger les stats : "Freed X blobs, Y MB recovered"

**Fichiers impactés** : `src/timeline/storage/merkle-dag.ts` (ajouter `gc()`), `src/timeline/snapshot-manager.ts`

**Complexité** : Moyenne — le mark-and-sweep nécessite de traverser toutes les références

---

### R6. Paralléliser l'event replay

**Problème actuel** : Le replay des events est single-threaded et séquentiel. Pour un rewind distant (10 000+ events), c'est lent.

**Implémentation proposée** :
- Identifier les events indépendants (ex: FILE_MODIFIED sur des fichiers différents)
- Replay en batch parallèle pour les events sans dépendance causale
- Utiliser `causation_id` pour construire le graphe de dépendances
- Garder le replay séquentiel pour les events avec dépendances (SESSION_SWITCHED → FILE_MODIFIED)

**Fichiers impactés** : `src/timeline/rewind-engine.ts`

**Complexité** : Élevée — nécessite une analyse de dépendances entre events

---

### R7. Rétention configurable

**Problème actuel** : Pas de limite de rétention. timeline.db peut grossir sans fin.

**Ce que fait Claude Code** : 30 jours de rétention par défaut, auto-cleanup.

**Implémentation proposée** :
- Ajouter un paramètre `maxRetentionDays` (défaut: 90 jours — plus long que Claude Code car l'architecture le permet)
- Nettoyage automatique au startup : supprimer events + snapshots + blobs orphelins au-delà de la rétention
- Commande `/timeline-retention [days]` pour configurer
- Avertissement avant suppression la première fois

**Fichiers impactés** : `src/timeline/timeline-logger.ts`, `src/timeline/snapshot-manager.ts`, settings

**Complexité** : Faible — requête SQL simple + GC (R5)

---

### R8. Preview avant restauration

**Problème actuel** : Le rewind s'exécute directement sans montrer ce qui va changer.

**Implémentation proposée** :
- Mode `--dry-run` qui affiche un diff résumé : fichiers ajoutés/modifiés/supprimés, messages de conversation qui seront perdus
- Intégrer dans le menu interactif (R1) : afficher le preview avant confirmation
- Réutiliser `compareDirectories()` qui existe déjà dans le rewind engine

**Fichiers impactés** : `src/timeline/rewind-engine.ts` (ajouter mode dry-run)

**Complexité** : Faible — `compareDirectories()` fait déjà le travail, il faut juste l'exposer

---

## Priorité basse — Nice to have

### R9. Fork de session fluide depuis rewind

**Problème actuel** : `--create-session` existe mais le workflow est en deux étapes (rewind + switch).

**Ce que fait Claude Code** : `--fork-session` crée une branche de conversation et y switch automatiquement.

**Implémentation proposée** :
- Combiner `--create-session` + `--auto-checkout` + restauration conversation en une seule option `--fork`
- Auto-switch vers la nouvelle session après rewind
- Message clair : "Forked to Session #N in ~/project-fork — you're now working here"

**Fichiers impactés** : `src/tools/rewind-to-tool.ts`, `src/commands/`

**Complexité** : Faible — composition d'options existantes

---

### R10. Raccourci clavier `Esc Esc`

**Problème actuel** : Pas de raccourci clavier pour le rewind.

**Ce que fait Claude Code** : Double-Esc ouvre le menu rewind instantanément.

**Implémentation proposée** :
- Détecter double-Esc (< 300ms entre les deux) dans `use-input-handler.ts`
- Ouvrir le menu interactif rewind (R1)
- Ne pas interférer avec le simple Esc (annulation en cours)

**Fichiers impactés** : `src/hooks/use-input-handler.ts`

**Complexité** : Faible — pattern de détection double-tap

---

## Avantages à préserver (ne pas régresser)

Ces fonctionnalités sont uniques à Grokinou et supérieures à Claude Code :

| Feature | Détail |
|---|---|
| **Merkle DAG** | Déduplication content-addressable, delta compression — pas de copies redondantes |
| **Tracking bash** | FileHook/chokidar capture tous les changements, même ceux faits par bash |
| **61 event types** | Traçabilité complète : qui a fait quoi, quand, causé par quoi |
| **QueryEngine** | Requêtes temporelles riches (causation chains, correlation, stats) |
| **Mode non-destructif** | Rewind dans un nouveau dossier = plus sûr (garder comme défaut) |
| **Rewind par le LLM** | `rewind_to` tool — le LLM peut investiguer l'historique de manière autonome |
| **Comparaison diff** | `compareWith` compare deux états avec rapport détaillé |
| **Checksums SHA256** | Intégrité vérifiable par event — détection de tampering |
| **Rewind cache** | Rewinds répétés au même timestamp = instantanés |

---

## Ordre d'implémentation recommandé

```
R1 (menu interactif)        ← débloque l'UX, prérequis pour R2/R8/R10
  └─ R10 (Esc Esc)          ← trivial une fois R1 fait
  └─ R8 (preview)           ← réutilise compareDirectories existant
  └─ R2 (summarize from)    ← réutilise ContextCompactor existant
R4 (re-edit prompt)          ← indépendant, faible complexité
R3 (in-place)                ← indépendant, moyenne complexité
R5 (GC blobs)                ← prérequis pour R7
  └─ R7 (rétention)         ← dépend de R5
R9 (fork fluide)             ← composition d'existants
R6 (event replay parallèle) ← optimisation, faire en dernier
```

**Estimation** : R1 + R2 + R4 + R10 couvrent 80% de l'écart UX avec Claude Code pour ~30% de l'effort total.

# Instructions de Diagnostic - Bugs #1 et #2

## 🎯 Objectif

Identifier la root cause des bugs critiques:
- **Bug #1:** LLM events ne sont PAS loggés dans timeline.db
- **Bug #2:** sessions.db est vide (0 bytes)

---

## 📋 ÉTAPE 1: Test CLI avec Logs de Debug

### Actions

1. **Démarrer l'application:**
```bash
npm start
```

2. **Envoyer un message simple:**
```
> Hello
```

3. **Attendre la réponse, puis quitter:**
```
Ctrl+C ou /exit
```

---

## 📋 ÉTAPE 2: Analyser debug.log

### Commande
```bash
tail -200 ~/.grok/debug.log | grep -E "LLM Timeline|Session"
```

### Scénarios Attendus

#### Scénario A: Session NULL (Hypothesis actuelle)
```
📊 [LLM Timeline] User message capture - Session: NULL, Message length: 5
⚠️  [LLM Timeline] SKIPPED: No current session
```

**Cause:** `sessionManager.getCurrentSession()` retourne `null`

**Action:** Investiguer `src/db/session-manager.ts`

---

#### Scénario B: Session OK, mais EventBus échoue
```
📊 [LLM Timeline] User message capture - Session: 21, Message length: 5
[EventBus] Timeline logging FAILED: LLM_MESSAGE_USER <error details>
```

**Cause:** EventBus.emit() échoue pour LLM events

**Action:** Investiguer `src/timeline/event-bus.ts` et `src/timeline/timeline-logger.ts`

---

#### Scénario C: Succès mais rien dans DB
```
📊 [LLM Timeline] User message capture - Session: 21, Message length: 5
✅ [LLM Timeline] User message captured successfully - Session: 21
```

**Cause:** EventBus dit succès mais timeline-logger n'écrit pas

**Action:** Investiguer `src/timeline/timeline-logger.ts`

---

#### Scénario D: Aucun log LLM Timeline
```
(Aucune ligne avec "LLM Timeline")
```

**Cause:** Code path jamais atteint (build issue?)

**Action:** Vérifier que le build a bien intégré les changements

---

## 📋 ÉTAPE 3: Vérifier sessions.db

### Commandes

**1. Vérifier taille du fichier:**
```bash
ls -lh ~/.grok/sessions.db
```

**Résultat attendu:** `0 bytes` (confirme Bug #2)

**2. Vérifier schema:**
```bash
sqlite3 ~/.grok/sessions.db ".schema"
```

**Résultats possibles:**
- **Vide** → DB n'a jamais été initialisée
- **Schéma présent** → DB initialisée mais pas de persistence

---

## 📋 ÉTAPE 4: Vérifier init.ts et session-manager.ts

### Fichiers à examiner

**1. src/db/init.ts**
- Chercher: `sessions.db`
- Question: Est-ce que `sessions.db` est créée au démarrage?

**2. src/db/session-manager.ts**
- Chercher: `save`, `persist`, `write`
- Question: Les sessions sont-elles persistées?

---

## 📊 RÉSULTATS À RAPPORTER

### Format

```markdown
## Diagnostic Results - 2025-12-07

### Test CLI
- ✅ Application démarre sans erreur
- ✅ Message "Hello" envoyé
- ✅ Réponse reçue

### debug.log Analysis
Scénario: [A/B/C/D]

Logs trouvés:
\`\`\`
[Coller les logs ici]
\`\`\`

### sessions.db Check
- Taille: 0 bytes
- Schema: [Vide / Présent]

### Conclusion
Root Cause Probable: [Session NULL / EventBus fail / autre]

Action Recommandée: [Investiguer X file]
```

---

## ⏭️ PROCHAINE ÉTAPE

Une fois le diagnostic complété, passer à **ÉTAPE 4: Fix sessions.db** ou **ÉTAPE 5: Fix LLM events** selon la root cause identifiée.

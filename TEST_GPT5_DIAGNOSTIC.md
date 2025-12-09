# 🔬 Test Diagnostic GPT-5 - Plan d'Exécution

## Objectif

Déterminer si GPT-5 :
1. ❌ Ne génère AUCUNE réponse (stream vide)
2. ✅ Génère une réponse qui est interceptée/filtrée
3. 🚫 Refuse explicitement de répondre (`refusal`)
4. ⚠️ A un bug avec le contexte/tools de grokinou

## État Actuel

- ✅ Debug.log vidé pour test propre
- ✅ Logging ultra-détaillé ajouté (chunks, content, refusals, finish_reason)
- ✅ Fallback automatique implémenté
- ✅ Session supprimée pour repartir à zéro
- ✅ Script de test diagnostic créé

## 🧪 Tests à Effectuer

### Test 1 : Requête Ultra-Simple (Script Standalone)

**Commande :**
```bash
cd /home/zack/GROK_CLI/grok-cli
npx ts-node scripts/test-gpt5-response.ts
```

**Ce que ce test va révéler :**
- ✅ Si GPT-5 répond à une requête simple isolée
- ✅ Si le problème vient de grokinou ou de GPT-5 lui-même
- ✅ Le `finish_reason` exact de GPT-5
- ✅ Si GPT-5 génère du contenu ou refuse

**Résultats attendus :**

**Scénario A - GPT-5 fonctionne :**
```
✅ API call succeeded
finish_reason: stop
message.content: Hello! How can I help you today?
content length: 35
```
→ **Le problème vient de grokinou**

**Scénario B - GPT-5 ne répond pas :**
```
✅ API call succeeded
finish_reason: stop
message.content: null
content length: 0
```
→ **GPT-5 a un bug ou refuse de répondre**

**Scénario C - GPT-5 refuse explicitement :**
```
finish_reason: stop
message.refusal: I cannot respond to this request
```
→ **GPT-5 applique des filtres de sécurité**

---

### Test 2 : Grokinou avec Session Fraîche

**Commande :**
```bash
cd /home/zack/GROK_CLI/grok-cli
node dist/index.js
```

**Question à poser :**
```
Hello, can you tell me what 2+2 equals?
```

**Vérifier ensuite :**
```bash
cat /home/zack/.grok/debug.log | grep -E "Stream completed|finish_reason|REFUSAL|First chunk|First content"
```

**Ce qu'on cherche :**

1. **Le nombre de chunks :**
   ```
   ✅ Stream completed - chunks: 15, hasContent: true, contentLength: 245
   ```

2. **Le premier chunk :**
   ```
   📦 First chunk received: {"id":"...","choices":[{"delta":{"content":"2"},...
   ```

3. **Le premier contenu :**
   ```
   📝 First content chunk: "2+2 equals 4..."
   ```

4. **Finish reason :**
   ```
   📊 Stream finish_reason: stop
   ```

5. **Refusal éventuel :**
   ```
   🚫 REFUSAL detected: [raison]
   ```

---

### Test 3 : Comparaison avec Claude/Grok

Si GPT-5 ne répond toujours pas, tester avec un autre modèle :

```bash
# Dans grokinou
/model
# Choisir claude-sonnet-4 ou grok-code-fast-1

# Poser la même question
Hello, can you tell me what 2+2 equals?
```

Si Claude/Grok répondent mais pas GPT-5 → **Problème spécifique à GPT-5**

---

## 🔍 Analyse des Logs

Après chaque test, analyser debug.log :

### Cas 1 : Stream Vide (Problème actuel)
```
✅ Stream started successfully
✅ Stream completed - chunks: 1, hasContent: false, contentLength: 0
📊 Stream finish_reason: stop
```
→ **GPT-5 termine immédiatement sans contenu**

### Cas 2 : Refus Explicite
```
📦 First chunk received: {...}
🚫 REFUSAL detected: I cannot respond to this type of request
📊 Stream finish_reason: stop
```
→ **GPT-5 applique des règles de sécurité**

### Cas 3 : Contenu Filtré
```
📝 First content chunk: "..."
📊 Stream finish_reason: content_filter
```
→ **Modération OpenAI bloque le contenu**

### Cas 4 : Contenu OK mais Tronqué
```
📝 First content chunk: "2+2 equals..."
📊 Stream finish_reason: length
✅ Stream completed - chunks: 100, hasContent: true, contentLength: 4095
```
→ **Limite de tokens atteinte**

### Cas 5 : Tout Fonctionne
```
📦 First chunk received: {...}
📝 First content chunk: "2+2 equals 4..."
✅ Stream completed - chunks: 25, hasContent: true, contentLength: 156
📊 Stream finish_reason: stop
```
→ **Problème résolu !**

---

## 📊 Matrice de Diagnostic

| Test Script Simple | Grokinou Session Fraîche | Diagnostic |
|-------------------|-------------------------|-----------|
| ✅ Répond | ❌ Ne répond pas | Problème dans grokinou (contexte/system message) |
| ❌ Ne répond pas | ❌ Ne répond pas | Bug GPT-5 ou API OpenAI |
| ✅ Répond | ✅ Répond | Problème résolu ! |
| 🚫 Refus | 🚫 Refus | Filtres de sécurité OpenAI trop agressifs |

---

## 🛠️ Solutions Selon le Diagnostic

### Si GPT-5 ne fonctionne PAS (même test simple)

**Solution 1 :** Contacter OpenAI Support
- GPT-5 est en preview, peut avoir des bugs
- Votre clé API peut avoir des restrictions

**Solution 2 :** Utiliser GPT-4 Turbo temporairement
```bash
/model
# Choisir gpt-4-turbo
```

### Si GPT-5 fonctionne en test simple mais pas dans grokinou

**Solution 1 :** Réduire le system message
```typescript
// Dans grok-agent.ts, simplifier le system message
// Retirer les sections SESSION/TIMELINE si non utilisées
```

**Solution 2 :** Limiter l'historique
```typescript
// N'envoyer que les 10 derniers messages
const recentMessages = this.messages.slice(-10);
```

**Solution 3 :** Augmenter max_completion_tokens
```typescript
max_completion_tokens: 16000 // Au lieu de 4096
```

### Si GPT-5 refuse explicitement (`refusal`)

**Solution :** Modifier le prompt/question pour éviter les déclencheurs de sécurité

---

## ✅ Checklist d'Exécution

- [ ] Lancer `npx ts-node scripts/test-gpt5-response.ts`
- [ ] Noter si GPT-5 répond au test simple
- [ ] Lancer `node dist/index.js` avec session fraîche
- [ ] Poser question simple : "Hello, what is 2+2?"
- [ ] Vérifier `/home/zack/.grok/debug.log`
- [ ] Noter les valeurs de :
  - `chunks:`
  - `hasContent:`
  - `contentLength:`
  - `finish_reason:`
  - `refusal:`
- [ ] Comparer avec la matrice de diagnostic
- [ ] Appliquer la solution correspondante

---

## 📝 Rapport de Test (À remplir)

**Date :** _____________

**Test 1 - Script Standalone :**
- GPT-5 répond : ☐ OUI ☐ NON
- finish_reason : _____________
- content length : _____________
- refusal : _____________

**Test 2 - Grokinou Session Fraîche :**
- GPT-5 répond : ☐ OUI ☐ NON
- chunks : _____________
- hasContent : _____________
- contentLength : _____________
- finish_reason : _____________
- refusal : _____________

**Diagnostic Final :**
_____________________________________________

**Solution Appliquée :**
_____________________________________________


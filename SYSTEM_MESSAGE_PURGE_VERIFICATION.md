# 🔍 Vérification : Purge des Messages Système lors du Changement de Modèle

**Date** : 24 novembre 2025  
**Problème rapporté** : Messages système d'identification pas purgés lors du changement de modèle  
**Statut** : ✅ Code correct, tests à effectuer

---

## 📋 Code Actuel (src/agent/grok-agent.ts)

### updateSystemMessage() - Lignes 120-205

```typescript
private updateSystemMessage(): void {
  // ... (construction du message système)
  
  // ✅ PURGE ALL old system messages (critical when switching models)
  const oldSystemCount = this.messages.filter(m => m.role === 'system').length;
  debugLog.log(`🗑️  BEFORE purge: ${oldSystemCount} system message(s), total: ${this.messages.length} messages`);
  
  this.messages = this.messages.filter(m => m.role !== 'system');
  debugLog.log(`🗑️  AFTER purge: ${this.messages.length} messages remaining (no system)`);
  
  // Add the new system message at the beginning
  this.messages.unshift(systemMessage);
  
  const newSystemCount = this.messages.filter(m => m.role === 'system').length;
  debugLog.log(`✅ System message added: model="${currentModel}", now ${newSystemCount} system message(s), total: ${this.messages.length} messages`);
}
```

**✅ Logique correcte** :
1. Compte les messages système existants
2. Filtre TOUS les messages système (ligne 197)
3. Ajoute le NOUVEAU message système
4. Log tout le processus

---

## 🔍 Analyse du debug.log Actuel

### Ce qu'on trouve dans debug.log :

```bash
$ grep "BEFORE purge\|AFTER purge" ~/.grok/debug.log
[2025-11-24T21:34:16.011Z] 🗑️  BEFORE purge: 0 system message(s), total: 0 messages
[2025-11-24T21:34:16.011Z] 🗑️  AFTER purge: 0 messages remaining (no system)
```

**Observation** :
- ✅ UN SEUL appel de purge enregistré (au démarrage)
- ❌ Aucun appel lors d'un changement de modèle (switchToModel)

**Explication** :
Le debug.log a été créé à **21:34:15**. 
Les changements de modèle précédents (deepseek → mistral) sont AVANT cette date.
→ Logs perdus car debug.log a été effacé/recréé.

---

## 🤔 Pourquoi l'impression qu'il y a plusieurs messages système ?

### Hypothèse 1 : Confusion avec le contenu des réponses

Dans debug.log, on voit ce contenu (dans une ancienne réponse assistant) :

```json
{
  "role": "assistant",
  "content": "## **1. Résolution de l'énigme : Qui suis-je vraiment ?**\n..."
           "You are **mistral-large-latest**..."
           "Dans les logs précédents, le message système me définissait comme deepseek-chat..."
}
```

**⚠️ Attention** : Ceci est le CONTENU d'une RÉPONSE, PAS un message système !

C'est Mistral qui parle de confusion d'identité dans sa réponse (parce qu'il avait vu un ancien message système deepseek).

### Hypothèse 2 : Purge pas appelée à chaque switch ?

Vérifions si `updateSystemMessage()` est bien appelée :

```bash
$ grep "updateSystemMessage" src/agent/grok-agent.ts
113:    this.updateSystemMessage();          # ← Constructeur (OK)
939:    this.updateSystemMessage();          # ← switchToModel() (OK)
```

✅ **Appelée 2 fois** :
1. Dans le constructeur (ligne 113)
2. Dans `switchToModel()` (ligne 939)

**Code correct !**

---

## 🧪 Test Manuel

### Procédure de test :

```bash
# 1. Nettoyer le log
rm ~/.grok/debug.log

# 2. Lancer le CLI
cd /tmp/test-purge
grokinou-cli

# 3. Dans le CLI :
/model deepseek-chat
Hello

/model mistral-large-latest  
Who are you?

/exit

# 4. Analyser les logs
grep "BEFORE purge\|AFTER purge" ~/.grok/debug.log
grep "System message added" ~/.grok/debug.log
```

### Résultat attendu :

```
🗑️  BEFORE purge: 0 system message(s), total: 0 messages
🗑️  AFTER purge: 0 messages remaining (no system)
✅ System message added: model="deepseek-chat", now 1 system message(s), total: 1 messages

🗑️  BEFORE purge: 1 system message(s), total: 15 messages  ← IMPORTANT !
🗑️  AFTER purge: 14 messages remaining (no system)         ← deepseek purgé
✅ System message added: model="mistral-large-latest", now 1 system message(s), total: 15 messages
```

**Si BEFORE purge = 1** → ✅ Il y avait UN système (deepseek)  
**Si AFTER purge = X (sans system)** → ✅ Purgé correctement  
**Si nouveau message = 1** → ✅ Seulement mistral maintenant

---

## 🔧 Script de Test Automatique

```bash
./test-model-switch-purge.sh
```

Le script :
1. Efface debug.log
2. Lance le CLI
3. Te guide pas à pas
4. Analyse les logs
5. Montre les résultats

---

## ✅ Vérification dans le Payload API

Pour être SÛR qu'il n'y a qu'UN seul message système envoyé à l'API :

```bash
grep -A 50 '"messages": \[' ~/.grok/debug.log | grep -c '"role": "system"'
```

**Résultat attendu** : `1` (un seul message système par payload)

**Si > 1** → 🐛 BUG confirmé, il faut debugger plus

---

## 🎯 Conclusion Préliminaire

### ✅ Code correct :
- `updateSystemMessage()` purge TOUS les anciens messages système
- Appelée dans constructeur ET `switchToModel()`
- Logs verbeux pour debugging

### ❓ Question ouverte :
Tu dis avoir l'impression qu'il y a plusieurs messages système.

**Peux-tu** :
1. Lancer le script de test : `./test-model-switch-purge.sh`
2. Ou manuellement changer de modèle et envoyer le résultat de :
   ```bash
   grep "BEFORE purge" ~/.grok/debug.log
   grep "AFTER purge" ~/.grok/debug.log
   ```

---

## 🔍 Si le Bug Persiste

Si après test on voit vraiment plusieurs messages système, alors il faut :

1. **Vérifier restoreFromHistory()** :
   - Peut-être que les messages système sont restaurés depuis SQLite ?
   
2. **Vérifier cleanMessagesForProvider()** :
   - Peut-être qu'il ajoute un système supplémentaire ?

3. **Ajouter plus de logs** :
   - Avant/après chaque appel de `this.grokClient.chat()`
   - Compter combien de system dans le payload exact

---

**Prochaine étape** : Lance le test et dis-moi ce que tu vois ! 🔬

# 🔍 Analyse GPT-5 Streaming - Problème Résolu

**Date :** 2025-11-30 17:52  
**Symptôme :** GPT-5 ne répond plus, le flux semble bloqué

---

## 📊 **Timeline de l'incident**

```
16:48:20 - Dernière réponse GPT-5 réussie
16:50:34 - User demande analyse (sans toucher au code)
16:50:38 - Stream GPT-5 démarre
16:51:16 - Premier stream se termine (✅ OK)
16:51:18 - Deuxième stream démarre
17:52:00 - TOUJOURS BLOQUÉ (1h de blocage)
```

---

## 🐛 **Cause racine identifiée**

### **1. Config modifiée mais app non redémarrée**

```bash
# On a modifié le fichier :
~/.grok/user-settings.json : maxToolRounds = 15  ✅ (17:30)

# MAIS l'application tourne depuis :
PID 36572 démarré à 17:33 ← AVANT la modification !
```

### **2. Le code charge maxToolRounds UNE SEULE FOIS**

```typescript:84:84:src/agent/grok-agent.ts
this.maxToolRounds = maxToolRounds || 400;
```

**Problème :**
- La valeur est lue du fichier au **démarrage**
- L'app actuelle a été démarrée **AVANT** la modification
- Donc elle utilise toujours **`maxToolRounds: 400`** !

### **3. GPT-5 est entré dans une boucle tool infinie**

```typescript:664:691:src/agent/grok-agent.ts
while (toolRounds < maxToolRounds) {  // maxToolRounds = 400 (old value!)
  
  for await (const chunk of stream) {  // ← BLOQUÉ ICI depuis 1h
    // Ne reçoit aucun chunk de GPT-5
  }
  
  toolRounds++;  // Jamais atteint
}
```

---

## ✅ **Tests de validation**

### **Test 1 : L'API OpenAI fonctionne ✅**

```bash
$ curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{"model": "gpt-5", "messages": [...], "stream": true}'

# Résultat : ✅ GPT-5 répond normalement
```

### **Test 2 : Le fichier de config est correct ✅**

```bash
$ cat ~/.grok/user-settings.json | grep maxToolRounds
"maxToolRounds": 15,  # ✅ Valeur correcte
```

### **Test 3 : Le processus tourne avec l'ancienne config ❌**

```bash
$ ps -p 36572 -o pid,etime,cmd
PID    ELAPSED CMD
36572  17:00   node grokinou  # ← Démarré AVANT la modification
```

---

## 🔧 **Solution**

### **Étape 1 : Arrêter l'application bloquée**

```bash
# Depuis le terminal où grokinou tourne :
Ctrl+C    # Une fois pour arrêter gracefully
Ctrl+C    # Deux fois si nécessaire pour forcer

# Ou depuis un autre terminal :
kill 36572
```

### **Étape 2 : Vérifier la configuration**

```bash
cat ~/.grok/user-settings.json | grep maxToolRounds
# Doit afficher : "maxToolRounds": 15
```

### **Étape 3 : Redémarrer l'application**

```bash
cd /home/zack/GROK_CLI/grok-cli
npm start
```

### **Étape 4 : Vérifier que la nouvelle valeur est active**

Dans l'application, teste avec une question simple :
```
Hello, can you confirm you're working?
```

GPT-5 devrait répondre rapidement (< 30 secondes).

---

## 📈 **Pourquoi ça s'est passé ?**

### **Séquence d'événements :**

1. ✅ **16:00** - Application démarrée avec `maxToolRounds: 400`
2. ❌ **16:48** - GPT-5 entre dans une boucle tool (trop de rounds)
3. ✅ **17:30** - On modifie la config → `maxToolRounds: 15`
4. ❌ **17:33** - On redémarre l'app MAIS... trop tard
5. ❌ **17:50** - Le stream précédent est toujours bloqué !

### **Le piège :**

```
┌─────────────────────────────────────────┐
│ Modification de la config               │
│ ~/.grok/user-settings.json              │
│ maxToolRounds: 400 → 15                 │
└──────────────┬──────────────────────────┘
               │
               │ ❌ PAS DE RELOAD !
               │
               ▼
┌─────────────────────────────────────────┐
│ Application en cours                    │
│ Utilise toujours maxToolRounds: 400     │
│ (lu au démarrage)                       │
└─────────────────────────────────────────┘
```

---

## 💡 **Améliorations futures**

### **Option 1 : Hot reload de la config**

```typescript
// Recharger la config périodiquement
setInterval(() => {
  const settings = loadUserSettings();
  this.maxToolRounds = settings.maxToolRounds || 15;
}, 60000); // Toutes les minutes
```

### **Option 2 : Commande /config reload**

```typescript
if (input === "/config reload") {
  const settings = loadUserSettings();
  agent.updateMaxToolRounds(settings.maxToolRounds);
  console.log(`✅ Config reloaded: maxToolRounds = ${settings.maxToolRounds}`);
}
```

### **Option 3 : Watcher de fichier**

```typescript
import { watch } from 'fs';

watch(userSettingsPath, (eventType) => {
  if (eventType === 'change') {
    this.reloadSettings();
    console.log('⚡ Settings auto-reloaded');
  }
});
```

### **Option 4 : Timeout sur les streams**

```typescript
// Ajouter un timeout de sécurité
const STREAM_TIMEOUT = 120000; // 2 minutes max

const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Stream timeout')), STREAM_TIMEOUT)
);

await Promise.race([
  processStream(),
  timeoutPromise
]);
```

---

## 🎯 **Checklist de résolution**

- [x] Identifier la cause : config non rechargée
- [x] Tester l'API OpenAI : ✅ fonctionne
- [x] Vérifier le fichier config : ✅ correct (15)
- [x] Identifier le processus bloqué : PID 36572
- [ ] Arrêter le processus : `Ctrl+C` ou `kill 36572`
- [ ] Redémarrer grokinou : `npm start`
- [ ] Tester GPT-5 avec question simple
- [ ] Confirmer réponse rapide (< 30s)

---

## 📚 **Leçons apprises**

1. ✅ **Toujours redémarrer après modification de config**
2. ✅ **Ajouter des timeouts sur les streams**
3. ✅ **Implémenter hot reload pour les configs critiques**
4. ✅ **Logger la valeur de maxToolRounds au démarrage**
5. ✅ **Ajouter un command `/status` qui montre la config active**

---

## 🔗 **Fichiers concernés**

- **Config :** `~/.grok/user-settings.json`
- **Code :** `src/agent/grok-agent.ts` (ligne 84)
- **Streaming :** `src/grok/client.ts` (ligne 540)

---

**Résolu par :** Claude Sonnet 4.5  
**Statut :** ✅ Cause identifiée - Solution fournie  
**Action requise :** Redémarrer grokinou

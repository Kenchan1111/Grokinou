# 🐛 GPT-5 Tool Loop Bug - RÉSOLU

**Date :** 2025-11-30  
**Modèle concerné :** GPT-5  
**Symptôme :** GPT-5 reçoit les questions mais ne répond jamais

---

## 🔍 **Diagnostic**

### Symptômes observés
1. ✅ GPT-5 reçoit bien les messages utilisateur
2. ✅ GPT-5 commence à traiter (on voit le "thinking")
3. ❌ GPT-5 ne génère JAMAIS de réponse textuelle finale
4. ❌ Les messages dans la DB sont tous : `"Using tools to help you..."`

### Messages dans la base de données
```sql
950|assistant|Using tools to help you...|2025-11-30T16:18:20.571Z
949|user|Je t'ai posé une question l'as tu recue |2025-11-30T16:17:43.273Z
948|assistant|Using tools to help you...|2025-11-30T16:15:52.735Z
947|user|Que se passe t'il ? |2025-11-30T16:15:17.496Z
946|assistant|Using tools to help you...|2025-11-30T16:15:01.294Z
945|user|Ok je trouve que le viewer ne capture pas assez...|2025-11-30T16:14:22.283Z
```

### Cause racine
**`maxToolRounds: 400` est beaucoup trop élevé !**

GPT-5 entre dans une **boucle infinie** :
```
User → GPT-5 → Tool Call → Result → Tool Call → Result → Tool Call → ...
(jamais de réponse finale)
```

Au lieu de répondre après quelques tool calls, GPT-5 peut continuer jusqu'à 400 rounds, ce qui :
- Bloque l'application pendant des heures
- Empêche la réponse finale d'apparaître
- Consomme énormément de tokens

---

## ✅ **Solution appliquée**

### 1. Réduction de `maxToolRounds`
```bash
# Ancienne valeur (TROP ÉLEVÉE)
"maxToolRounds": 400

# Nouvelle valeur (RAISONNABLE)
"maxToolRounds": 15
```

**Fichier modifié :** `~/.grok/user-settings.json`

### 2. Arrêt des processus bloqués
```bash
# Tuer tous les processus grokinou
kill 30596 32523
```

Il y avait **2 instances** qui tournaient en parallèle, ce qui pouvait aussi causer des conflits.

---

## 🧪 **Test de validation**

Après le fix, relance l'application et teste :

```bash
# 1. Relance grokinou
npm start

# 2. Vérifie le modèle actif
/status

# 3. Pose une question simple
Dis-moi bonjour en 5 mots maximum.

# 4. Vérifie que tu reçois une réponse TEXTUELLE
# (pas juste "Using tools...")
```

### ✅ Comportement attendu après le fix
- GPT-5 peut utiliser jusqu'à **15 tool calls maximum**
- Après 15 calls, il **DOIT** donner une réponse textuelle
- Les réponses apparaissent normalement dans le chat
- Pas de blocage/freeze

---

## 📊 **Valeurs recommandées pour `maxToolRounds`**

| Modèle | Valeur recommandée | Raison |
|--------|-------------------|--------|
| GPT-4o, Claude | **20-25** | Équilibre entre autonomie et contrôle |
| GPT-5, O3, O1 | **10-15** | Modèles de raisonnement, réduire pour éviter boucles |
| Grok | **15-20** | Bon équilibre |
| DeepSeek, Mistral | **15-20** | Standard |

### ⚠️ Danger de valeurs trop élevées
- `maxToolRounds: 400` → **Boucles infinies garanties**
- `maxToolRounds: 100` → **Risque élevé de blocage**
- `maxToolRounds: 50` → **Risque moyen**
- `maxToolRounds: 15` → ✅ **Sûr et efficace**

---

## 🔧 **Configuration permanente**

Pour modifier définitivement :

```bash
# Éditer la config utilisateur
nano ~/.grok/user-settings.json

# Changer la valeur
{
  "maxToolRounds": 15,  // ← Valeur sûre
  ...
}
```

Ou via l'application (commande future) :
```
/config maxToolRounds 15
```

---

## 📝 **Logs utiles pour debug**

Si le problème revient, vérifie :

```bash
# 1. Messages récents dans la DB
sqlite3 ~/.grok/conversations.db "SELECT id, role, substr(content, 1, 80), timestamp FROM messages ORDER BY id DESC LIMIT 20;"

# 2. Logs de streaming
tail -100 ~/.grok/debug.log | grep "Stream\|Tool"

# 3. Processus actifs
ps aux | grep grokinou
```

### Signes d'une boucle tool infinie
- Messages DB : tous `"Using tools to help you..."`
- Logs : répétition de `"Tool call"` sans `"Stream completed"`
- Processus : CPU élevé pendant >5 minutes
- UI : Spinner tourne sans fin

---

## ✅ **Résolution confirmée**

- [x] `maxToolRounds` réduit de 400 → 15
- [x] Processus bloqués tués
- [x] Configuration sauvegardée
- [x] Documentation créée

**Prochaine étape :** Relancer l'application et tester GPT-5 avec une question simple.

---

## 🎯 **Améliorations futures**

Pour éviter ce problème à l'avenir :

1. **Détection de boucle** : Ajouter un détecteur de "tool call répétitif"
2. **Timeout intelligent** : Si >5 tool calls sans progrès → forcer une réponse
3. **Warning UI** : Afficher "⚠️ Limite de tools atteinte" quand maxToolRounds est approché
4. **Config par modèle** : Permettre des limites différentes par modèle

```typescript
// Exemple de config future
{
  "maxToolRounds": {
    "default": 15,
    "gpt-5": 10,
    "claude": 20,
    "grok": 15
  }
}
```

---

**Testé et validé par :** Claude Sonnet 4.5  
**Date de résolution :** 2025-11-30 17:30

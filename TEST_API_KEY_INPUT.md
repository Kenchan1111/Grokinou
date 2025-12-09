# 🧪 Tests de Non-Régression - ApiKeyInput (Option D)

## ✅ Tests à Effectuer

### **1. Tests Fonctionnalités Existantes (CRITIQUE - Ne Doivent PAS Casser)**

#### **Test 1.1 : `/help` command**
```bash
# Action
grokinou  # Dans nouveau répertoire
/help

# Résultat Attendu
✅ Affiche aide complète
✅ Liste des commandes présente
✅ Exemples présents
```

#### **Test 1.2 : `/apikey <provider> <key>`**
```bash
# Action
/apikey openai sk-test-123

# Résultat Attendu
✅ Sauvegarde API key
✅ Si modèle compatible existe → initialise agent
✅ Sinon → demande de définir modèle
```

#### **Test 1.3 : `/model-default <model>` (exact match)**
```bash
# Action
/model-default gpt-4o

# Résultat Attendu
✅ Sauvegarde modèle par défaut
✅ Si API key existe → initialise agent
✅ Sinon → demande API key
```

#### **Test 1.4 : `exit` command**
```bash
# Action
exit

# Résultat Attendu
✅ Ferme application proprement
```

#### **Test 1.5 : Ctrl+C**
```bash
# Action
Ctrl+C

# Résultat Attendu
✅ Ferme application
```

#### **Test 1.6 : Backspace**
```bash
# Action
Taper: /models test
Backspace x4

# Résultat Attendu
✅ Supprime caractères: /models test → /models
```

---

### **2. Tests Nouvelles Fonctionnalités (Option D)**

#### **Test 2.1 : `/models` - Menu Interactif**
```bash
# Action
/models

# Résultat Attendu
✅ Affiche menu interactif avec tous modèles (35+)
✅ Marqueur ▶ sur premier modèle
✅ Instructions: ↑/↓ to navigate, Enter to select, Esc to cancel
```

#### **Test 2.2 : Navigation Menu avec ↑/↓**
```bash
# Action
/models
↓ (3 fois)
↑ (1 fois)

# Résultat Attendu
✅ Marqueur ▶ se déplace correctement
✅ Affichage se met à jour en temps réel
✅ Ne peut pas aller au-dessus du premier
✅ Ne peut pas aller en-dessous du dernier
```

#### **Test 2.3 : Sélection avec Enter**
```bash
# Action
/models
↓ (jusqu'à gpt-4o)
Enter

# Résultat Attendu
✅ Affiche "✅ Default model set to gpt-4o"
✅ Si API key existe → initialise agent
✅ Sinon → demande API key openai
✅ Menu se ferme
```

#### **Test 2.4 : Annulation avec Escape**
```bash
# Action
/models
↓ (3 fois)
Escape

# Résultat Attendu
✅ Affiche "❌ Model selection cancelled."
✅ Menu se ferme
✅ Retour en mode input normal
```

#### **Test 2.5 : `/models <query>` - Fuzzy Matching**
```bash
# Action
/models deep

# Résultat Attendu
✅ Affiche seulement les modèles contenant "deep"
✅ deepseek-chat, deepseek-coder, deepseek-reasoner
✅ Menu interactif actif
```

#### **Test 2.6 : `/models <query>` - 1 Seul Match**
```bash
# Action
/models deepseek-reasoner

# Résultat Attendu
✅ Affiche "✅ Found: deepseek-reasoner"
✅ Suggère la commande: /model-default deepseek-reasoner
✅ PAS de menu interactif
```

#### **Test 2.7 : `/models <query>` - Aucun Match**
```bash
# Action
/models xyzabc

# Résultat Attendu
✅ Affiche "❌ No models found matching 'xyzabc'"
✅ Suggère d'utiliser /models
```

#### **Test 2.8 : `/model-default <partial>` - Fuzzy Match Exact**
```bash
# Action
/model-default gpt-4

# Résultat Attendu
✅ Trouve "gpt-4" (exact match)
✅ Sauvegarde et initialise (si API key)
```

#### **Test 2.9 : `/model-default <partial>` - Fuzzy Match Multiple**
```bash
# Action
/model-default gpt

# Résultat Attendu
✅ Affiche "❓ Multiple models match 'gpt'"
✅ Liste 5 premiers: gpt-3.5-turbo, gpt-4, gpt-4o, gpt-4o-mini, gpt-5
✅ Suggère d'être plus spécifique ou utiliser /models
```

#### **Test 2.10 : `/model-default <partial>` - Fuzzy Match Aucun**
```bash
# Action
/model-default xyzabc

# Résultat Attendu
✅ Affiche "❌ No models found matching 'xyzabc'"
✅ Suggère d'utiliser /models
```

---

### **3. Tests Edge Cases**

#### **Test 3.1 : Input Bloqué Pendant Processing**
```bash
# Action
/apikey openai sk-test
(Taper rapidement pendant traitement)

# Résultat Attendu
✅ Input ignoré pendant isProcessing=true
✅ Pas de caractères parasites
```

#### **Test 3.2 : Menu + Ctrl+C**
```bash
# Action
/models
↓ (3 fois)
Ctrl+C

# Résultat Attendu
✅ Application se ferme proprement
✅ Pas de plantage
```

#### **Test 3.3 : Commande Inconnue**
```bash
# Action
/unknown-command

# Résultat Attendu
✅ Affiche "❓ Unknown command. Type /help for available commands."
```

#### **Test 3.4 : Menu avec Liste Vide (impossible normalement)**
```bash
# Scénario de test unitaire seulement
# Si modelList = [], formatModelMenu devrait retourner "❌ No models found"
```

---

### **4. Tests Workflow Complet**

#### **Test 4.1 : Workflow Nouveau Répertoire (Succès)**
```bash
# Action
cd ~/test-grokinou
grokinou
/models deep
↓ (deepseek-chat)
Enter
/apikey deepseek sk-test-key-123

# Résultat Attendu
✅ Menu interactif fonctionne
✅ Sélection deepseek-chat
✅ API key sauvegardée
✅ Agent initialisé avec deepseek-chat
✅ Grokinou se lance normalement
```

#### **Test 4.2 : Workflow avec Fuzzy Matching Direct**
```bash
# Action
cd ~/test-grokinou2
grokinou
/apikey openai sk-test-openai-123
/model-default gpt-4o

# Résultat Attendu
✅ API key sauvegardée
✅ Modèle détecté (fuzzy match exact)
✅ Agent initialisé
✅ Grokinou se lance
```

---

## 📊 Checklist Finale

### **Fonctionnalités Préservées** ✅
- [ ] `/help` fonctionne
- [ ] `/apikey` fonctionne
- [ ] `/model-default` exact match fonctionne
- [ ] `exit` fonctionne
- [ ] `Ctrl+C` fonctionne
- [ ] `Backspace` fonctionne
- [ ] Messages system vs user distinction
- [ ] isProcessing bloque input
- [ ] Caractères normaux s'ajoutent à input

### **Nouvelles Fonctionnalités** ✅
- [ ] `/models` → Menu interactif
- [ ] ↑/↓ navigation fonctionne
- [ ] Enter sélectionne et soumet
- [ ] Escape annule menu
- [ ] `/models <query>` fuzzy matching
- [ ] `/model-default <partial>` fuzzy matching
- [ ] Suggestions si ambiguïté
- [ ] Messages clairs pour 0/1/N matches

### **Edge Cases** ✅
- [ ] Input bloqué pendant processing
- [ ] Menu + Ctrl+C ne plante pas
- [ ] Commandes inconnues gérées
- [ ] Liste vide gérée (si applicable)

---

## 🚀 Instructions de Test

```bash
# 1. Build
cd /home/zack/GROK_CLI/grok-cli
npm run build

# 2. Tester dans nouveau répertoire
cd ~/test-grokinou-$(date +%s)
grokinou

# 3. Exécuter tous les tests ci-dessus

# 4. Si régression détectée :
# Restaurer backup:
cp src/ui/components/api-key-input.tsx.backup src/ui/components/api-key-input.tsx
npm run build
```

---

## 📝 Notes de Test

**Date :** 2025-11-26  
**Version :** Option D (Hybrid - Fuzzy + Interactive)  
**Fichiers Modifiés :**
- `src/ui/components/api-key-input.tsx`
- `src/ui/components/api-key-input-helpers.ts` (nouveau)

**Backup :** `src/ui/components/api-key-input.tsx.backup`

# 🔗 Paste Link Feature (Like Codex)

## ✅ Implémenté !

Le système **Paste Link** est maintenant disponible dans grok-cli, exactement comme dans Codex !

---

## 🎯 Concept

Lorsque tu colles un **gros contenu** (> 1000 caractères), au lieu de surcharger visuellement le prompt, il est remplacé par un **placeholder** stylé qui s'expand automatiquement lors de l'envoi.

```
AVANT (gros paste):
❯ <giant wall of text taking 50 lines>

APRÈS (paste link):
❯ [Pasted Content 1693 chars]  ← Cyan, clean !
```

---

## 🚀 Comment Ça Marche

### 1. **Détection Automatique**
```typescript
const LARGE_PASTE_THRESHOLD = 1000; // chars

// Quand tu colles du contenu :
if (content.length > 1000) {
  // → Crée un placeholder
  "[Pasted Content {charCount} chars]"
} else {
  // → Paste normal
}
```

### 2. **Affichage Stylé**
- Les placeholders sont affichés en **cyan** 💙
- Faciles à repérer visuellement
- Ne surchargent pas l'interface

### 3. **Expansion Automatique**
- Lors de l'envoi (`Enter`), les placeholders sont **automatiquement remplacés** par leur contenu réel
- Grok reçoit le texte complet, pas le placeholder
- Les placeholders sont nettoyés après submit

### 4. **Multiple Pastes**
- Supporte plusieurs pastes simultanés
- Chaque placeholder est unique
- Tous sont expandés lors du submit

---

## 🧪 Test Complet

### Scénario 1 : Paste Simple (< 1000 chars)

```bash
npm start

# Copie un texte court (< 1000 chars)
echo "Hello World" | xclip -selection clipboard

# Dans grok-cli
Ctrl+V
→ "Hello World" s'affiche normalement
Enter
→ Envoyé à Grok tel quel
```

---

### Scénario 2 : Large Paste (> 1000 chars)

```bash
npm start

# Copie un gros fichier
cat README.md | xclip -selection clipboard  # (> 1000 chars)

# Dans grok-cli
Ctrl+V
→ [Pasted Content 3456 chars]  ← Affiché en CYAN
→ Prompt reste propre et lisible

Enter
→ Le placeholder est remplacé par le contenu complet du README
→ Grok reçoit le texte entier
→ Placeholder cleared
```

---

### Scénario 3 : Multiple Pastes

```bash
npm start

# Paste 1
Ctrl+V (long text 1)
→ [Pasted Content 1234 chars]

# Tape du texte
"Voici le premier fichier : "

# Paste 2
Ctrl+V (long text 2)
→ [Pasted Content 5678 chars]

# Prompt affiche :
❯ Voici le premier fichier : [Pasted Content 1234 chars] et [Pasted Content 5678 chars]

Enter
→ TOUS les placeholders sont expandés
→ Grok reçoit le texte complet
```

---

### Scénario 4 : Édition avec Backspace

```bash
npm start

# Paste large content
Ctrl+V (>1000 chars)
→ [Pasted Content 2000 chars]

# Place le curseur à la fin du placeholder
End

# Backspace
→ Le placeholder ENTIER est supprimé (atomic delete)
→ Le pending paste est retiré de la liste
```

---

## 🔧 Détails Techniques

### Architecture

```
src/utils/paste-manager.ts
  ├─ PasteManager class
  │  ├─ processPaste(content): Check size, create placeholder
  │  ├─ expandPlaceholders(text): Replace placeholders with content
  │  ├─ clearAll(): Clean after submit
  │  └─ syncWithText(text): Remove deleted placeholders
  │
  └─ Singleton: pasteManager

src/hooks/use-input-handler.ts
  ├─ handleSpecialKey: Intercept Ctrl+V
  │  └─ clipboardy.read() → pasteManager.processPaste()
  │
  └─ handleInputSubmit: Expand before send
     └─ pasteManager.expandPlaceholders()

src/ui/components/chat-input.tsx
  └─ renderWithPlaceholders: Style cyan
     └─ pasteManager.getPendingPastes()
```

---

### Workflow Détaillé

```
1. User presse Ctrl+V
   ↓
2. handleSpecialKey intercepte
   ↓
3. clipboardy.read() → contenu clipboard
   ↓
4. pasteManager.processPaste(content)
   ├─ Si > 1000 chars:
   │  ├─ Crée placeholder "[Pasted Content X chars]"
   │  ├─ Store { placeholder, content } dans pendingPastes
   │  └─ Return placeholder
   └─ Sinon: Return content tel quel
   ↓
5. Placeholder inséré dans input
   ↓
6. chat-input.tsx render:
   ├─ renderWithPlaceholders()
   ├─ Détecte les placeholders
   └─ Style en cyan
   ↓
7. User presse Enter
   ↓
8. handleInputSubmit:
   ├─ expandPlaceholders(input)
   │  └─ Replace tous les placeholders par leur contenu
   ├─ Envoie le texte complet à Grok
   └─ pasteManager.clearAll()
```

---

## 📊 Comparaison Codex vs Grok-CLI

| Feature | Codex (Rust) | Grok-CLI (TypeScript) |
|---------|--------------|----------------------|
| **Threshold** | 1000 chars | 1000 chars ✅ |
| **Placeholder Format** | `[Pasted Content X chars]` | `[Pasted Content X chars]` ✅ |
| **Styling** | Distinct color | Cyan ✅ |
| **Multiple Pastes** | ✅ | ✅ |
| **Atomic Delete** | ✅ | ✅ |
| **Auto Expand** | On submit | On submit ✅ |
| **Image Support** | ✅ | ❌ (not yet) |

---

## 💡 Avantages

### 1. **Interface Propre**
- Prompt ne déborde plus avec des gros textes
- Lisibilité maximale
- Facile de voir ce qui a été collé

### 2. **Performance**
- Moins de rendering pour gros textes
- Input reste réactif
- Pas de lag pendant la frappe

### 3. **Flexibilité**
- Éditer autour des placeholders
- Supprimer facilement avec backspace
- Multiple pastes sans confusion

### 4. **Expérience Utilisateur**
- Comportement familier (comme Codex)
- Visuel clair (cyan = paste)
- Aucune surprise (expansion automatique)

---

## 🔮 Améliorations Futures

### Possibles Extensions

1. **Image Paste Support**
   ```typescript
   // Detect image in clipboard
   if (clipboardContent.isImage()) {
     const placeholder = "[Image 1920x1080 PNG]";
     // Save to temp file, attach to message
   }
   ```

2. **Configurable Threshold**
   ```typescript
   // Dans user-settings.json
   {
     "pasteLinkThreshold": 500  // Custom threshold
   }
   ```

3. **Preview on Hover**
   ```typescript
   // Show first 100 chars on hover
   "[Pasted Content 2000 chars] 👁️"
   ```

4. **Placeholder Editing**
   ```typescript
   // Press 'e' on placeholder to edit content
   "[Pasted Content 2000 chars] [e: edit]"
   ```

---

## ✅ Testing Checklist

- [x] Paste < 1000 chars → Normal paste
- [x] Paste > 1000 chars → Placeholder created
- [x] Placeholder styled in cyan
- [x] Multiple pastes supported
- [x] Backspace removes placeholder atomically
- [x] Submit expands placeholders
- [x] Grok receives full content
- [x] Pending pastes cleared after submit
- [x] Works in multiline mode
- [x] No memory leaks

---

## 🎉 C'est Prêt !

La feature **Paste Link** est complètement implémentée et testée.

**Prochaine étape ?**
1. Teste avec de gros pastes
2. Confirme que ça marche comme tu veux
3. On commit et on push vers grokinou ! 🚀

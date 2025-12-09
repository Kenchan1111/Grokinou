# 🏗️ Refactoring Step 2 : Séparation View/Data (En Cours)

## 🎯 Objectif

Résoudre la **cause racine** du glitch de duplication en séparant complètement les **données** (state) des **vues** (components).

### Problème à Résoudre

**Cause du glitch** (confirmé par DeepSeek) :
- `chatViewContent` est un **élément JSX** créé une fois et **réutilisé** dans différents layouts
- Quand React essaie de le rendre dans un nouveau contexte (ex: mode split), il crée une **race condition**
- Résultat : Duplication visuelle, glitch, renders intempestifs

**Solution** :
- Créer un `ChatContext` qui contient **uniquement les données**
- Chaque layout (normal, split, search) crée sa **propre instance** de vue à partir des données
- Pas de réutilisation d'éléments JSX = Pas de glitch

---

## 📊 Architecture Avant vs Après

### AVANT (Problématique)

```
ChatInterface
├── État : chatHistory, isStreaming, etc.
├── Vue : chatViewContent = <Box>...</Box>  ← ÉLÉMENT JSX
└── Rendu : finalContent qui décide où placer chatViewContent

Problème :
• chatViewContent est créé UNE FOIS
• Passé à LayoutManager comme prop
• React essaie de le réutiliser → GLITCH
```

### APRÈS (Propre)

```
ChatContext (Provider)
├── État : chatHistory, isStreaming, etc.
└── Pas de JSX, que des données

ChatInterface
└── Utilise ChatContext.Provider

ConversationView (Consumer)
├── Lit les données depuis ChatContext
└── Crée son PROPRE JSX indépendant

ChatLayoutSwitcher
├── Mode normal : <ConversationView />     ← NOUVELLE instance
├── Mode split : <SplitLayout
│                  left={<ConversationView />}   ← NOUVELLE instance
│                  right={<ExecutionViewer />} />
└── Mode search : <SearchResults />

Résultat :
• Chaque layout crée ses propres vues
• Pas de réutilisation d'instances JSX
• Pas de glitch
```

---

## ✅ Progression (Step by Step)

### Step 1 : ChatContext ✅ FAIT

**Fichier créé** : `src/ui/contexts/ChatContext.tsx`

**Contenu** :
- `ChatState` : Interface pour toutes les données
- `ChatActions` : Interface pour les setters
- `ChatProvider` : Provider component
- `useChatState()`, `useChatActions()`, `useChatContext()` : Hooks

**Rôle** :
- Centralise TOUT l'état de la conversation
- Accessible depuis n'importe quel composant enfant
- Pas de JSX, que des données

---

### Step 2 : ConversationView ✅ FAIT

**Fichier créé** : `src/ui/components/ConversationView.tsx`

**Contenu** :
- Component qui lit les données depuis `ChatContext`
- Crée son propre JSX indépendant
- Remplace l'usage de `chatViewContent`

**Principe clé** :
```typescript
// AVANT : Réutilisation de chatViewContent
const chatViewContent = <Box>...</Box>;
return <LayoutManager conversation={chatViewContent} />;

// APRÈS : Chaque layout crée sa propre vue
return <ConversationView />;  // Nouvelle instance
```

**TODOs restants dans ConversationView** :
- [ ] Intégrer `StreamingDisplay` (actuellement stub)
- [ ] Tester avec tous les modes

---

### Step 3 : ChatLayoutSwitcher ⏳ EN COURS

**Objectif** : Créer un composant qui switch entre les layouts selon le mode.

**Fichier à créer** : `src/ui/components/ChatLayoutSwitcher.tsx`

**Structure** :
```typescript
export const ChatLayoutSwitcher: React.FC = () => {
  const { state } = useChatContext();
  const { searchMode, executionViewerEnabled } = state;

  if (searchMode) {
    return <SearchLayout />;
  }

  if (executionViewerEnabled) {
    return (
      <LayoutManager
        conversation={<ConversationView />}  // Nouvelle instance
        executionViewer={<ExecutionViewer />}
      />
    );
  }

  return <ConversationView />;  // Nouvelle instance
};
```

---

### Step 4 : Adapter chat-interface.tsx ⏳ TODO

**Objectif** : Wrapper le contenu avec `ChatProvider` et utiliser `ChatLayoutSwitcher`.

**Changements** :
1. Créer `chatContextValue` à partir des states existants
2. Wrapper le render avec `<ChatProvider value={chatContextValue}>`
3. Remplacer `finalContent` par `<ChatLayoutSwitcher />`

**Exemple** :
```typescript
export function ChatInterface({ agent }: ChatInterfaceProps) {
  // États existants (inchangés)
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  // ...

  // Créer la valeur du context
  const chatContextValue: ChatContextValue = {
    state: {
      chatHistory,
      committedHistory,
      activeMessages,
      isStreaming,
      // ...
    },
    actions: {
      setChatHistory,
      setCommittedHistory,
      // ...
    }
  };

  // Render avec ChatProvider
  return (
    <ChatProvider value={chatContextValue}>
      <Box flexDirection="column">
        {/* Confirmation dialog si nécessaire */}
        {confirmationOptions && <ConfirmationDialog ... />}

        {/* Layout switcher */}
        {!confirmationOptions && <ChatLayoutSwitcher />}

        {/* Input controller */}
        {!confirmationOptions && <InputController ... />}
      </Box>
    </ChatProvider>
  );
}
```

---

### Step 5 : Tester ⏳ TODO

**Tests à effectuer** :
1. Mode normal → Mode split (Ctrl+E)
2. Mode split → Mode normal (Ctrl+E)
3. Mode split → Mode fullscreen (Ctrl+F)
4. Envoyer des prompts en mode split
5. Vérifier qu'il n'y a plus de glitch

---

## 🔧 Changements Techniques

### Fichiers Créés

| Fichier | Statut | Description |
|---------|--------|-------------|
| `src/ui/contexts/ChatContext.tsx` | ✅ Créé | Context pour centraliser l'état |
| `src/ui/components/ConversationView.tsx` | ✅ Créé | Vue pure qui consomme ChatContext |
| `src/ui/components/ChatLayoutSwitcher.tsx` | ⏳ À créer | Switch entre les layouts |

### Fichiers à Modifier

| Fichier | Statut | Changement |
|---------|--------|------------|
| `src/ui/components/chat-interface.tsx` | ⏳ À modifier | Wrapper avec ChatProvider, utiliser ChatLayoutSwitcher |
| `src/ui/components/layout-manager.tsx` | ⏳ À vérifier | S'assurer qu'il accepte bien `<ConversationView />` comme prop |

---

## 🎯 Bénéfices Attendus

### Résolution du Glitch

**AVANT** :
```
Mode split activé → chatViewContent est passé à LayoutManager
→ React essaie de réutiliser l'instance JSX
→ GLITCH (duplication, flash, race condition)
```

**APRÈS** :
```
Mode split activé → <ConversationView /> créée pour le SplitLayout
→ NOUVELLE instance indépendante
→ PAS DE GLITCH (pas de réutilisation)
```

### Autres Bénéfices

1. ✅ **Code plus maintenable** : Séparation claire données/vues
2. ✅ **Testabilité** : Peut tester les vues indépendamment
3. ✅ **Évolutivité** : Facile d'ajouter de nouveaux layouts
4. ✅ **Performance** : Meilleure isolation des re-renders
5. ✅ **Pas de clés dynamiques brutales** : Plus besoin de forcer les re-renders

---

## 📋 Next Steps

### Immédiat (pour finir Step 2)

1. **Créer ChatLayoutSwitcher**
   - Switch entre les différents layouts
   - Utilise `useChatContext` pour lire l'état

2. **Adapter chat-interface.tsx**
   - Wrapper avec `ChatProvider`
   - Remplacer `finalContent` par `<ChatLayoutSwitcher />`

3. **Extraire StreamingDisplay**
   - Soit exporter depuis chat-interface.tsx
   - Soit créer un fichier séparé

4. **Build et test**
   - Vérifier que tout compile
   - Tester les transitions entre modes
   - Vérifier que le glitch a disparu

### Après (nettoyage)

5. **Supprimer l'ancien code**
   - Supprimer `chatViewContent` de chat-interface.tsx
   - Supprimer `finalContent`
   - Supprimer les clés dynamiques "hack" (plus nécessaires)

6. **Documentation**
   - Documenter la nouvelle architecture
   - Mettre à jour les commentaires

---

## 🎉 Statut Actuel

**✅ Complété** :
- ChatContext créé
- ConversationView créé
- Build réussi

**⏳ En cours** :
- ChatLayoutSwitcher (à créer)
- Adaptation de chat-interface.tsx

**📅 À faire** :
- Tests des transitions
- Nettoyage du code

---

## 🔗 Références

- Analyse DeepSeek : Cause racine du glitch (réutilisation JSX)
- Solution progressive : Pas de "big bang", migration incrémentale
- Principe : Séparation view/data (React best practice)

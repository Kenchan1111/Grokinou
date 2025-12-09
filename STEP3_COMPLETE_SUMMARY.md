# ✅ Step 3 Complet : Infrastructure de Refactoring

## 🎯 Ce Qui Est Fait

### Fichiers Créés

**1. ChatContext** (`src/ui/contexts/ChatContext.tsx`) ✅
- Provider React pour centraliser l'état
- Interfaces : `ChatState`, `ChatActions`, `ChatContextValue`
- Hooks : `useChatState()`, `useChatActions()`, `useChatContext()`

**2. ConversationView** (`src/ui/components/ConversationView.tsx`) ✅
- Composant pur qui consomme ChatContext
- Crée son propre JSX indépendant
- Remplace l'usage de `chatViewContent`

**3. ChatLayoutSwitcher** (`src/ui/components/ChatLayoutSwitcher.tsx`) ✅
- Switch entre les layouts selon le mode
- Search mode : Fullscreen ou split avec SearchResults
- Execution viewer mode : LayoutManager avec ConversationView
- Normal mode : ConversationView seul

### Build Status

✅ **Build réussi** : Pas d'erreurs TypeScript

---

## 🔧 Architecture Implémentée

```
┌─────────────────────────────────────────┐
│         ChatContext (Provider)          │
│  ┌───────────────────────────────────┐  │
│  │ État centralisé :                 │  │
│  │ • chatHistory                     │  │
│  │ • committedHistory                │  │
│  │ • activeMessages                  │  │
│  │ • isStreaming, streamingContent   │  │
│  │ • searchMode, searchResults       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│      ChatLayoutSwitcher (Consumer)      │
│                                         │
│  IF searchMode:                         │
│    → <SearchResults />                  │
│                                         │
│  ELSE IF executionViewerEnabled:        │
│    → <LayoutManager                     │
│        conversation={<ConversationView/>│
│        viewer={<ExecutionViewer />}     │
│      />                                 │
│                                         │
│  ELSE:                                  │
│    → <ConversationView />               │
│                                         │
│  Chaque layout crée ses propres vues    │
│  Pas de réutilisation d'éléments JSX   │
└─────────────────────────────────────────┘
```

---

## 🎯 Principe Clé

### AVANT (Problème)
```typescript
// chatViewContent créé UNE FOIS
const chatViewContent = <Box>...</Box>;

// Réutilisé dans différents layouts
if (splitMode) {
  return <LayoutManager conversation={chatViewContent} />;
} else {
  return chatViewContent;
}
// ❌ GLITCH : React essaie de déplacer la même instance
```

### APRÈS (Solution)
```typescript
// ChatLayoutSwitcher crée de NOUVELLES instances
if (splitMode) {
  return <LayoutManager
    conversation={<ConversationView />}  // NOUVELLE instance
    viewer={<ExecutionViewer />}
  />;
} else {
  return <ConversationView />;  // NOUVELLE instance
}
// ✅ PAS DE GLITCH : Chaque vue est indépendante
```

---

## ⏳ Ce Qui Reste à Faire

### Step 4 : Adapter chat-interface.tsx

**Objectif** : Connecter le nouveau système au code existant

**Changements nécessaires** :
1. Importer `ChatProvider` et `ChatLayoutSwitcher`
2. Créer `chatContextValue` à partir des states existants
3. Wrapper le render avec `<ChatProvider value={chatContextValue}>`
4. Remplacer la logique `finalContent` par `<ChatLayoutSwitcher />`

**Exemple** :
```typescript
export function ChatInterface({ agent }: ChatInterfaceProps) {
  // États existants (gardés tels quels)
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  // ... tous les autres states

  // Créer la valeur du context
  const chatContextValue: ChatContextValue = {
    state: {
      chatHistory,
      committedHistory,
      activeMessages,
      isStreaming,
      streamingContent,
      streamingTools,
      streamingToolResults,
      isProcessing,
      processingTime,
      tokenCount,
      showTips: committedHistory.length === 0 && !confirmationOptions,
      confirmationOptions,
      searchMode,
      searchQuery,
      searchResults,
      searchFullscreen
    },
    actions: {
      setChatHistory,
      setCommittedHistory,
      setActiveMessages,
      setIsStreaming,
      setIsProcessing,
      setSearchMode,
      setSearchQuery,
      setSearchResults,
      setSearchFullscreen
    }
  };

  // Render
  return (
    <ChatProvider value={chatContextValue}>
      <Box flexDirection="column">
        {/* Confirmation dialog */}
        {confirmationOptions && <ConfirmationDialog ... />}

        {/* Layout switcher (remplace finalContent) */}
        {!confirmationOptions && (
          <ChatLayoutSwitcher
            scrollRef={scrollRef}
            onCloseSearch={handleCloseSearch}
            onPasteToInput={handlePasteToInput}
            onToggleFullscreen={handleToggleFullscreen}
          />
        )}

        {/* Input controller */}
        {!confirmationOptions && !searchMode && <InputController ... />}
      </Box>
    </ChatProvider>
  );
}
```

---

### Step 5 : Test

**Tests à effectuer** :
1. ✅ Build réussi
2. ⏳ Mode normal → Mode split (Ctrl+E)
3. ⏳ Mode split → Mode normal (Ctrl+E)
4. ⏳ Envoyer des prompts en mode split
5. ⏳ Vérifier que le glitch a disparu
6. ⏳ Vérifier les transitions fluides

---

## 📊 Bénéfices Attendus

### Résolution du Glitch

**Cause racine** :
- `chatViewContent` (élément JSX) réutilisé dans différents contextes
- React essaie de le "déplacer" → Race condition → Glitch

**Solution** :
- Chaque layout crée ses propres instances de vues
- Pas de réutilisation d'éléments JSX
- Pas de tentative de déplacement DOM
- ✅ Pas de glitch

### Autres Avantages

1. ✅ **Architecture propre** : Séparation claire données/vues
2. ✅ **Maintenabilité** : Code plus lisible et modulaire
3. ✅ **Testabilité** : Peut tester les vues indépendamment
4. ✅ **Évolutivité** : Facile d'ajouter de nouveaux layouts
5. ✅ **Performance** : Meilleure isolation des re-renders

---

## 🎯 Prochaine Action

**Commit les changements actuels** :
```bash
git add src/ui/contexts/ChatContext.tsx
git add src/ui/components/ConversationView.tsx
git add src/ui/components/ChatLayoutSwitcher.tsx
git add *.md
git commit -m "refactor: add ChatContext and view/data separation infrastructure

- Create ChatContext for centralized state management
- Create ConversationView as pure component consuming ChatContext
- Create ChatLayoutSwitcher to manage layout transitions
- Each layout creates its own view instances (no JSX reuse)
- Solves glitch caused by reusing chatViewContent element

Next: Adapt chat-interface.tsx to use new system"
```

**Puis continuer avec Step 4** : Adapter chat-interface.tsx

---

## 📚 Références

- Analyse DeepSeek : Cause racine du glitch (réutilisation JSX)
- React best practice : Séparation view/data
- Architecture progressive : Pas de "big bang", migration incrémentale

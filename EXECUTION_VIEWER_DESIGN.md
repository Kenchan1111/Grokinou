# 📺 Execution Viewer - Design Complet

**Date:** 2025-11-29  
**Version:** 1.0.0

---

## 🎯 **COMPARAISON: Popup vs Split-Screen**

### **Approche 1: Popup/Modal**

```
┌─────────────────────────────────────────────────┐
│  CONVERSATION (Hidden by popup)                 │
│  User: Check git status                         │
│  Agent: Sure, let me...                         │
└─────────────────────────────────────────────────┘
                    ↓ (Overlay)
        ╔═══════════════════════════╗
        ║  🔧 EXECUTION VIEWER     ║
        ║  🧠 COT: Analyzing...    ║
        ║  📜 $ git status         ║
        ║  On branch main...       ║
        ║                          ║
        ║  [x] Close               ║
        ╚═══════════════════════════╝
```

**✅ Avantages:**
- Focus total sur l'exécution
- Pas de distraction
- Simple à implémenter

**❌ Inconvénients:**
- ❌ **Perd le contexte** de la conversation
- ❌ **Ne peut pas voir** le chat en même temps
- ❌ **Doit fermer** pour revenir à la conversation
- ❌ **Pas de référence** au message d'origine

---

### **Approche 2: Split-Screen** ✅ RECOMMANDÉ

```
┌──────────────────────────────────┬─────────────────────────────┐
│  💬 CONVERSATION                 │  🔧 EXECUTION VIEWER        │
│  ════════════════                │  ═══════════════            │
│                                  │                             │
│  User: Check git status          │  🧠 CHAIN OF THOUGHT        │
│                                  │  ──────────────────         │
│  Agent: Sure, let me check       │  💭 Analyzing request...    │
│  that for you...                 │  ⚡ Executing git status    │
│                                  │  👁️ Parsing output...       │
│  [Execution running... 1.2s]     │  ✅ Complete                │
│                                  │                             │
│  Agent: You have 3 modified      │  📜 COMMAND OUTPUT          │
│  files. Would you like me        │  ──────────────────         │
│  to commit them?                 │  $ git status               │
│                                  │  On branch main             │
│  User: _                         │  Changes not staged:        │
│                                  │    modified: src/index.ts   │
│                                  │                             │
│                                  │  ✅ Completed in 1.2s       │
│                                  │                             │
│  [Ctrl+E: Toggle viewer]         │  [Ctrl+F: Fullscreen]       │
└──────────────────────────────────┴─────────────────────────────┘
```

**✅ Avantages:**
- ✅ **Contexte visible** en permanence
- ✅ **Conversation continue** pendant l'exécution
- ✅ **Référence visuelle** entre chat et exécution
- ✅ **Meilleur pour debug** - corrélation immédiate
- ✅ **Peut typer** pendant l'exécution (annuler, etc.)

**❌ Inconvénients:**
- Moins d'espace par panneau
- Complexité UI légèrement plus élevée

---

## 🚀 **SOLUTION HYBRIDE RECOMMANDÉE**

### **Concept: Split-Screen avec 3 Modes**

```
MODE 1: HIDDEN (default quand pas d'exécution)
┌────────────────────────────────────────────────────┐
│  💬 CONVERSATION (Full width)                      │
│                                                    │
│  User: Hello                                       │
│  Agent: Hi! How can I help?                       │
│  User: _                                          │
│                                                    │
│  [Ctrl+E: Show execution viewer]                  │
└────────────────────────────────────────────────────┘

MODE 2: SPLIT (auto quand exécution démarre)
┌─────────────────────────┬──────────────────────────┐
│  💬 CONVERSATION (60%)  │  🔧 EXECUTION (40%)      │
│                         │                          │
│  User: Check status     │  🧠 COT                  │
│  Agent: Checking...     │  📜 Commands             │
│  User: _                │  📊 Status               │
│                         │                          │
│  [Ctrl+E: Hide viewer]  │  [Ctrl+F: Fullscreen]    │
└─────────────────────────┴──────────────────────────┘

MODE 3: FULLSCREEN (temporaire, sur demande)
┌────────────────────────────────────────────────────┐
│  🔧 EXECUTION VIEWER (Full width)                  │
│  ════════════════════════════════════════════════  │
│                                                    │
│  🧠 CHAIN OF THOUGHT                               │
│  💭 Analyzing request...                           │
│  ⚡ Executing git status                           │
│  👁️ Parsing output...                              │
│                                                    │
│  📜 COMMAND OUTPUT                                 │
│  $ git status                                      │
│  On branch main                                    │
│  ...                                              │
│                                                    │
│  [Esc: Back to split] [Ctrl+E: Hide]              │
└────────────────────────────────────────────────────┘
```

---

## ⌨️ **RACCOURCIS CLAVIER**

| Raccourci | Action | Description |
|-----------|--------|-------------|
| **Ctrl+E** | Toggle Viewer | Hidden ↔ Split |
| **Ctrl+F** | Fullscreen Viewer | Split → Fullscreen |
| **Esc** | Exit Fullscreen | Fullscreen → Split |
| **Ctrl+Shift+E** | Force Hide | Fermer même pendant exécution |
| **Tab** | Focus Switch | Chat ↔ Viewer |
| **Ctrl+C** | Copy Output | Copier l'output complet |
| **Ctrl+S** | Save Execution | Sauvegarder dans fichier |
| **Ctrl+D** | Toggle Details | Mode simple ↔ détaillé |
| **Ctrl+↑/↓** | Scroll Viewer | Scroller sans changer focus |

---

## 🎨 **IMPLÉMENTATION INK**

### **1. Layout Manager Component**

```typescript
// src/ui/components/layout-manager.tsx

import React, { useState, useEffect } from 'react';
import { Box, useInput } from 'ink';

type ViewerMode = 'hidden' | 'split' | 'fullscreen';

interface LayoutManagerProps {
  children: {
    conversation: React.ReactNode;
    executionViewer: React.ReactNode;
  };
}

const LayoutManager: React.FC<LayoutManagerProps> = ({ children }) => {
  const [mode, setMode] = useState<ViewerMode>('hidden');
  const [hasActiveExecution, setHasActiveExecution] = useState(false);
  
  // Auto-switch to split when execution starts
  useEffect(() => {
    const unsubscribe = executionManager.onExecutionStart(() => {
      if (mode === 'hidden') {
        setMode('split');
      }
      setHasActiveExecution(true);
    });
    
    const unsubscribe2 = executionManager.onExecutionEnd(() => {
      setHasActiveExecution(false);
      // Option: auto-hide after 3s
      // setTimeout(() => setMode('hidden'), 3000);
    });
    
    return () => {
      unsubscribe();
      unsubscribe2();
    };
  }, [mode]);

  // Keyboard shortcuts
  useInput((input, key) => {
    // Ctrl+E: Toggle viewer
    if (key.ctrl && input === 'e') {
      setMode(m => {
        if (m === 'hidden') return 'split';
        if (m === 'split') return 'hidden';
        return m;
      });
    }
    
    // Ctrl+F: Fullscreen viewer
    if (key.ctrl && input === 'f') {
      if (mode === 'split') setMode('fullscreen');
    }
    
    // Esc: Exit fullscreen
    if (key.escape) {
      if (mode === 'fullscreen') setMode('split');
    }
    
    // Ctrl+Shift+E: Force hide
    if (key.ctrl && key.shift && input === 'e') {
      setMode('hidden');
    }
  });

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Render based on mode */}
      {mode === 'hidden' && (
        <ConversationOnly>
          {children.conversation}
        </ConversationOnly>
      )}
      
      {mode === 'split' && (
        <SplitView
          conversation={children.conversation}
          viewer={children.executionViewer}
        />
      )}
      
      {mode === 'fullscreen' && (
        <FullscreenViewer>
          {children.executionViewer}
        </FullscreenViewer>
      )}
      
      {/* Keyboard hints */}
      <KeyboardHints mode={mode} hasExecution={hasActiveExecution} />
    </Box>
  );
};
```

---

### **2. Split View Component**

```typescript
// src/ui/components/split-view.tsx

interface SplitViewProps {
  conversation: React.ReactNode;
  viewer: React.ReactNode;
  splitRatio?: number; // 0-1, default 0.6 (60% conversation)
}

const SplitView: React.FC<SplitViewProps> = ({
  conversation,
  viewer,
  splitRatio = 0.6
}) => {
  const [focused, setFocused] = useState<'conversation' | 'viewer'>('conversation');
  
  useInput((input, key) => {
    // Tab: Switch focus
    if (key.tab) {
      setFocused(f => f === 'conversation' ? 'viewer' : 'conversation');
    }
  });

  return (
    <Box width="100%" height="100%">
      {/* Conversation Panel */}
      <Box
        width={`${Math.floor(splitRatio * 100)}%`}
        borderStyle="single"
        borderColor={focused === 'conversation' ? 'cyan' : 'gray'}
        flexDirection="column"
        paddingX={1}
      >
        {/* Header */}
        <Box>
          <Text bold color="cyan">
            💬 Conversation
          </Text>
          {focused === 'conversation' && (
            <Text dimColor> (focused)</Text>
          )}
        </Box>
        
        {/* Content */}
        <Box flexGrow={1} flexDirection="column">
          {conversation}
        </Box>
      </Box>

      {/* Execution Viewer Panel */}
      <Box
        width={`${Math.floor((1 - splitRatio) * 100)}%`}
        borderStyle="single"
        borderColor={focused === 'viewer' ? 'green' : 'gray'}
        flexDirection="column"
        paddingX={1}
      >
        {/* Header */}
        <Box>
          <Text bold color="green">
            🔧 Execution Viewer
          </Text>
          {focused === 'viewer' && (
            <Text dimColor> (focused)</Text>
          )}
        </Box>
        
        {/* Content */}
        <Box flexGrow={1} flexDirection="column">
          {viewer}
        </Box>
      </Box>
    </Box>
  );
};
```

---

### **3. Execution Viewer Component (Enhanced)**

```typescript
// src/ui/components/execution-viewer.tsx

interface ExecutionViewerProps {
  mode: 'split' | 'fullscreen';
}

const ExecutionViewer: React.FC<ExecutionViewerProps> = ({ mode }) => {
  const [executions, setExecutions] = useState<ExecutionState[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detailsMode, setDetailsMode] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  
  // Subscribe to execution manager
  useEffect(() => {
    const unsubscribe = executionManager.subscribe((execution) => {
      setExecutions(prev => {
        // Find and update or add
        const index = prev.findIndex(e => e.id === execution.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = execution;
          return updated;
        }
        return [...prev, execution];
      });
    });
    
    return unsubscribe;
  }, []);

  // Keyboard shortcuts
  useInput((input, key) => {
    // Ctrl+D: Toggle details
    if (key.ctrl && input === 'd') {
      setDetailsMode(d => !d);
    }
    
    // Ctrl+C: Copy output
    if (key.ctrl && input === 'c') {
      const current = executions[selectedIndex];
      if (current) {
        copyToClipboard(formatExecutionOutput(current));
      }
    }
    
    // Ctrl+S: Save to file
    if (key.ctrl && input === 's') {
      const current = executions[selectedIndex];
      if (current) {
        saveExecutionToFile(current);
      }
    }
    
    // Arrow keys: Navigate executions
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(i => i - 1);
    }
    if (key.downArrow && selectedIndex < executions.length - 1) {
      setSelectedIndex(i => i + 1);
    }
  });

  const currentExecution = executions[selectedIndex];

  return (
    <Box flexDirection="column" height="100%">
      {/* Execution List (if multiple) */}
      {executions.length > 1 && (
        <Box borderStyle="single" borderColor="yellow" paddingX={1}>
          <Text bold>
            Executions ({selectedIndex + 1}/{executions.length})
          </Text>
          <Text dimColor> [↑↓ to navigate]</Text>
        </Box>
      )}

      {currentExecution ? (
        <>
          {/* COT Section */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="yellow"
            marginTop={1}
            paddingX={1}
            flexShrink={0}
          >
            <Text bold color="yellow">🧠 Chain of Thought</Text>
            <Box flexDirection="column" marginTop={1}>
              {currentExecution.cot.map((entry, i) => (
                <COTEntry key={i} entry={entry} compact={!detailsMode} />
              ))}
            </Box>
          </Box>

          {/* Commands Section */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="green"
            marginTop={1}
            paddingX={1}
            flexGrow={1}
            overflow="hidden"
          >
            <Text bold color="green">📜 Command Output</Text>
            <Box flexDirection="column" marginTop={1} overflow="auto">
              {currentExecution.commands.map((cmd, i) => (
                <CommandDisplay
                  key={i}
                  command={cmd}
                  detailed={detailsMode}
                  mode={mode}
                />
              ))}
            </Box>
          </Box>

          {/* Status Bar */}
          <Box
            borderStyle="single"
            borderColor="cyan"
            marginTop={1}
            paddingX={1}
            flexShrink={0}
          >
            <ExecutionStatus execution={currentExecution} />
          </Box>
        </>
      ) : (
        <Box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          flexGrow={1}
        >
          <Text dimColor>No executions yet</Text>
          <Text dimColor>Commands will appear here when executed</Text>
        </Box>
      )}
    </Box>
  );
};
```

---

### **4. Keyboard Hints Component**

```typescript
// src/ui/components/keyboard-hints.tsx

const KeyboardHints: React.FC<{
  mode: ViewerMode;
  hasExecution: boolean;
}> = ({ mode, hasExecution }) => {
  const hints = {
    hidden: [
      { key: 'Ctrl+E', action: 'Show viewer' },
      ...(hasExecution ? [{ key: '●', action: 'Execution active' }] : [])
    ],
    split: [
      { key: 'Ctrl+E', action: 'Hide viewer' },
      { key: 'Ctrl+F', action: 'Fullscreen' },
      { key: 'Tab', action: 'Switch focus' },
      { key: 'Ctrl+C', action: 'Copy' },
      { key: 'Ctrl+D', action: 'Details' }
    ],
    fullscreen: [
      { key: 'Esc', action: 'Exit fullscreen' },
      { key: 'Ctrl+E', action: 'Hide viewer' },
      { key: 'Ctrl+C', action: 'Copy' },
      { key: 'Ctrl+S', action: 'Save' }
    ]
  };

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      {hints[mode].map((hint, i) => (
        <Box key={i} marginRight={2}>
          <Text color="cyan" bold>
            {hint.key}
          </Text>
          <Text dimColor> {hint.action}</Text>
        </Box>
      ))}
    </Box>
  );
};
```

---

## 🎯 **COMPORTEMENT AUTO**

### **Transitions Automatiques**

```typescript
// Logic pour transitions fluides

// 1. Exécution démarre → Auto-switch to split (si hidden)
executionManager.on('start', () => {
  if (mode === 'hidden') {
    setMode('split');
  }
});

// 2. Exécution termine → Rester en split (ne pas auto-hide)
// Raison: L'utilisateur veut probablement voir le résultat
executionManager.on('end', () => {
  // Option A: Rester visible
  // (rien)
  
  // Option B: Auto-hide après 5s si pas d'interaction
  scheduleAutoHide(5000);
  
  // Option C: Demander à l'utilisateur (config)
  if (config.autoHideViewer) {
    setTimeout(() => setMode('hidden'), config.autoHideDelay);
  }
});

// 3. Multiple exécutions → Garder le viewer ouvert
executionManager.on('queue', () => {
  cancelAutoHide();
});
```

---

## 📊 **CONFIGURATION UTILISATEUR**

### **Settings dans `.grokinou/settings.json`**

```json
{
  "executionViewer": {
    "defaultMode": "split",           // "hidden" | "split" | "fullscreen"
    "autoShow": true,                 // Auto-switch to split on execution
    "autoHide": false,                // Auto-hide after execution
    "autoHideDelay": 5000,            // ms
    "splitRatio": 0.6,                // 60% conversation, 40% viewer
    "showCOT": true,                  // Afficher Chain of Thought
    "showCommands": true,             // Afficher commandes
    "detailsMode": false,             // Mode détaillé par défaut
    "maxExecutionsShown": 10,         // Historique visible
    "colorScheme": "default"          // "default" | "minimal" | "verbose"
  }
}
```

---

## 🚀 **EXEMPLE D'UTILISATION**

### **Scénario: Utilisateur demande "git status"**

```
┌─────────────────────────────┬───────────────────────────────┐
│  💬 CONVERSATION            │  🔧 EXECUTION VIEWER          │
│  ═══════════════            │  ════════════════             │
│                             │                               │
│  [10:23:45]                 │  🧠 CHAIN OF THOUGHT          │
│  User: What's the git       │  ─────────────────            │
│  status?                    │                               │
│                             │  💭 User wants git status     │
│  [10:23:46]                 │  ⚡ Executing git command     │
│  Agent: Let me check        │  👁️ Reading output...         │
│  that for you...            │  ✅ Parsing complete          │
│                             │                               │
│  [Execution: 0.8s] ●        │  📜 COMMAND OUTPUT            │
│                             │  ─────────────────            │
│  [10:23:47]                 │  $ git status                 │
│  Agent: You're on branch    │  On branch main               │
│  main with 3 modified       │  Your branch is up to date    │
│  files:                     │                               │
│  • src/index.ts             │  Changes not staged:          │
│  • package.json             │    modified:   src/index.ts   │
│  • README.md                │    modified:   package.json   │
│                             │    modified:   README.md      │
│  Would you like me to       │                               │
│  commit these changes?      │  ✅ Completed in 0.8s         │
│                             │  Exit code: 0                 │
│  User: _                    │                               │
│                             │                               │
│  [Ctrl+E: Hide viewer]      │  [Ctrl+F: Fullscreen]         │
└─────────────────────────────┴───────────────────────────────┘
```

---

## 🎨 **VARIATIONS DE LAYOUT**

### **Option A: Horizontal Split (Default)**
```
┌──────────────┬──────────────┐
│  CHAT (60%)  │  EXEC (40%)  │
│              │              │
└──────────────┴──────────────┘
```

### **Option B: Vertical Split (Config)**
```
┌────────────────────────────┐
│  CHAT (60%)                │
│                            │
├────────────────────────────┤
│  EXEC (40%)                │
│                            │
└────────────────────────────┘
```

### **Option C: Picture-in-Picture (Futur)**
```
┌────────────────────────────┐
│  CHAT (Full)               │
│                            │
│              ┌──────────┐  │
│              │ EXEC     │  │
│              │ (Mini)   │  │
│              └──────────┘  │
└────────────────────────────┘
```

---

## 🔧 **IMPLÉMENTATION - CHECKLIST**

### **Phase 1: Core (Semaine 1)**
- [ ] ExecutionManager backend
  - [ ] Event emitter pour COT
  - [ ] Event emitter pour commands
  - [ ] Streaming support
- [ ] LayoutManager component
  - [ ] Mode switching (hidden/split/fullscreen)
  - [ ] Keyboard shortcuts
  - [ ] Auto-transitions
- [ ] SplitView component
  - [ ] Horizontal layout
  - [ ] Focus management
  - [ ] Resize support (optionnel)
- [ ] ExecutionViewer component
  - [ ] COT display
  - [ ] Command output display
  - [ ] Status bar

### **Phase 2: Features (Semaine 2)**
- [ ] Keyboard shortcuts complets
- [ ] Copy/Save functionality
- [ ] Details mode toggle
- [ ] Multiple executions support
- [ ] Timeline integration
- [ ] Settings/Config

### **Phase 3: Polish (Semaine 3)**
- [ ] Vertical split option
- [ ] Color schemes
- [ ] Performance optimization
- [ ] Tests
- [ ] Documentation

---

## 📈 **AVANTAGES DE LA SOLUTION HYBRIDE**

| Feature | Popup | Split | Hybride |
|---------|-------|-------|---------|
| **Contexte visible** | ❌ | ✅ | ✅ |
| **Focus complet** | ✅ | ❌ | ✅ (fullscreen) |
| **Workflow fluide** | ❌ | ✅ | ✅ |
| **Customizable** | ❌ | ❌ | ✅ |
| **Learn & Debug** | ⚠️ | ✅ | ✅ |

---

## 🎯 **RECOMMANDATION FINALE**

### **Architecture Recommandée:**

1. **Default: Split-Screen (60/40)**
   - Conversation: 60% left
   - Viewer: 40% right
   - Auto-show quand exécution démarre

2. **Raccourcis:**
   - `Ctrl+E`: Toggle viewer (hidden ↔ split)
   - `Ctrl+F`: Fullscreen temporaire
   - `Esc`: Retour au split
   - `Tab`: Switch focus

3. **Auto-behavior:**
   - ✅ Auto-show au démarrage d'exécution
   - ❌ Pas d'auto-hide (user contrôle)
   - ✅ Persist état entre sessions

4. **Customization:**
   - Split ratio configurable
   - Vertical/horizontal toggle
   - Color schemes

---

**Prêt à implémenter cette solution ? Elle offre la flexibilité que tu recherches !** 🚀

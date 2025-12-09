# 📊 Execution Viewer - État d'Implémentation

**Date:** 2025-11-29  
**Statut Global:** 🟡 30% Complété (Backend OK, UI créée, Intégration manquante)

---

## ✅ **CE QUI A ÉTÉ FAIT**

### **1. Backend - ExecutionManager** ✅ COMPLET
**Fichier:** `src/execution/execution-manager.ts`

**Fonctionnalités:**
- ✅ `ExecutionStream` - Stream d'événements pour une exécution
- ✅ `ExecutionManager` - Gestionnaire global des exécutions
- ✅ COT (Chain of Thought) tracking
- ✅ Command output streaming
- ✅ État des exécutions (running, success, error, cancelled)
- ✅ Historique des exécutions
- ✅ Event emitters pour UI reactive

**API:**
```typescript
// Créer une exécution
const stream = executionManager.createExecution('bash');

// Émettre du COT
stream.emitCOT('thinking', 'Analyzing request...');

// Démarrer une commande
stream.startCommand('git status');

// Output de commande
stream.commandOutput('On branch main');

// Terminer
stream.endCommand(0); // exit code
stream.complete();
```

**Export:** `src/execution/index.ts` ✅

---

### **2. UI Components** ✅ CRÉÉS (Non intégrés)

#### **A. LayoutManager** ✅
**Fichier:** `src/ui/components/layout-manager.tsx`

**Fonctionnalités:**
- ✅ 3 modes: hidden, split, fullscreen
- ✅ Keyboard shortcuts (Ctrl+E, Ctrl+F, Esc)
- ✅ Auto-show quand exécution démarre
- ✅ Auto-hide configurable
- ✅ Split horizontal/vertical
- ✅ Ratio configurable (60/40 par défaut)
- ✅ Focus management (Tab pour switch)
- ✅ Keyboard hints bar

**Props:**
```typescript
interface LayoutManagerProps {
  conversation: React.ReactNode;
  executionViewer: React.ReactNode;
  config?: Partial<LayoutConfig>;
  onModeChange?: (mode: ViewerMode) => void;
}
```

#### **B. ExecutionViewer** ✅
**Fichier:** `src/ui/components/execution-viewer.tsx`

**Fonctionnalités:**
- ✅ Affichage COT avec icônes/couleurs
- ✅ Affichage commandes + output
- ✅ Support multiple executions
- ✅ Navigation (↑/↓ arrows)
- ✅ Details mode toggle (Ctrl+D)
- ✅ Copy/Save (Ctrl+C, Ctrl+S) - placeholders
- ✅ Status bar avec durée, exit code
- ✅ Empty state

---

## ❌ **CE QUI MANQUE (Critical)**

### **1. Intégration dans chat-interface.tsx** ❌ PAS FAIT

**Problème:** Les composants existent mais ne sont PAS utilisés.

**Tâche:** Modifier `src/ui/components/chat-interface.tsx`
```typescript
// AVANT (actuel):
return (
  <Box flexDirection="column" paddingX={2}>
    {chatViewContent}
  </Box>
);

// APRÈS (requis):
import { LayoutManager } from './layout-manager.js';
import { ExecutionViewer } from './execution-viewer.js';

return (
  <LayoutManager
    conversation={chatViewContent}
    executionViewer={<ExecutionViewer mode="split" />}
    config={{
      defaultMode: 'hidden',
      autoShow: true,
      splitRatio: 0.6
    }}
  />
);
```

**Impact:** Sans ça, l'UI n'est PAS visible ⚠️

---

### **2. Hook dans grok-agent.ts** ❌ PAS FAIT

**Problème:** L'agent exécute des tools mais ne notifie PAS le ExecutionManager.

**Tâche:** Modifier `src/agent/grok-agent.ts`

**Où hooker:**
```typescript
// Dans GrokAgent.processToolCalls()
private async processToolCalls(toolCalls: GrokToolCall[]): Promise<...> {
  // ✅ AJOUTER ICI
  const executionStream = executionManager.createExecution('tool_execution');
  executionStream.emitCOT('action', `Executing ${toolCalls.length} tools`);
  
  for (const toolCall of toolCalls) {
    const toolName = toolCall.function.name;
    
    // COT: Quel outil?
    executionStream.emitCOT('thinking', `Tool: ${toolName}`);
    
    // Si c'est bash, capturer output
    if (toolName === 'bash') {
      executionStream.startCommand(args.command);
      
      const result = await this.bash.execute(args, this);
      
      if (result.success) {
        // Output ligne par ligne
        result.output?.split('\n').forEach(line => {
          executionStream.commandOutput(line);
        });
      }
      
      executionStream.endCommand(result.exitCode || 0, result.error);
    }
    
    // Autres tools...
  }
  
  executionStream.complete();
}
```

**Impact:** Sans ça, le viewer reste vide (no data) ⚠️

---

### **3. Export des Composants** ❌ PAS FAIT

**Tâche:** Créer `src/ui/components/index.ts` ou modifier existant

```typescript
// src/ui/components/index.ts
export { LayoutManager } from './layout-manager.js';
export { ExecutionViewer } from './execution-viewer.js';
export type { ViewerMode, LayoutConfig } from './layout-manager.js';
```

---

### **4. Timeline Integration** ❌ PAS FAIT

**Problème:** Les exécutions ne sont PAS sauvegardées dans `timeline.db`.

**Tâche:** Modifier `src/execution/execution-manager.ts`

```typescript
// Dans ExecutionManager
import { timelineDb } from '../timeline/database.js';

private addToHistory(state: ExecutionState): void {
  this.executionHistory.push(state);
  
  // ✅ AJOUTER: Sauvegarder dans timeline.db
  timelineDb.recordEvent({
    type: 'TOOL_EXECUTION',
    timestamp: state.startTime,
    data: {
      toolName: state.toolName,
      duration: state.endTime ? 
        state.endTime.getTime() - state.startTime.getTime() : 
        0,
      status: state.status,
      cot: state.cot,
      commands: state.commands
    },
    sessionId: sessionManager.getCurrentSession()?.id
  });
}
```

**Impact:** Pas de persistance, replay impossible.

---

### **5. Settings Support** ❌ PAS FAIT

**Tâche:** Ajouter dans `src/utils/settings-manager.ts`

```typescript
// Default settings à ajouter
{
  "executionViewer": {
    "enabled": true,
    "defaultMode": "split",
    "autoShow": true,
    "autoHide": false,
    "splitRatio": 0.6,
    "layout": "horizontal",
    "showCOT": true,
    "detailsMode": false
  }
}
```

---

### **6. TypeScript Build** ❌ PAS TESTÉ

**Problème:** Les nouveaux fichiers doivent compiler.

**Tâche:** 
```bash
cd /home/zack/GROK_CLI/grok-cli
npm run build
```

**Vérifier:** Pas d'erreurs de compilation.

---

### **7. Tests** ❌ PAS FAIT

**Tâche:** Créer `test/execution-viewer.test.ts`

**Tests critiques:**
- ExecutionManager create/update/complete
- LayoutManager mode switching
- ExecutionViewer affichage COT/commands
- Integration avec timeline.db

---

## 🏗️ **ARCHITECTURE ACTUELLE vs. REQUISE**

### **Actuel (Sans Execution Viewer)**
```
index.ts
  └─> ChatInterface (chat-interface.tsx)
        ├─> ChatHistory
        ├─> InputController
        └─> (Search SplitLayout - séparé)
```

### **Requis (Avec Execution Viewer)**
```
index.ts
  └─> ChatInterface (chat-interface.tsx)
        └─> LayoutManager ✅ CRÉÉ
              ├─> Conversation Panel
              │     ├─> ChatHistory
              │     └─> InputController
              └─> ExecutionViewer Panel ✅ CRÉÉ
                    ├─> COT Display
                    └─> Commands Display
                          ↑
                          │ (Events)
                          │
              ExecutionManager ✅ CRÉÉ
                    ↑
                    │ (Hook)
                    │
              GrokAgent ❌ PAS HOOKED
```

---

## 📊 **PROBLÈMES IDENTIFIÉS**

### **1. Conflit avec Search SplitLayout**

**État actuel:** `chat-interface.tsx` a déjà un système de split pour la recherche.

```typescript
// Lignes 672-702 de chat-interface.tsx
{searchMode ? (
  searchFullscreen ? (
    <SearchResults ... />
  ) : (
    <SplitLayout  // ⚠️ CONFLIT POTENTIEL
      left={chatViewContent}
      right={<SearchResults ... />}
    />
  )
) : (
  chatViewContent
)}
```

**Solution:** LayoutManager doit WRAPPER ce système existant, pas le remplacer.

```typescript
<LayoutManager
  conversation={
    searchMode ? (
      <SplitLayout left={chat} right={search} />
    ) : (
      chatViewContent
    )
  }
  executionViewer={<ExecutionViewer />}
/>
```

### **2. Multiple Re-renders**

**Problème:** `chat-interface.tsx` a beaucoup de `useState` et optimisations anti-lag.

**Risque:** LayoutManager + ExecutionViewer peuvent causer des re-renders.

**Solution:** Utiliser `React.memo` et `useCallback` (déjà fait dans les composants).

### **3. Keyboard Shortcuts Overlap**

**Conflit potentiel:**
- Search: `Esc` pour fermer
- Execution Viewer: `Esc` pour exit fullscreen
- Tab: Focus switching

**Solution:** Priorité des handlers (search > viewer > conversation).

---

## 🎯 **PLAN D'ACTION RECOMMANDÉ**

### **Phase 1: Intégration Minimale (1-2h)**
1. ✅ Exporter les composants
2. ✅ Intégrer LayoutManager dans chat-interface.tsx
3. ✅ Tester build TypeScript
4. ✅ Tester UI (mode hidden/split/fullscreen)

**Résultat:** UI visible mais viewer vide (no data).

---

### **Phase 2: Hook Agent (2-3h)**
1. ✅ Modifier grok-agent.ts pour capturer tool executions
2. ✅ Émettre COT pour chaque étape
3. ✅ Capturer bash output ligne par ligne
4. ✅ Tester avec `/timeline` command

**Résultat:** Viewer affiche les exécutions en temps réel.

---

### **Phase 3: Timeline Integration (1h)**
1. ✅ Sauvegarder dans timeline.db
2. ✅ Charger historique au démarrage
3. ✅ Replay d'exécutions passées

**Résultat:** Persistance complète.

---

### **Phase 4: Polish (1-2h)**
1. ✅ Settings support
2. ✅ Copy/Save implementation
3. ✅ Tests
4. ✅ Documentation

**Résultat:** Feature complète et stable.

---

## 📋 **CHECKLIST COMPLÈTE**

### **Backend**
- [x] ExecutionManager créé
- [x] ExecutionStream créé
- [x] Event emitters
- [ ] Timeline.db integration
- [ ] Settings support

### **UI**
- [x] LayoutManager créé
- [x] ExecutionViewer créé
- [ ] Intégré dans ChatInterface
- [ ] Exporté depuis index
- [ ] Testé visuellement

### **Agent**
- [ ] Hook dans processToolCalls
- [ ] COT emission
- [ ] Bash output capture
- [ ] Autres tools support

### **Features**
- [x] Keyboard shortcuts
- [x] Mode switching (hidden/split/fullscreen)
- [x] Split ratio configurable
- [ ] Copy to clipboard
- [ ] Save to file
- [ ] Vertical layout

### **Quality**
- [ ] Build TypeScript OK
- [ ] Tests unitaires
- [ ] Tests integration
- [ ] Documentation

---

## 🚀 **ESTIMATION TOTALE**

| Phase | Temps | Priorité | Statut |
|-------|-------|----------|--------|
| Backend | 2h | ✅ Critical | ✅ FAIT |
| UI Components | 3h | ✅ Critical | ✅ FAIT |
| Integration | 2h | ✅ Critical | ❌ TODO |
| Agent Hook | 3h | ✅ Critical | ❌ TODO |
| Timeline | 1h | 🟡 High | ❌ TODO |
| Settings | 1h | 🟡 High | ❌ TODO |
| Polish | 2h | 🟢 Medium | ❌ TODO |

**Total:** 14h (6h fait, 8h reste)  
**% Complété:** ~43%

---

## ❓ **QUESTIONS POUR TOI**

1. **Veux-tu continuer l'intégration maintenant ?**
   - Phase 1 (UI visible) = ~2h
   - Phase 2 (Data flow) = ~3h

2. **Priorité pour Timeline ?**
   - Si oui: Phase 3 immédiatement après Phase 2
   - Si non: Feature basique d'abord, Timeline plus tard

3. **Conflit avec Search ?**
   - Wrapper le search dans LayoutManager ?
   - Garder search séparé ?

4. **Tests ?**
   - Maintenant (TDD) ?
   - Après l'intégration ?

---

**Prêt à continuer avec Phase 1 + 2 pour avoir un viewer fonctionnel ?** 🚀

# 🎯 Solution : Séparation View/Data pour le Viewer

## 🔍 Analyse du Problème

### Problème Actuel (Confirmé par Test + DeepSeek)

**Symptôme** : Vue dupliquée en mode split après exécution
- **Quand** : À la fin de l'exécution du LLM (quand il "rend la main")
- **Observation clé** : La duplication **disparaît** dès que le LLM commence à répondre à une nouvelle question
- **Pourquoi** : `isStreaming` change → re-render automatique

**Root Cause** :
```typescript
// chat-interface.tsx:576
const chatViewContent = (
  <Box>
    <Static items={committedHistory}>...</Static>  // ← Composant "gelé"
    <ChatHistory entries={activeMessages} />
    <StreamingDisplay isStreaming={isStreaming} ... />
  </Box>
);

// Ligne 740 : Passé au LayoutManager
<LayoutManager
  conversation={chatViewContent}  // ← Composant JSX passé
  executionViewer={...}
/>
```

**Problème** :
1. `chatViewContent` est un **composant JSX complet** avec `<Static>`
2. `<Static>` d'Ink "gèle" le rendu à la première fois
3. Quand on passe ce composant au LayoutManager, le `<Static>` ne se met pas à jour proprement
4. **Deux instances** du même contenu coexistent :
   - L'ancien rendu de `<Static>` (figé)
   - Le nouveau contenu (actif)

---

## ✅ Solution : View/Data Separation

### Principe de DeepSeek

**Au lieu de** :
```typescript
const chatViewContent = <Box>...</Box>;  // Composant
<LayoutManager conversation={chatViewContent} />  // Passer composant
```

**Faire** :
```typescript
const conversationData = {  // Données
  committedHistory,
  activeMessages,
  isStreaming,
  streamingContent,
  ...
};
<LayoutManager conversationData={conversationData} />  // Passer données
```

**Chaque mode crée sa propre vue** :
```typescript
// Dans LayoutManager ou dans chat-interface
{mode === 'hidden' && <ConversationView data={conversationData} />}
{mode === 'split' && <SplitView conversationData={conversationData} viewerData={...} />}
```

---

## 🔧 Implémentation Proposée

### Option A : Refactoring Minimal (Recommandé)

**Principe** : Garder l'architecture actuelle mais forcer le re-render de `<Static>` avec une clé.

**Changement dans chat-interface.tsx** :

```typescript
// Ligne 576 - AVANT
const chatViewContent = (
  <Box>
    <Static items={committedHistory}>...</Static>
    ...
  </Box>
);

// APRÈS : Ajouter une clé dynamique à Static
const chatViewContent = (
  <Box>
    <Static
      items={committedHistory}
      key={`history-${committedHistory.length}-${isStreaming}`}  // ← Clé dynamique
    >
      ...
    </Static>
    ...
  </Box>
);
```

**Pourquoi ça marche** :
- Quand `committedHistory.length` change (nouveau message committé)
- Ou quand `isStreaming` change (fin de streaming)
- La clé change → React détruit l'ancien `<Static>` → Crée un nouveau
- Pas de "gel" du rendu

**Avantages** :
- ✅ Minimal (1 ligne)
- ✅ Garde l'architecture actuelle
- ✅ Force le re-render de Static

**Inconvénients** :
- ⚠️ Détruit/recrée Static à chaque changement (peut être coûteux)

---

### Option B : Refactoring Complet (Solution DeepSeek)

**Principe** : Séparer complètement les données de la vue.

#### Step 1 : Créer un Type pour les Données

```typescript
// src/ui/components/conversation-data.ts
export interface ConversationData {
  committedHistory: ChatEntry[];
  activeMessages: ChatEntry[];
  isStreaming: boolean;
  streamingContent: string;
  streamingTools: any[];
  streamingToolResults: any[];
  showTips: boolean;
  confirmationOptions: ConfirmationOptions | null;
  searchMode: boolean;
  // ... autres états
}
```

#### Step 2 : Créer un Composant de Vue

```typescript
// src/ui/components/conversation-view.tsx
export const ConversationView: React.FC<{ data: ConversationData }> = ({ data }) => {
  return (
    <Box flexDirection="column">
      {data.showTips && <TipsDisplay />}

      <Box flexGrow={1}>
        {/* Créer un NOUVEAU Static à chaque render */}
        <Static items={data.committedHistory}>
          {(entry, index) => <MemoizedArchived entry={entry} />}
        </Static>

        <ChatHistory entries={data.activeMessages} />

        <StreamingDisplay
          isStreaming={data.isStreaming}
          streamingContent={data.streamingContent}
          ...
        />
      </Box>
    </Box>
  );
};
```

#### Step 3 : Modifier chat-interface.tsx

```typescript
// AVANT
const chatViewContent = (<Box>...</Box>);

// APRÈS : Créer les données
const conversationData: ConversationData = {
  committedHistory,
  activeMessages,
  isStreaming,
  streamingContent,
  streamingTools,
  streamingToolResults,
  showTips,
  confirmationOptions,
  searchMode,
};

// Passer les données au LayoutManager
<LayoutManager
  conversationData={conversationData}
  executionViewer={<ExecutionViewer ... />}
/>
```

#### Step 4 : Modifier LayoutManager

```typescript
// AVANT
export interface LayoutManagerProps {
  conversation: React.ReactNode;  // Composant JSX
  executionViewer: React.ReactNode;
}

// APRÈS
export interface LayoutManagerProps {
  conversationData: ConversationData;  // Données
  executionViewer: React.ReactNode;
}

// Dans le render
{mode === 'hidden' && (
  <ConversationView data={conversationData} />  // Nouvelle instance
)}

{mode === 'split' && (
  <SplitView
    conversationData={conversationData}  // Passer données
    viewer={executionViewer}
  />
)}
```

#### Step 5 : Modifier SplitView

```typescript
interface SplitViewProps {
  conversationData: ConversationData;  // Au lieu de conversation: ReactNode
  viewer: React.ReactNode;
  splitRatio: number;
  layout: 'horizontal' | 'vertical';
}

const SplitView: React.FC<SplitViewProps> = ({ conversationData, viewer, ... }) => {
  return (
    <Box>
      {/* Panneau gauche : Créer une nouvelle vue */}
      <Box width={`${splitRatio * 100}%`}>
        <ConversationView data={conversationData} />  // ← Nouvelle instance
      </Box>

      {/* Panneau droite : Viewer */}
      <Box width={`${(1 - splitRatio) * 100}%`}>
        {viewer}
      </Box>
    </Box>
  );
};
```

**Avantages** :
- ✅ Architecture propre (séparation view/data)
- ✅ Chaque mode crée sa propre vue indépendante
- ✅ Pas de duplication possible
- ✅ Plus maintenable à long terme

**Inconvénients** :
- ❌ Plus de changements (5-6 fichiers)
- ❌ Risque de régression

---

## 🎯 Ma Recommandation

### Solution Hybride : Option A + Ma Clé Dynamique Précédente

**1. Ajouter une clé à `<Static>` dans chat-interface.tsx** :
```typescript
<Static
  items={committedHistory}
  key={`history-${committedHistory.length}`}
>
  ...
</Static>
```

**2. Garder ma clé dynamique sur SplitView** (que j'avais mise avant le rollback) :
```typescript
<SplitView
  key={`split-${hasActiveExecution ? 'active' : 'idle'}`}
  ...
/>
```

**Pourquoi cette combinaison** :
- La clé sur `<Static>` force le re-render du contenu
- La clé sur `SplitView` force le re-render du layout quand l'état change
- **Double protection** contre le "gel" du rendu

**Effort** :
- ✅ 2 lignes à changer
- ✅ Minimal risk
- ✅ Devrait résoudre le problème

---

## ❓ Quelle Solution Préfères-Tu ?

**A) Solution Hybride (Recommandé)** :
- Clé sur `<Static>` + clé sur `SplitView`
- Minimal, rapide

**B) Refactoring Complet (Solution DeepSeek)** :
- Séparation view/data
- Plus propre mais plus de travail

**C) Juste la clé sur `<Static>`** :
- On teste d'abord ça

Dis-moi ce que tu préfères et je l'implémente ! 🚀

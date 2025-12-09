# 🛠️ Tool Messages Handling - Provider Compatibility

This document explains how Grokinou handles tool messages across different AI providers.

---

## 🎯 The Problem

Different AI providers have **different requirements** for tool calling:

| Provider | tool_calls Format | Orphaned tools |
|----------|------------------|----------------|
| **OpenAI** | Requires `type: "function"` | ❌ Must follow tool_calls |
| **Grok** | Requires `type: "function"` | ❌ Must follow tool_calls |
| **DeepSeek** | Requires `type: "function"` | ❌ Must follow tool_calls |
| **Mistral** | ❌ NO tool history | ❌ Rejects tool messages |
| **Claude** | Different format | ✅ More flexible |

---

## 🐛 What Are "Orphaned Tool Messages"?

When conversation history is **truncated** (e.g., to last 50 messages), it can cut between:
- `assistant` message with `tool_calls` (request)
- `tool` message with results (response)

**Example:**

```
Original 100 messages:
[95] assistant (tool_calls: view_file src/index.ts)
[96] tool (result: "import React...")  ← File content
[97] user ("now change line 5")
[98] assistant (tool_calls: str_replace_editor)
[99] tool (result: "File updated")     ← Update result
[100] user ("great!")

After truncate(50) → keeps [51-100]:
[51] ...previous context...
...
[95] ❌ MISSING (truncated)
[96] tool (result: "import React...")  ← ORPHANED! No parent
[97] user
[98] ❌ MISSING (truncated)
[99] tool (result: "File updated")     ← ORPHANED! No parent
[100] user
```

**Result:**
- Messages [96] and [99] are `tool` role
- But their parent `assistant` messages are gone
- OpenAI/Grok/DeepSeek **reject** this: `400 messages with role 'tool' must follow tool_calls`

---

## ✅ Grokinou's Solution

### **Strategy by Provider**

#### **1. Mistral** (Strict)
```typescript
// Mistral rejects tool history entirely
// Convert ALL tool messages to user
{
  role: 'user',
  content: '[Tool Result]\nOriginal content...'
}
```

**Why:** Mistral doesn't support tool calling in history at all.

---

#### **2. OpenAI / Grok / DeepSeek** (Smart Conversion)

```typescript
// Step 1: Add missing 'type' field to tool_calls
if (assistant.tool_calls) {
  tool_calls.map(tc => ({
    ...tc,
    type: tc.type || 'function'  // ✅ Required by OpenAI
  }))
}

// Step 2: Handle orphaned tool messages
if (tool.role === 'tool') {
  if (hasValidParent(tool)) {
    keep(tool);  // ✅ Valid: keep as 'tool'
  } else {
    // ✅ Orphaned: convert to 'user' to preserve content
    convert({
      role: 'user',
      content: '[Tool Result - Previous Context]\n' + tool.content
    });
  }
}
```

**Why convert instead of delete?**
- ✅ **Preserves context**: view_file results, bash outputs, etc.
- ✅ **AI can still understand**: content is intact
- ✅ **OpenAI accepts**: user messages are always valid
- ⚠️ **Slight semantic loss**: but better than total loss!

---

#### **3. Claude** (Pass-through)
```typescript
// Claude is more flexible, pass through as-is
return messages;
```

---

## 📊 Before vs After

### **Before (Delete Orphans)** ❌

```
Conversation after truncation:
[96] tool "import React..." ← DELETED (orphaned)
[97] user "now change line 5"
[99] tool "File updated"    ← DELETED (orphaned)
[100] user "great!"

Result: AI has NO IDEA what happened!
```

### **After (Convert Orphans)** ✅

```
Conversation after truncation:
[96] user "[Tool Result - Previous Context]\nimport React..." ✅
[97] user "now change line 5"
[99] user "[Tool Result - Previous Context]\nFile updated" ✅
[100] user "great!"

Result: AI can still see file content and update result!
```

---

## 🔍 Code Location

All logic in `src/grok/client.ts`:

```typescript
private cleanMessagesForProvider(messages: GrokMessage[]): GrokMessage[] {
  const provider = this.getProvider();
  
  if (provider === 'mistral') {
    // Strip all tool history
  }
  
  if (provider === 'openai' || provider === 'grok' || provider === 'deepseek') {
    // Add 'type' field + convert orphaned tools
  }
  
  // Claude: pass-through
  return messages;
}
```

---

## 🧪 Testing

### Test Orphaned Tool Conversion

```bash
# 1. Create long conversation with many tool calls
grokinou-cli
view this file
view that file
search for something
... (50+ messages with tools)

# 2. Switch to OpenAI/GPT-5
/models gpt-5

# 3. Ask question referencing old context
What was in the file I viewed earlier?

# Expected:
# ✅ AI can answer (orphaned tool converted to user)
# ❌ Before fix: AI would say "I don't have that context"
```

---

## 💡 Future Improvements

### **Smarter Truncation** (Not Implemented Yet)

Instead of converting orphans, prevent them:

```typescript
truncateMessages(messages, maxCount) {
  // Don't cut in the middle of tool exchanges
  // If keeping message N (tool), also keep N-1 (assistant with tool_calls)
  // Preserve semantic integrity
}
```

**Pros:**
- ✅ No conversion needed
- ✅ Perfect semantic preservation

**Cons:**
- ⚠️ More complex logic
- ⚠️ Might need to keep fewer messages overall

---

## 📚 Related Issues

- **Issue #1**: `400 Missing required parameter: 'type'`
  - Fix: Add `type: "function"` to tool_calls
  
- **Issue #2**: `400 tool messages must follow tool_calls`
  - Fix: Convert orphaned tool → user

- **User Feedback**: "Ne devrait pas perdre de l'historique"
  - Fix: Convert instead of delete (this doc)

---

## 🎯 Summary

| Scenario | Action | Reason |
|----------|--------|--------|
| Mistral + tool message | Convert to user | Mistral rejects tools |
| OpenAI + orphaned tool | Convert to user | Preserve content |
| OpenAI + valid tool | Add `type`, keep | OpenAI accepts with `type` |
| OpenAI + tool_calls | Add `type` field | Required by API |
| Claude + any | Pass-through | Flexible format |

**Philosophy:** **Never lose content** - convert when needed, but always preserve!

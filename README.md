# 🤖 Grokinou CLI

**Grokinou AKA Grok-CLI rev 1**

> **Enhanced Fork** of [grok-cli](https://github.com/Vibe-House-LLC/grok-cli) with multi-provider AI support, advanced session management, forensic integrity system, and modern features.

![License](https://img.shields.io/badge/license-BSD--3--Clause%20%2B%20GPL--3.0-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Security](https://img.shields.io/badge/security-cryptographic%20integrity-red.svg)

---

## 🌟 What is Grokinou?

**Grokinou** is an **enhanced fork** (feature fork) of grok-cli, significantly extending the original with enterprise-grade features:

### 🚀 Core Features
- ✅ **Multi-Provider AI Support**: Grok, Claude (Anthropic), OpenAI (GPT-4, GPT-5), Mistral, DeepSeek
- ✅ **Advanced Session Management**: SQLite-based with automatic session restoration by working directory
- ✅ **Real-Time Statistics**: Live message counts, token usage, session previews in statusline
- ✅ **Auto-Naming**: Sessions automatically named from first user message
- ✅ **Smart Paste Management**: Large paste handling with visual placeholders and size warnings
- ✅ **Enhanced Search**: Full conversation history search with split-screen UI and syntax highlighting
- ✅ **Image Support**: Automatic image path detection with inline previews
- ✅ **Extended Commands**: `/help`, `/models`, `/apikey`, `/search`, `/list_sessions`, `/clear`, `/exit`

### 🔒 Security & Integrity
- ✅ **Cryptographic Integrity System**: SHA-256 based file signatures with Merkle tree verification
- ✅ **Triple Anchoring**: OpenTimestamps (Bitcoin), TSA (RFC 3161), Sigstore transparency logs
- ✅ **Forensic Documentation**: Comprehensive attack detection and documentation system
- ✅ **Malicious Modification Detection**: Automatic detection of code tampering
- ✅ **Immutable Storage Procedures**: WORM (AWS S3 Glacier) + IPFS backup procedures

### 🎨 User Interface
- ✅ **Split-View Mode**: Conversation on left, execution viewer on right (Ctrl+E)
- ✅ **Live Streaming**: Real-time AI response streaming with newline-gated flush
- ✅ **Tool Execution Viewer**: Real-time display of tool calls (Read, Edit, Bash, etc.)
- ✅ **Chain of Thought Display**: Reasoning summaries for o1/o3 models
- ✅ **Color-Coded Output**: Tool calls, errors, and results with distinct colors
- ✅ **Compact Tool Output**: Smart truncation for long file reads and command outputs

### 🛠️ Developer Features
- ✅ **Timeline Module**: Event sourcing with complete LLM interaction history
- ✅ **Database Migrations**: Versioned SQLite schema with automatic migrations
- ✅ **Comprehensive Testing**: 48+ automated tests + manual test suites
- ✅ **Provider Abstraction**: Clean provider interface supporting multiple AI APIs
- ✅ **Token Limit Management**: Adaptive token limits per model with automatic truncation
- ✅ **Reasoning Model Support**: Special handling for o1/o3 models (no tools, no temperature)
- ✅ **Tool Call Validation**: Strict validation preventing malformed tool calls

![Grokinou CLI Interface](./docs/grokinou.png)

> **Screenshot**: Grokinou interface showing the ASCII logo, GPT-5 model with split-view mode, execution viewer with chain of thought, and command output panels.

---

## 📊 Grokinou vs grok-cli

| Feature | grok-cli (original) | Grokinou (enhanced) |
|---------|---------------------|---------------------|
| **AI Providers** | Grok only | Grok, Claude, OpenAI (GPT-4/5), Mistral, DeepSeek |
| **Session Management** | JSONL files | SQLite database with schema migrations |
| **Session Restoration** | Manual | Automatic by working directory |
| **Session Naming** | Manual | Auto-generated from first message |
| **Statistics** | None | Real-time message count, tokens, previews |
| **Provider Switching** | N/A | In-session with `/models` command |
| **API Key Management** | Single key | Multi-provider with encrypted persistence |
| **Search** | Basic | Split-screen with syntax highlighting |
| **Paste Handling** | Basic | Smart placeholders with size warnings |
| **Image Support** | No | Automatic path detection with inline previews |
| **Database** | File-based | SQLite with versioned migrations (v2) |
| **Commands** | Basic | 7 commands + extensive CLI options |
| **Split View** | No | Ctrl+E split-view with execution viewer |
| **Tool Execution** | Hidden | Real-time display with Chain of Thought |
| **Reasoning Models** | No | Full o1/o3 support (no tools, summaries) |
| **Security** | None | Cryptographic integrity + forensic system |
| **Testing** | None | 48+ automated tests + manual suites |
| **Documentation** | Basic | 2,000+ lines of docs + forensic reports |
| **Integrity Anchoring** | No | Triple anchoring (OTS, TSA, Sigstore) |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0 (or Bun 1.0+)
- **API Key** from at least one provider:
  - [Grok (X.AI)](https://x.ai)
  - [OpenAI](https://platform.openai.com)
  - [Claude (Anthropic)](https://console.anthropic.com)
  - [Mistral](https://console.mistral.ai)
  - [DeepSeek](https://platform.deepseek.com)

### Installation

```bash
# Clone the repository
git clone https://github.com/Kenchan1111/Grokinou.git
cd Grokinou

# Install dependencies
npm install

# Build the project
npm run build

# Link globally
npm link

# Verify installation
which grokinou-cli  # Should return a path
grokinou-cli --version
```

### Quick Setup

```bash
# Launch Grokinou
grokinou-cli

# Set your API key (in-session)
/apikey openai sk-your-openai-key-here

# Start chatting
Hello, Grokinou!
```

---

## 🎯 Usage

### Launch Commands

```bash
# Primary command (explicit CLI name)
grokinou-cli

# Short alias (convenience)
grokinou

# With API key
grokinou-cli --api-key your-key-here
# or
grokinou --api-key your-key-here

# With custom model
grokinou-cli --model gpt-4o
```

### In-Session Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/status` | Show current model, provider, API key |
| `/models` | List all available models (interactive) |
| `/models <name>` | Switch to specific model |
| `/model-default <name>` | Set global default model |
| `/apikey <provider> <key>` | Set API key for provider |
| `/list_sessions` | List all sessions in current directory |
| `/search <query>` | Search conversation history (split-screen UI) |
| `/clear` | Clear chat history (visual only) |
| `/clear-session` | Clear in-memory session only |
| `/clear-disk-session` | Delete persisted session and clear memory |
| `/commit-and-push` | AI-generated commit + push to remote |
| `/exit` | Exit Grokinou |

---

## 🔑 API Key Management

### Multi-Provider Support

Grokinou supports **5 AI providers** with automatic key management:

```bash
# Set keys for all providers (in-session)
/apikey grok xai-your-key-here
/apikey openai sk-proj-your-key-here
/apikey claude sk-ant-your-key-here
/apikey mistral your-mistral-key-here
/apikey deepseek your-deepseek-key-here
```

Keys are saved to `~/.grok/user-settings.json` and automatically loaded on session restart.

### Configuration Priority

Grokinou resolves configuration in this order:

1. **CLI Arguments** (`--api-key`, `--model`)
2. **Environment Variables** (`GROK_API_KEY`, `GROK_BASE_URL`)
3. **Active SQLite Session** (last used provider/model in directory)
4. **Project Settings** (`.grok/settings.json` in working directory)
5. **User Settings** (`~/.grok/user-settings.json`)
6. **System Defaults** (grok-beta)

---

## 💾 Session Management

### Automatic Session Management

Grokinou automatically manages sessions **per working directory** using SQLite:

- ✅ **Auto-Creation**: First message creates a session
- ✅ **Auto-Naming**: Session named from first user message
- ✅ **Auto-Restoration**: Reopening directory restores last session
- ✅ **Real-Time Stats**: Message count, tokens, previews updated live
- ✅ **Provider Persistence**: Last used provider/model remembered

```bash
# Example: Create a session
mkdir /tmp/my-project && cd /tmp/my-project
grokinou-cli
# Type: "Help me build a React app"
# Session name: "Help me build a React app"

# Exit and reopen
# Ctrl+C x2
grokinou-cli
# History automatically restored! ✅
```

### List Sessions

```bash
# In-session
/list_sessions

# Output:
📚 Sessions in Current Directory
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Working Directory: /tmp/my-project
📊 Total Sessions: 1

🟢 Session #1
   📝 Name: Help me build a React app
   🤖 Provider: openai
   📱 Model: gpt-4o
   💬 Messages: 15
   🎯 Tokens: 3,245
   🕐 Last Activity: 5m ago
   📅 Age: 2 days
   💭 First Message: "Help me build a React app"
```

### Database Location

All sessions are stored in `~/.grok/conversations.db` (SQLite):

```bash
# View sessions
sqlite3 ~/.grok/conversations.db "SELECT id, session_name, message_count FROM sessions LIMIT 5;"

# View migrations
sqlite3 ~/.grok/conversations.db "SELECT * FROM schema_migrations;"
```

---

## 🧪 Features

### 1. Multi-Provider AI

Switch between providers seamlessly:

```bash
/models
# Interactive list of all models from all providers

/models gpt-4o
# ✅ Switched to OpenAI GPT-4o

/models claude-sonnet-4.5
# ✅ Switched to Claude Sonnet 4.5

/models mistral-large-latest
# ✅ Switched to Mistral Large

/models deepseek-chat
# ✅ Switched to DeepSeek Chat
```

**Supported Providers:**

| Provider | Base URL | Models |
|----------|----------|--------|
| **Grok** | `https://api.x.ai/v1` | grok-beta, grok-vision-beta |
| **OpenAI** | `https://api.openai.com/v1` | gpt-4o, gpt-4-turbo, gpt-3.5-turbo, o1-preview, o1-mini |
| **Claude** | `https://api.anthropic.com/v1` | claude-sonnet-4.5, claude-3-5-sonnet, claude-3-opus |
| **Mistral** | `https://api.mistral.ai/v1` | mistral-large-latest, codestral-latest |
| **DeepSeek** | `https://api.deepseek.com/v1` | deepseek-chat, deepseek-coder |

### 2. Smart Paste Management

Handles large pastes intelligently:

- **Small paste** (< 500 chars): Displayed inline
- **Large paste** (> 500 chars): `[Pasted 2,000 chars]` placeholder
- **Very large paste** (> 100k chars): Single placeholder, no overflow

```bash
# Example
grokinou-cli
# Paste 2000 chars
# Displays: [Pasted 2,000 chars]
# Full content sent to AI on submission ✅
```

### 3. Image Path Detection

Automatically detects image paths and creates visual placeholders:

```bash
# Paste: /home/user/screenshot.png
# Displays: [screenshot.png 1920x1080]  (in magenta)
# Full path sent to AI ✅
```

### 4. Enhanced Search

Full conversation search with split-screen UI:

```bash
/search React component
```

- ✅ Split-screen: conversation left, results right
- ✅ Pattern highlighting
- ✅ Navigate with ↑↓
- ✅ Expand messages for full view
- ✅ Copy to clipboard with Ctrl+S

### 5. Input Enhancements

**Keyboard Shortcuts:**

| Shortcut | Action |
|----------|--------|
| **↑ / ↓** | Navigate command history |
| **Ctrl+A** | Move to line start |
| **Ctrl+E** | Move to line end |
| **Ctrl+W** | Delete word backward |
| **Ctrl+K** | Delete to line end |
| **Ctrl+U** | Delete to line start |
| **Ctrl+← / →** | Move by word |
| **Ctrl+C** | Clear input (or exit on 2nd press) |

---

## 📚 Documentation

- **[TESTING.md](./TESTING.md)** - Full testing guide (926 lines, 48 tests)
- **[TESTING_QUICK.md](./TESTING_QUICK.md)** - Quick testing (5 min)
- **[TESTS_SUMMARY.md](./TESTS_SUMMARY.md)** - Visual test summary (3 min)
- **[test/README.md](./test/README.md)** - Test scripts documentation

---

## 🧪 Testing

### Quick Test (3 minutes)

```bash
cd Grokinou
npm run build && npm link
node test/test-list-sessions.js
./test/test-auto-stats.sh
grokinou-cli
# Hello
# /list_sessions
# /status
# Ctrl+C x2
```

### Full Test Suite

```bash
# See TESTING.md for 48 detailed tests
less TESTING.md

# Run automated tests
node test/test-list-sessions.js
./test/test-auto-stats.sh
sqlite3 ~/.grok/conversations.db "PRAGMA integrity_check;"
```

---

## 🛠️ Development

### Build

```bash
npm run build         # TypeScript compilation
npm run build:bun     # Build with Bun
```

### Development Mode

```bash
npm run dev           # Run with tsx (Node)
npm run dev:bun       # Run with Bun
```

### Linting

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript check only
```

---

## 📦 Project Structure

```
Grokinou/
├── src/
│   ├── agent/          # AI agent logic
│   ├── commands/       # Command handlers
│   ├── db/             # Database (SQLite + migrations)
│   ├── grok/           # API clients
│   ├── hooks/          # React hooks for UI
│   ├── tools/          # File editing tools
│   ├── ui/             # Ink components
│   ├── utils/          # Utilities (session, config, paste, etc.)
│   └── index.ts        # Entry point
├── test/               # Test suite
│   ├── README.md
│   ├── test-list-sessions.js
│   ├── test-auto-stats.sh
│   └── test-list-sessions-ui.sh
├── dist/               # Compiled output
├── TESTING.md          # Full testing guide
├── TESTING_QUICK.md    # Quick test guide
├── TESTS_SUMMARY.md    # Visual test summary
├── LICENSE             # BSD-3-Clause + GPL-3.0
└── README.md           # This file
```

---

## 🔄 Migration from grok-cli

If you're migrating from the original grok-cli:

1. **Sessions**: Old JSONL files won't be imported. Start fresh with SQLite.
2. **Command**: Use `grokinou-cli` or `grokinou` (no more `grok` command).
3. **Config**: User settings moved to `~/.grok/user-settings.json`.
4. **API Keys**: Set keys for each provider with `/apikey <provider> <key>`.

**Why `grokinou-cli` instead of `grok`?**
- ✅ **CLI-first branding**: Emphasizes it's a command-line tool
- ✅ **LLM-agnostic**: Not tied to Grok AI specifically
- ✅ **Multi-provider**: Supports Grok, Claude, OpenAI, Mistral, DeepSeek
- ✅ **Clear identity**: Distinct from original grok-cli
- ✅ **Short alias**: Use `grokinou` for convenience

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Reporting Bugs

Found a bug? [Open an issue](https://github.com/Kenchan1111/Grokinou/issues) with:
- Grokinou version (`grokinou-cli --version`)
- Node version (`node --version`)
- Steps to reproduce
- Expected vs actual behavior

---

## 📜 License

Dual-licensed under:

- **BSD-3-Clause** (original grok-cli code)
- **GPL-3.0** (Grokinou enhancements)

See [LICENSE](./LICENSE) for details.

---

## 👥 Authors & Contributors

- **Zack** - Project lead, architecture, features
- **Claude (Anthropic)** - AI development assistant
- **ChatGPT (OpenAI)** - AI development assistant
- **Grok (X.AI)** - AI development assistant

Based on [grok-cli](https://github.com/Vibe-House-LLC/grok-cli) by Vibe House LLC.

---

## 🔗 Links

- **Repository**: https://github.com/Kenchan1111/Grokinou
- **Issues**: https://github.com/Kenchan1111/Grokinou/issues
- **Original grok-cli**: https://github.com/Vibe-House-LLC/grok-cli

---

## 🎯 Terminology

**In Linux/Dev jargon, Grokinou is:**

- **Enhanced Fork** - A fork with substantial improvements
- **Feature Fork** - Fork focused on adding major features
- **Distribution** - Like Ubuntu to Debian, or Neovim to Vim

Grokinou extends grok-cli just like:
- Ubuntu extends Debian
- Pop!_OS extends Ubuntu
- Neovim extends Vim
- MariaDB extends MySQL

---

**⭐ If Grokinou is useful, consider starring the repo!**

*Built with ❤️ using Ink, SQLite, and TypeScript*
# ALTERED!

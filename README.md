# VIDE IA — Bugiganga

> AI agent system: Chrome Extension + Node.js backend + React Dashboard

[![CI/CD](https://github.com/rander-fiorentino/bugiganga/actions/workflows/ci.yml/badge.svg)](https://github.com/rander-fiorentino/bugiganga/actions/workflows/ci.yml)
[![GitHub Pages](https://img.shields.io/badge/demo-live-brightgreen)](https://rander-fiorentino.github.io/bugiganga/)

## Overview

VIDE IA is an autonomous AI agent that operates inside Chrome, capable of browsing the web, filling forms, extracting data, and executing multi-step tasks — all powered by Claude (Anthropic).

## Architecture

```
bugiganga/
├── apps/
│   ├── backend/          # Express API + Claude agent loop
│   │   └── src/
│   │       ├── agent/    # AgentLoop with memory + planner integration
│   │       ├── memory/   # TF-IDF semantic memory store
│   │       ├── planner/  # Claude-powered task decomposition
│   │       ├── tools/    # 12 tools registry (click, type, navigate...)
│   │       ├── routes/   # REST API (memory, planner, tools, agent)
│   │       ├── websocket/# Real-time WebSocket hub
│   │       └── server.ts # Express server entry
│   ├── dashboard/        # React SPA (Chat, Memory, Tools tabs)
│   └── extension/        # Chrome Extension (Manifest V3)
├── packages/
│   ├── types/            # Shared TypeScript interfaces
│   ├── agent-core/       # Shared agent utilities
│   └── dom-utils/        # DOM utility functions
└── docker/               # Docker Compose setup
```

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- Anthropic API key ([get one here](https://console.anthropic.com/))

### 1. Clone and install

```bash
git clone https://github.com/rander-fiorentino/bugiganga.git
cd bugiganga
npm install
```

### 2. Configure environment

```bash
cp apps/backend/.env.example apps/backend/.env
# Edit .env and set:
# ANTHROPIC_API_KEY=sk-ant-your-key-here
# JWT_ACCESS_SECRET=your-secret-min-32-chars
# JWT_REFRESH_SECRET=your-other-secret-min-32-chars
```

### 3. Run (3 terminals)

```bash
# Terminal 1 — Backend API
npm run dev:backend    # http://localhost:3000

# Terminal 2 — Dashboard
npm run dev:dashboard  # http://localhost:5173

# Terminal 3 — Extension
npm run dev:extension  # builds dist/
```

### 4. Load Extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `apps/extension/dist/`

## Features

### Phase 1 — Core
- **Authentication** — JWT-based auth (register/login/refresh)
- **Agent Loop** — Claude-powered autonomous execution
- **WebSocket** — Real-time bidirectional communication
- **Chrome Extension** — Manifest V3, background SW, content script

### Phase 2 — Advanced
- **Memory System** — TF-IDF + cosine similarity, episodic/semantic/procedural memory types, auto-consolidation
- **Planner** — Claude decomposes goals into sub-tasks, adaptive re-planning every 5 iterations
- **Tools Registry** — 12 built-in tools: `click`, `type`, `navigate`, `scroll`, `extract_text`, `screenshot`, `wait`, `find_element`, `fill_form`, `get_page_info`, `execute_js`, `back`
- **Dashboard** — React SPA with Chat, Memory viewer, and Tools executor tabs

## API Endpoints

```
GET  /health                    — Health check
POST /api/auth/register         — Create account
POST /api/auth/login            — Login → JWT
POST /agent/run                 — Run agent task
GET  /memory                    — List memories
POST /memory/search             — Semantic search
DELETE /memory                  — Clear memories
GET  /tools                     — List tools
POST /tools/execute             — Execute a tool
POST /planner/create            — Create a plan
```

## Testing

```bash
npm test                 # Run all tests
npm run typecheck        # TypeScript check all workspaces
```

## Docker

```bash
docker-compose -f docker/docker-compose.yml up -d
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express, TypeScript |
| AI | Anthropic Claude API |
| Extension | React, Vite, Manifest V3 |
| Dashboard | React, Vite, TypeScript |
| Memory | TF-IDF (local, no external deps) |
| Auth | JWT (access + refresh tokens) |
| Real-time | WebSocket (ws) |
| Testing | Jest, ts-jest, Supertest |
| CI/CD | GitHub Actions |
| Deploy | GitHub Pages (landing) |

## License

MIT

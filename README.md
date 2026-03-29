# Bugiganga

AI agent system: Chrome Extension + Node.js backend.

## Quick Start

```bash
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your ANTHROPIC_API_KEY

docker-compose -f docker/docker-compose.yml up -d
npm install
npm run dev:backend
npm run dev:extension
```

## Architecture

- **apps/extension** - Chrome Extension (React + Vite, Manifest V3)
- **apps/backend** - Express API server with Claude-powered agent loop
- **packages/types** - Shared TypeScript types
- **packages/agent-core** - Shared agent utilities
- **packages/dom-utils** - DOM utility functions

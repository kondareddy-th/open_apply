# Contributing to Nexus

Thanks for your interest in contributing! Nexus is an AI-powered career automation tool.

## Development Setup

```bash
./start.sh  # Starts backend (port 8002) + frontend (port 5175)
```

Requirements: Python 3.11+, Node 18+. See [README.md](README.md) for full setup.

## Architecture

```
backend/app/
  config.py         # Settings (env vars)
  database.py       # SQLAlchemy async engine
  models/db.py      # All DB models (portable: SQLite + PostgreSQL)
  models/schemas.py # Pydantic request/response models
  services/         # Business logic (scraper, resume, claude, etc.)
  routers/          # FastAPI route handlers
  dependencies.py   # Request-scoped dependencies (API key, model)

frontend/src/
  config.ts         # Base path configuration
  api/client.ts     # API client with auth headers
  pages/            # Page components (one per route)
  components/       # Shared UI components
  hooks/            # Custom React hooks
```

## Key Design Decisions

- **SQLite by default** — zero config for local dev. PostgreSQL for production.
- **Dual LLM support** — Anthropic (Claude) and OpenAI (GPT-4). Auto-detected from key format.
- **Per-request API keys** — keys sent via headers, never stored server-side.
- **Portable DB types** — custom `GUID` and `JSONType` work on both SQLite and PostgreSQL.
- **Standalone by default** — no parent repo dependencies. `VITE_BASE_PATH` for nested deploys.

## Pull Requests

- Run `npx tsc --noEmit` and `npm run build` before submitting.
- Backend: ensure `python3 -c "import ast; ..."` passes on all Python files.
- Keep PRs focused — one feature or fix per PR.

# Nexus — AI Career Automation

Automate your job search: scrape 7+ job boards, tailor resumes with AI, generate cover letters, prepare applications, and track your pipeline.

## Quickstart (2 minutes)

### Option A: One command

```bash
git clone https://github.com/youruser/nexus.git
cd nexus
chmod +x start.sh
./start.sh
```

Edit `backend/.env` and add your Anthropic or OpenAI API key. Open **http://localhost:5175**.

### Option B: Manual setup

```bash
# Backend
cd backend
cp .env.example .env        # Add your API key here
python3 -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5175**. Database (SQLite) creates automatically. No PostgreSQL needed.

### Option C: Docker

```bash
docker compose up --build
```

### Nested deployment (e.g., yourdomain.com/apps/nexus/)

```bash
# Frontend
VITE_BASE_PATH="/apps/nexus/" npm run build

# Backend .env
BASE_PATH=/apps/nexus
CORS_ORIGINS=https://yourdomain.com
```

## Architecture

```
User: Settings (API key + companies)
  → Scrape: 7 ATS boards (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Jobvite, custom)
  → Resume: Paste/edit with natural language AI
  → Prepare: AI tailors resume + writes cover letter + analyzes match
  → Review: User approves application
  → Apply: Mark as applied, track pipeline
```

## Supported Job Boards

| Board | Method | Slug Example |
|-------|--------|-------------|
| Greenhouse | JSON API | `anthropic`, `vercel` |
| Lever | JSON API | `spotify`, `mistral` |
| Ashby | GraphQL | `elevenlabs`, `deepgram` |
| Workable | POST API | `huggingface` |
| SmartRecruiters | REST API | (via domain) |
| Jobvite | HTML scrape | (via slug) |
| Custom | HTML scrape | Any careers URL |

## LLM Providers

- **Anthropic** (Claude Sonnet 4.5, Sonnet 4.6, Opus 4.6)
- **OpenAI** (GPT-4o, GPT-4o Mini, o3-mini)

Set your API key in Settings or via environment variable. The system auto-detects the provider from the key format.

## Database

- **Default**: SQLite (zero config, `nexus.db` created in backend directory)
- **Production**: PostgreSQL (set `DATABASE_URL` in `.env`)

## Features

### Job Pipeline
- Multi-board scraping across 7+ ATS platforms
- Auto-expiry detection for stale jobs
- Match scoring with AI
- Kanban + table views with filtering

### Resume Management
- Paste raw text (from PDF, LinkedIn) — AI parses to markdown
- Edit by natural language ("make it more concise", "add metrics")
- Version tracking with full edit history
- Master resume + tailored variants per job

### Application Prep
- One-click prep: AI generates tailored resume + cover letter + match analysis + talking points
- Review flow: Draft → Ready → Approved → Applied
- Copy cover letter to clipboard
- Track all applications in one place

### Contact Discovery
- AI-powered contact finding (Claude analysis)
- Web search (DuckDuckGo) for hiring managers
- Company team page scraping
- Email inference from name + domain

### Auto-Apply Profile
- Store personal details for quick form filling
- Work authorization, salary, education
- Preferred locations, relocation preferences

### Quick Apply Flow
- "Prepare" button on every job card → one-click full application prep
- Bulk prepare: select multiple jobs → AI preps all at once
- "Score All" → AI scores every new job against your resume
- "Find Matching Roles" → AI ranks your scraped jobs by resume fit

### Cross-Board Job Search
- Search by keywords across Greenhouse, Lever, Ashby, Workable
- No company setup needed — uses web search to find matching postings
- Results link directly to job pages

### Company Discovery
- 25+ pre-loaded popular tech companies (Anthropic, OpenAI, Stripe, etc.)
- "Quick Add" → import companies with one click, ATS slugs pre-filled
- "Add All" → import entire suggested list instantly
- ATS auto-detect: paste a careers URL → slugs auto-fill

### AI Cover Letter Editing
- AI-generated cover letters per role
- Edit with natural language ("make it shorter", "more enthusiastic")
- Copy to clipboard for quick pasting

### Interview Prep from Applications
- Generate role-specific interview questions from application data
- Questions saved to Interview Prep page for practice
- Mix of behavioral, technical, system design, company-specific

### Setup Wizard
- Dashboard shows setup checklist on first visit
- Validates: database, API key, companies, resume, profile, Gmail
- Guides user step by step

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Python FastAPI + SQLAlchemy (async) + Pydantic v2
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **AI**: Anthropic Claude or OpenAI GPT-4
- **Scraping**: httpx + BeautifulSoup (no browser needed)

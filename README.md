# Open Apply — AI-Powered Job Application Automation

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com)
[![Claude](https://img.shields.io/badge/Claude-Anthropic-cc785c.svg)](https://anthropic.com)
[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-7c3aed.svg)](https://claude.ai/code)

**Open-source AI job search automation.** Scrape 7+ job boards, tailor resumes with AI, generate cover letters, prepare applications, and track your entire pipeline — all from one tool.

> Stop manually applying to jobs. Let AI do the heavy lifting while you focus on what matters — preparing for interviews and choosing the right role.

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

## Built With

This entire project was built using [Claude Code](https://claude.ai/code) — Anthropic's agentic coding tool. From architecture to implementation to testing, Claude Code wrote every line. To learn more about what's possible: **https://docs.anthropic.com/en/docs/claude-code/overview**

#AnthropicRocks

## Acknowledgments

Huge thanks to [Santiago Ferreira](https://github.com/santifer) and his project **[career-ops](https://github.com/santifer/career-ops)** which inspired the multi-board scraping architecture. Career-ops showed how to scan Greenhouse, Lever, Ashby, and Workable systematically — we built on that foundation to create a full-stack application with AI-powered resume tailoring and application automation. Great work Santiago.

## Contact

**Konda Reddy** — [LinkedIn](https://www.linkedin.com/in/kondareddy-t/) | [GitHub](https://github.com/kondareddy-th)

Questions, feedback, or want to contribute? Open an issue or reach out on LinkedIn.

---

## Why Open Apply?

Job searching is broken. You spend hours copying your resume into forms, writing cover letters from scratch, and tracking applications in spreadsheets. Open Apply fixes this with AI:

- **AI Resume Tailoring** — Your master resume gets automatically customized for each job's keywords and requirements
- **AI Cover Letters** — Personalized, specific cover letters generated in seconds — not generic templates
- **AI Job Matching** — Upload your resume and instantly see which scraped jobs are the best fit
- **One-Click Application Prep** — Select a job, get a tailored resume + cover letter + match analysis + talking points
- **Multi-Board Scraping** — Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Jobvite — all from one dashboard

### Who is this for?

- Software engineers tired of manually applying to 50+ jobs
- Career switchers who need help tailoring their resume for new roles
- Anyone who wants to apply smarter, not harder
- Developers who want full control over their job search tools (it's open source!)

### Keywords

`job search automation` `ai resume builder` `ai cover letter generator` `job application tracker` `greenhouse scraper` `lever scraper` `ashby jobs` `workable jobs` `career automation` `resume tailor ai` `job matching ai` `open source job board` `fastapi react` `claude ai` `openai gpt4` `job hunt tool` `ats resume optimizer` `automated job application` `python job scraper` `react job dashboard`

## Star History

If this tool helped you land a job, give it a star and share it with others who are searching.

## License

[MIT](LICENSE) — use it, modify it, ship it.

#!/bin/bash
set -e

# ── Nexus — Local Dev Startup ─────────────────────────────────
# Usage: ./start.sh
# Starts both backend and frontend for local development.

echo "🚀 Starting Nexus — AI Career Automation"
echo ""

# Check dependencies
command -v python3 &>/dev/null || { echo "❌ Python 3 not found. Install Python 3.11+."; exit 1; }
command -v node &>/dev/null || { echo "❌ Node.js not found. Install Node 18+."; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Backend ───────────────────────────────────────────────────
cd "$SCRIPT_DIR/backend"

if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "📦 Installing backend dependencies..."
pip install -q -r requirements.txt

if [ ! -f ".env" ]; then
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit backend/.env and add your API key!"
    echo "   Either ANTHROPIC_API_KEY or OPENAI_API_KEY is required."
    echo ""
fi

echo "🔧 Starting backend on http://localhost:8002"
uvicorn app.main:app --reload --port 8002 &
BACKEND_PID=$!

# ── Frontend ──────────────────────────────────────────────────
cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

echo "🎨 Starting frontend on http://localhost:5175"
npm run dev &
FRONTEND_PID=$!

# ── Ready ─────────────────────────────────────────────────────
echo ""
echo "✅ Nexus is running!"
echo "   App:     http://localhost:5175"
echo "   API:     http://localhost:8002/docs"
echo ""
echo "   Press Ctrl+C to stop."
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '🛑 Stopped'; exit 0" INT TERM
wait

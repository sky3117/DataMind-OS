# DataMind OS 🧠

> AI-Powered Autonomous Data Intelligence Platform

Upload any CSV or Excel file and instantly get deep data profiling, AI-powered chat analysis using Claude, and auto-generated dashboards — all in a beautiful dark-themed UI.

---

## Features

| Feature | Description |
|---|---|
| 📤 **File Upload** | Drag & drop CSV/XLSX/XLS files up to 50MB |
| 📊 **Data Profiling** | Row counts, column types, null analysis, outlier detection, health score |
| 💬 **AI Chat** | Ask natural language questions about your data — powered by Claude |
| 📈 **Auto Dashboard** | Bar, pie, and line charts auto-generated from your data |

---

## Tech Stack

- **Frontend**: Next.js 14 · TypeScript · Tailwind CSS (dark theme) · Recharts
- **Backend**: Python FastAPI · Pandas · DuckDB
- **AI**: Anthropic Claude (`claude-sonnet-4-20250514`)
- **Database**: PostgreSQL · Redis
- **Infrastructure**: Docker Compose

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone & configure

```bash
git clone https://github.com/sky3117/DataMind-OS.git
cd DataMind-OS
cp .env.example .env
```

Edit `.env` and set your `ANTHROPIC_API_KEY`.

### 2. Start with Docker Compose

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy and configure environment
cp ../.env.example .env

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Set the API URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

Open http://localhost:3000

---

## Project Structure

```
datamind-os/
├── frontend/                  # Next.js 14 app
│   ├── src/
│   │   ├── app/               # App router (layout, page)
│   │   ├── components/        # React components
│   │   │   ├── FileUploader.tsx
│   │   │   ├── DataProfile.tsx
│   │   │   ├── ChatInterface.tsx
│   │   │   └── AutoDashboard.tsx
│   │   ├── lib/
│   │   │   └── api.ts         # API client
│   │   └── types/
│   │       └── index.ts       # TypeScript types
│   └── Dockerfile
├── backend/                   # FastAPI app
│   ├── app/
│   │   ├── main.py            # Application entry point
│   │   ├── config.py          # Configuration
│   │   └── routers/
│   │       ├── upload.py      # POST /api/upload
│   │       ├── profile.py     # GET /api/profile/{file_id}
│   │       ├── chat.py        # POST /api/chat (streaming SSE)
│   │       └── dashboard.py   # GET /api/dashboard/{file_id}
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload a CSV or Excel file |
| `GET` | `/api/profile/{file_id}` | Get comprehensive data profile |
| `POST` | `/api/chat` | Stream AI chat response (SSE) |
| `GET` | `/api/dashboard/{file_id}` | Get dashboard chart data |
| `GET` | `/health` | Health check |

Full interactive docs at http://localhost:8000/docs (Swagger UI).

---

## Environment Variables

See [`.env.example`](.env.example) for all variables.

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | *(required)* |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://datamind:datamind@localhost:5432/datamind` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `UPLOAD_DIR` | Local upload directory | `./uploads` |
| `MAX_FILE_SIZE_MB` | Maximum upload size in MB | `50` |
| `CORS_ORIGINS` | Allowed frontend origins | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Backend API URL for frontend | `http://localhost:8000` |

---

## License

MIT
# pipeline test

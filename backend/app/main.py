from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import upload, profile, chat, dashboard, pipeline, agents, collaboration
import os

app = FastAPI(
    title="DataMind OS API",
    description="AI-powered autonomous data intelligence platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(profile.router, prefix="/api", tags=["profile"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(pipeline.router, prefix="/api", tags=["pipeline"])
app.include_router(agents.router, prefix="/api", tags=["agents"])
app.include_router(collaboration.router, prefix="/api", tags=["collaboration"])

# Serve generated HTML reports as static files
REPORTS_DIR = os.getenv("REPORTS_DIR", "./reports")
os.makedirs(REPORTS_DIR, exist_ok=True)
app.mount("/reports", StaticFiles(directory=REPORTS_DIR), name="reports")


@app.get("/")
async def root():
    return {"message": "DataMind OS API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}

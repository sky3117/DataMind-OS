import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://datamind:datamind@localhost:5432/datamind")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls"}
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

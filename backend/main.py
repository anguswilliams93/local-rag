import sys
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time

from config import settings
from database.session import init_db
from api.agents import router as agents_router
from api.documents import router as documents_router
from api.chat import router as chat_router
from api.models import router as models_router
from api.conversations import router as conversations_router
from api.logs import router as logs_router
from api.settings import router as settings_router

# Create logs directory - triggers reload
logs_dir = Path(__file__).parent / "logs"
logs_dir.mkdir(exist_ok=True)

# Configure logging with file handler
log_format = "%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s"
date_format = "%Y-%m-%d %H:%M:%S"

# Root logger configuration
logging.basicConfig(
    level=logging.INFO,
    format=log_format,
    datefmt=date_format
)

# Add rotating file handler (10MB max, keep 5 backup files)
file_handler = RotatingFileHandler(
    logs_dir / "backend.log",
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=5,
    encoding="utf-8"
)
file_handler.setFormatter(logging.Formatter(log_format, datefmt=date_format))
file_handler.setLevel(logging.INFO)

# Add file handler to root logger
logging.getLogger().addHandler(file_handler)

logger = logging.getLogger("local-rag")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("🚀 Starting Local RAG Agent...")
    settings.ensure_directories()
    init_db()
    logger.info(f"📁 Data directory: {settings.data_dir.absolute()}")
    logger.info(f"🧠 Embedding model: {settings.embedding_model}")
    logger.info(f"🔗 OpenRouter configured: {'Yes' if settings.openrouter_api_key else 'No'}")
    logger.info(f"📊 Chunk size: {settings.chunk_size}, overlap: {settings.chunk_overlap}")
    logger.info(f"🔍 Top-K results: {settings.top_k_results}")

    yield

    # Shutdown
    logger.info("👋 Shutting down...")


app = FastAPI(
    title="Local RAG Agent API",
    description="A local-first multi-agent RAG system with OpenRouter integration",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",  # Docker internal networking
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests with timing."""
    start_time = time.time()

    # Log request
    logger.info(f"➡️  {request.method} {request.url.path}")

    response = await call_next(request)

    # Log response with timing
    duration = (time.time() - start_time) * 1000
    status_emoji = "✅" if response.status_code < 400 else "❌"
    logger.info(f"{status_emoji} {request.method} {request.url.path} → {response.status_code} ({duration:.1f}ms)")

    return response


# Include routers
app.include_router(agents_router)
app.include_router(documents_router)
app.include_router(chat_router)
app.include_router(models_router)
app.include_router(conversations_router)
app.include_router(logs_router)
app.include_router(settings_router)


@app.get("/")
def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "name": "Local RAG Agent API",
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "openrouter_configured": bool(settings.openrouter_api_key),
        "data_dir": str(settings.data_dir.absolute()),
        "embedding_model": settings.embedding_model
    }


@app.get("/models")
def list_models():
    """List commonly used OpenRouter models."""
    return {
        "models": [
            {"id": "openai/gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "provider": "OpenAI"},
            {"id": "openai/gpt-4-turbo", "name": "GPT-4 Turbo", "provider": "OpenAI"},
            {"id": "anthropic/claude-3-haiku", "name": "Claude 3 Haiku", "provider": "Anthropic"},
            {"id": "anthropic/claude-3-sonnet", "name": "Claude 3 Sonnet", "provider": "Anthropic"},
            {"id": "meta-llama/llama-3-8b-instruct", "name": "Llama 3 8B", "provider": "Meta"},
            {"id": "google/gemini-pro-1.5", "name": "Gemini Pro 1.5", "provider": "Google"}
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)

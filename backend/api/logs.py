import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

router = APIRouter(prefix="/logs", tags=["logs"])

# Set up frontend log file
logs_dir = Path(__file__).parent.parent / "logs"
logs_dir.mkdir(exist_ok=True)

frontend_logger = logging.getLogger("frontend")
frontend_handler = RotatingFileHandler(
    logs_dir / "frontend.log",
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=5,
    encoding="utf-8"
)
frontend_handler.setFormatter(
    logging.Formatter("%(asctime)s | %(levelname)-8s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
)
frontend_logger.addHandler(frontend_handler)
frontend_logger.setLevel(logging.INFO)


class FrontendLogEntry(BaseModel):
    timestamp: str
    level: str
    message: str
    data: Optional[Any] = None


@router.post("/frontend")
async def log_frontend(entry: FrontendLogEntry):
    """Receive and store frontend log entries."""
    level = entry.level.lower()
    data_str = f" | {entry.data}" if entry.data else ""
    log_message = f"[FRONTEND] {entry.message}{data_str}"

    if level == "error":
        frontend_logger.error(log_message)
    elif level == "warn":
        frontend_logger.warning(log_message)
    elif level == "debug":
        frontend_logger.debug(log_message)
    else:
        frontend_logger.info(log_message)

    return {"status": "logged"}

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from config import settings

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger("local-rag.settings")


class SettingsResponse(BaseModel):
    """Current application settings (read-only sensitive fields hidden)."""
    chunk_size: int
    chunk_overlap: int
    top_k_results: int
    embedding_model: str
    default_model: str
    openrouter_configured: bool
    google_api_configured: bool
    # Masked API keys (show last 4 chars if configured)
    openrouter_api_key_masked: str
    google_api_key_masked: str


class SettingsUpdate(BaseModel):
    """Settings that can be updated at runtime."""
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    top_k_results: Optional[int] = None
    openrouter_api_key: Optional[str] = None
    google_api_key: Optional[str] = None


def mask_api_key(key: str) -> str:
    """Mask API key, showing only last 4 characters."""
    if not key:
        return ""
    if len(key) <= 4:
        return "****"
    return f"{'*' * (len(key) - 4)}{key[-4:]}"


@router.get("", response_model=SettingsResponse)
async def get_settings():
    """Get current application settings."""
    return SettingsResponse(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        top_k_results=settings.top_k_results,
        embedding_model=settings.embedding_model,
        default_model="openai/gpt-4o-mini",
        openrouter_configured=bool(settings.openrouter_api_key),
        google_api_configured=bool(settings.google_api_key),
        openrouter_api_key_masked=mask_api_key(settings.openrouter_api_key),
        google_api_key_masked=mask_api_key(settings.google_api_key),
    )


@router.patch("", response_model=SettingsResponse)
async def update_settings(updates: SettingsUpdate):
    """
    Update application settings at runtime.
    Note: These changes are temporary and will reset on server restart.
    To persist changes, update the .env file.
    """
    try:
        if updates.chunk_size is not None:
            if updates.chunk_size < 100 or updates.chunk_size > 4000:
                raise HTTPException(status_code=400, detail="chunk_size must be between 100 and 4000")
            settings.chunk_size = updates.chunk_size
            logger.info(f"Updated chunk_size to {updates.chunk_size}")

        if updates.chunk_overlap is not None:
            if updates.chunk_overlap < 0 or updates.chunk_overlap >= settings.chunk_size:
                raise HTTPException(status_code=400, detail="chunk_overlap must be >= 0 and < chunk_size")
            settings.chunk_overlap = updates.chunk_overlap
            logger.info(f"Updated chunk_overlap to {updates.chunk_overlap}")

        if updates.top_k_results is not None:
            if updates.top_k_results < 1 or updates.top_k_results > 20:
                raise HTTPException(status_code=400, detail="top_k_results must be between 1 and 20")
            settings.top_k_results = updates.top_k_results
            logger.info(f"Updated top_k_results to {updates.top_k_results}")

        if updates.openrouter_api_key is not None:
            settings.openrouter_api_key = updates.openrouter_api_key
            logger.info("Updated OpenRouter API key")

        if updates.google_api_key is not None:
            settings.google_api_key = updates.google_api_key
            logger.info("Updated Google API key")

        return SettingsResponse(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            top_k_results=settings.top_k_results,
            embedding_model=settings.embedding_model,
            default_model="openai/gpt-4o-mini",
            openrouter_configured=bool(settings.openrouter_api_key),
            google_api_configured=bool(settings.google_api_key),
            openrouter_api_key_masked=mask_api_key(settings.openrouter_api_key),
            google_api_key_masked=mask_api_key(settings.google_api_key),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

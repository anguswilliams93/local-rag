"""API endpoints for OpenRouter models."""
import logging
from typing import Optional
import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from config import settings

logger = logging.getLogger("local-rag.models")
router = APIRouter(prefix="/models", tags=["models"])


class ModelPricing(BaseModel):
    prompt: Optional[str] = None
    completion: Optional[str] = None
    image: Optional[str] = None


class ModelArchitecture(BaseModel):
    modality: Optional[str] = None
    input_modalities: Optional[list[str]] = None
    output_modalities: Optional[list[str]] = None


class Model(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    context_length: Optional[int] = None
    pricing: Optional[ModelPricing] = None
    architecture: Optional[ModelArchitecture] = None


class ModelsResponse(BaseModel):
    models: list[Model]
    total: int


@router.get("", response_model=ModelsResponse)
async def list_models():
    """
    Fetch all available models from OpenRouter API.

    Returns a list of models with their IDs, names, pricing, and capabilities.
    """
    logger.info("🔍 Fetching models from OpenRouter API...")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                timeout=30.0
            )

            if response.status_code != 200:
                logger.error(f"❌ OpenRouter API error: {response.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"OpenRouter API error: {response.status_code}"
                )

            data = response.json()
            raw_models = data.get("data", [])

            # Filter to only supported, text-capable models
            models = []
            for m in raw_models:
                arch = m.get("architecture", {})
                output_modalities = arch.get("outputModalities", []) if arch else []

                # Skip models that are not supported (no providers available)
                # Models with "supported_parameters" usually indicates they're available
                # Also check if the model has any available providers
                per_request_limits = m.get("per_request_limits")

                # Only include models that:
                # 1. Output text (not just images)
                # 2. Have pricing (indicates they're actually available)
                # 3. Are not free-only models without availability
                pricing = m.get("pricing", {})
                has_pricing = pricing and (pricing.get("prompt") or pricing.get("completion"))

                if ("text" in output_modalities or not output_modalities) and has_pricing:
                    models.append(Model(
                        id=m.get("id", ""),
                        name=m.get("name", m.get("id", "Unknown")),
                        description=m.get("description"),
                        context_length=m.get("context_length") or m.get("contextLength"),
                        pricing=ModelPricing(
                            prompt=pricing.get("prompt"),
                            completion=pricing.get("completion"),
                            image=pricing.get("image"),
                        ) if pricing else None,
                        architecture=ModelArchitecture(
                            modality=arch.get("modality"),
                            input_modalities=arch.get("inputModalities"),
                            output_modalities=arch.get("outputModalities"),
                        ) if arch else None,
                    ))

            logger.info(f"✅ Fetched {len(models)} text models from OpenRouter")
            return ModelsResponse(models=models, total=len(models))

    except httpx.RequestError as e:
        logger.error(f"❌ Network error fetching models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to OpenRouter API: {str(e)}"
        )
    except Exception as e:
        logger.error(f"❌ Error fetching models: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching models: {str(e)}"
        )

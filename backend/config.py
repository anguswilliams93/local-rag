from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # API Keys
    openrouter_api_key: str = ""
    google_api_key: str = ""

    # Data storage
    data_dir: Path = Path("./data")

    # Embedding model (Google text-embedding-004 based on Gemma)
    embedding_model: str = "models/text-embedding-004"

    # Chunking settings
    chunk_size: int = 512
    chunk_overlap: int = 50

    # RAG settings
    top_k_results: int = 5

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000

    @property
    def database_path(self) -> Path:
        return self.data_dir / "local-rag.db"

    @property
    def chroma_path(self) -> Path:
        return self.data_dir / "chroma"

    @property
    def agents_path(self) -> Path:
        return self.data_dir / "agents"

    def ensure_directories(self) -> None:
        """Create necessary data directories if they don't exist."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.chroma_path.mkdir(parents=True, exist_ok=True)
        self.agents_path.mkdir(parents=True, exist_ok=True)


settings = Settings()

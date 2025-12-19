import hashlib
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from config import settings


class FileStorage(ABC):
    """Abstract interface for file storage - enables swapping local/cloud implementations."""

    @abstractmethod
    def store(self, agent_id: str, filename: str, content: bytes) -> tuple[str, str, str]:
        """
        Store a file for an agent.

        Returns:
            Tuple of (stored_filename, relative_file_path, content_hash)
        """
        pass

    @abstractmethod
    def retrieve(self, file_path: str) -> bytes:
        """Retrieve file contents by path."""
        pass

    @abstractmethod
    def get_absolute_path(self, file_path: str) -> Path:
        """Get absolute path for document processing."""
        pass

    @abstractmethod
    def delete(self, file_path: str) -> bool:
        """Delete a file. Returns True if successful."""
        pass

    @abstractmethod
    def delete_agent_files(self, agent_id: str) -> bool:
        """Delete all files for an agent. Returns True if successful."""
        pass


class LocalFileStorage(FileStorage):
    """Local filesystem implementation of file storage."""

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or settings.agents_path

    def _get_content_hash(self, content: bytes) -> str:
        """Generate SHA-256 hash of file content."""
        return hashlib.sha256(content).hexdigest()

    def _get_agent_dir(self, agent_id: str) -> Path:
        """Get the directory for an agent's files."""
        return self.base_path / agent_id / "files"

    def store(self, agent_id: str, filename: str, content: bytes) -> tuple[str, str, str]:
        """
        Store a file with content-based deduplication.
        """
        content_hash = self._get_content_hash(content)
        agent_dir = self._get_agent_dir(agent_id)
        agent_dir.mkdir(parents=True, exist_ok=True)

        # Use hash as filename to avoid duplicates, but keep extension
        ext = Path(filename).suffix
        stored_filename = f"{content_hash}{ext}"
        file_path = agent_dir / stored_filename

        # Relative path for database storage
        relative_path = str(file_path.relative_to(self.base_path))

        if not file_path.exists():
            file_path.write_bytes(content)

        return stored_filename, relative_path, content_hash

    def retrieve(self, file_path: str) -> bytes:
        """Retrieve file contents by path."""
        abs_path = self.get_absolute_path(file_path)
        if not abs_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        return abs_path.read_bytes()

    def get_absolute_path(self, file_path: str) -> Path:
        """Get absolute path for document processing."""
        return self.base_path / file_path

    def delete(self, file_path: str) -> bool:
        """Delete a file. Returns True if successful."""
        abs_path = self.get_absolute_path(file_path)
        if abs_path.exists():
            abs_path.unlink()
            return True
        return False

    def delete_agent_files(self, agent_id: str) -> bool:
        """Delete all files for an agent. Returns True if successful."""
        agent_dir = self.base_path / agent_id
        if agent_dir.exists():
            shutil.rmtree(agent_dir)
            return True
        return False


# Singleton instance
file_storage = LocalFileStorage()

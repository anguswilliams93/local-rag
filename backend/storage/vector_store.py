import logging
import pickle
import numpy as np
import faiss
import google.generativeai as genai
from pathlib import Path
from typing import Optional

from config import settings

logger = logging.getLogger("local-rag.vectorstore")


class VectorStore:
    """FAISS-based vector store with per-agent indexes using Google Gemma embeddings."""

    _instance: Optional["VectorStore"] = None
    _initialized: bool = False

    # Google text-embedding-004 outputs 768-dimensional vectors
    EMBEDDING_DIM = 768

    def __new__(cls) -> "VectorStore":
        """Singleton pattern to reuse embedding client."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        settings.ensure_directories()

        # Configure Google Generative AI
        if settings.google_api_key:
            genai.configure(api_key=settings.google_api_key)

        self._embedding_model = settings.embedding_model
        self._embedding_dim = self.EMBEDDING_DIM

        # Cache for loaded indexes
        self._indexes: dict[str, faiss.IndexFlatL2] = {}
        self._metadata: dict[str, list[dict]] = {}
        self._documents: dict[str, list[str]] = {}

        self._initialized = True

    def _get_agent_path(self, agent_id: str) -> Path:
        """Get the storage path for an agent's vector store."""
        return settings.chroma_path / agent_id

    def _load_index(self, agent_id: str) -> tuple[faiss.IndexFlatL2, list[str], list[dict]]:
        """Load or create an index for an agent."""
        if agent_id in self._indexes:
            return self._indexes[agent_id], self._documents[agent_id], self._metadata[agent_id]

        agent_path = self._get_agent_path(agent_id)
        index_file = agent_path / "index.faiss"
        data_file = agent_path / "data.pkl"

        if index_file.exists() and data_file.exists():
            # Load existing index
            index = faiss.read_index(str(index_file))
            with open(data_file, "rb") as f:
                data = pickle.load(f)
            documents = data.get("documents", [])
            metadata = data.get("metadata", [])
        else:
            # Create new index
            index = faiss.IndexFlatL2(self._embedding_dim)
            documents = []
            metadata = []

        self._indexes[agent_id] = index
        self._documents[agent_id] = documents
        self._metadata[agent_id] = metadata

        return index, documents, metadata

    def _save_index(self, agent_id: str):
        """Save an agent's index to disk."""
        agent_path = self._get_agent_path(agent_id)
        agent_path.mkdir(parents=True, exist_ok=True)

        index = self._indexes.get(agent_id)
        if index is None:
            return

        faiss.write_index(index, str(agent_path / "index.faiss"))
        with open(agent_path / "data.pkl", "wb") as f:
            pickle.dump({
                "documents": self._documents.get(agent_id, []),
                "metadata": self._metadata.get(agent_id, [])
            }, f)

    def _embed_texts(self, texts: list[str]) -> np.ndarray:
        """Generate embeddings for texts using Google Gemma embeddings."""
        if not settings.google_api_key:
            logger.warning("⚠️  No Google API key - using random embeddings for testing")
            return np.random.rand(len(texts), self._embedding_dim).astype('float32')

        logger.info(f"🧠 Generating embeddings for {len(texts)} text chunks...")
        embeddings = []
        # Process in batches of 100 (API limit)
        batch_size = 100
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            logger.debug(f"   Processing batch {i//batch_size + 1}/{(len(texts)-1)//batch_size + 1}")
            try:
                result = genai.embed_content(
                    model=self._embedding_model,
                    content=batch,
                    task_type="retrieval_document"
                )
                embeddings.extend(result['embedding'])
                logger.info(f"✅ Batch {i//batch_size + 1}: embedded {len(batch)} texts")
            except Exception as e:
                logger.error(f"❌ Embedding API error: {str(e)}")
                raise

        logger.info(f"✅ Generated {len(embeddings)} embeddings (dim={self._embedding_dim})")
        return np.array(embeddings).astype('float32')

    def add_documents(self, agent_id: str, texts: list[str], metadatas: list[dict]):
        """Add documents to an agent's index."""
        logger.info(f"📚 Adding {len(texts)} documents to agent={agent_id}")
        index, documents, metadata = self._load_index(agent_id)

        if not texts:
            logger.warning("No texts to add")
            return

        embeddings = self._embed_texts(texts)
        index.add(embeddings)

        documents.extend(texts)
        metadata.extend(metadatas)

        self._save_index(agent_id)
        logger.info(f"✅ Index saved: total vectors = {index.ntotal}")

    def query(self, agent_id: str, query_text: str, top_k: Optional[int] = None) -> list[dict]:
        """Query an agent's index."""
        logger.info(f"🔍 Query: agent={agent_id}, text='{query_text[:50]}...'")
        index, documents, metadata = self._load_index(agent_id)

        if index.ntotal == 0:
            logger.warning("Index is empty - no documents to search")
            return []

        top_k = top_k or settings.top_k_results
        top_k = min(top_k, index.ntotal)
        logger.info(f"   Searching {index.ntotal} vectors (top_k={top_k})")

        # Embed query
        if settings.google_api_key:
            logger.debug("   Generating query embedding...")
            query_embedding = genai.embed_content(
                model=self._embedding_model,
                content=query_text,
                task_type="retrieval_query"
            )['embedding']
        else:
            query_embedding = np.random.rand(self._embedding_dim)

        query_embedding = np.array([query_embedding]).astype('float32')

        # Search
        distances, indices = index.search(query_embedding, top_k)
        logger.info(f"✅ Found {len([i for i in indices[0] if i != -1])} results")

        results = []
        for i, idx in enumerate(indices[0]):
            if idx == -1: continue
            results.append({
                "text": documents[idx],
                "metadata": metadata[idx],
                "score": float(distances[0][i])
            })
            logger.debug(f"   Result {i+1}: score={distances[0][i]:.4f}, source={metadata[idx].get('source', 'unknown')}")

        return results

    def get_collection_stats(self, agent_id: str) -> dict:
        """Get stats for an agent's collection."""
        index, _, _ = self._load_index(agent_id)
        return {
            "total_chunks": index.ntotal
        }

    def get_or_create_collection(self, agent_id: str):
        """Ensure an index exists for an agent."""
        self._load_index(agent_id)

    def delete_collection(self, agent_id: str):
        """Delete an agent's index."""
        agent_path = self._get_agent_path(agent_id)
        if agent_path.exists():
            import shutil
            shutil.rmtree(agent_path)

        if agent_id in self._indexes:
            del self._indexes[agent_id]
            del self._documents[agent_id]
            del self._metadata[agent_id]


# Singleton instance
vector_store = VectorStore()

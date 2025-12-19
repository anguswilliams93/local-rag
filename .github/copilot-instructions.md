# Local RAG Agent - AI Coding Instructions

## Architecture Overview

This is a **local-first multi-agent RAG (Retrieval-Augmented Generation) system** with a Python FastAPI backend and Next.js frontend. Each "agent" maintains its own isolated document collection and vector store.

```
┌─────────────────┐     ┌──────────────────────────────────────────────────┐
│  Next.js 16     │────▶│  FastAPI Backend (port 8000)                     │
│  (port 3000)    │     │  ┌──────────────────────────────────────────────┐│
│                 │     │  │ /agents/* → CRUD operations                  ││
│  TanStack Query │     │  │ /agents/{id}/documents/* → file upload       ││
│  + Axios        │     │  │ /agents/{id}/chat[/stream] → RAG queries     ││
└─────────────────┘     │  └──────────────────────────────────────────────┘│
                        │         ↓                  ↓                      │
                        │  ┌──────────────┐  ┌───────────────────┐          │
                        │  │ SQLite DB    │  │ FAISS VectorStore │          │
                        │  │ (metadata)   │  │ (per-agent index) │          │
                        │  └──────────────┘  └───────────────────┘          │
                        └──────────────────────────────────────────────────┘
```

## Key Data Flows

1. **Document ingestion**: Upload → `DocumentProcessor` extracts text (PDF/DOCX/CSV/Excel/TXT) → chunks via LangChain `RecursiveCharacterTextSplitter` → embeddings via Google `text-embedding-004` → stored in per-agent FAISS index
2. **RAG query**: Query → vector search retrieves top-k chunks → context injected into system prompt → streamed via OpenRouter (OpenAI-compatible API)

## Development Commands

### Quick Start (Recommended)
```powershell
# From project root - starts both servers in separate windows
.\start-dev.ps1

# Or double-click start-dev.bat from Explorer
```

### Manual Start
```bash
# Backend (from /backend)
uv pip install -r requirements.txt     # Or: uv sync (if using pyproject.toml)
.venv\Scripts\Activate.ps1             # Activate virtual environment
uvicorn main:app --reload              # Starts on :8000

# Frontend (from /frontend)
npm install
npm run dev                            # Starts on :3000
```

**Required environment variables** in `backend/.env`:
- `OPENROUTER_API_KEY` - for LLM inference
- `GOOGLE_API_KEY` - for embeddings (text-embedding-004)

## Project Conventions

### Backend Patterns
- **Singleton services**: `vector_store` and `file_storage` are singletons (see `VectorStore.__new__`)
- **Pydantic schemas**: All API request/response models in [backend/api/schemas.py](backend/api/schemas.py)
- **Settings via pydantic-settings**: Config loaded from `.env` in [backend/config.py](backend/config.py)
- **Router pattern**: Each API module exports a `router` re-exported through `backend/api/__init__.py`

### Frontend Patterns
- **UI components**: shadcn/ui primitives in `frontend/src/components/ui/`
- CLI cmd for installation: `npx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=nova&baseColor=neutral&theme=amber&iconLibrary=phosphor&font=jetbrains-mono&menuAccent=bold&menuColor=default&radius=small&template=next" --template next`
- **API layer**: Typed axios client in [frontend/src/lib/api.ts](frontend/src/lib/api.ts) - update types here when backend schemas change
- **State management**: TanStack Query with query keys like `["agents"]`, `["documents", agentId]`
- **Streaming**: SSE parsing in `chatApi.stream()` handles `data:`, `sources:`, `done:` events

### File Organization
- Per-agent isolation: documents stored at `data/agents/{agent_id}/files/`, vectors at `data/chroma/{agent_id}/`
- Content-addressed storage: files named by SHA-256 hash for deduplication

## When Modifying Code

1. **Adding new document types**: Extend `DocumentProcessor.SUPPORTED_EXTENSIONS` and add extraction method
2. **Changing chunk settings**: Update `config.py` defaults (`chunk_size=512`, `chunk_overlap=50`)
3. **Adding API endpoints**: Create route in `backend/api/`, add to `__init__.py`, update frontend `api.ts`
4. **Modifying Agent/Document models**: Update [backend/database/models.py](backend/database/models.py) - SQLite auto-migrates on restart

## Common Pitfalls

- Backend imports require `sys.path` manipulation in `main.py` - don't restructure without updating
- VectorStore uses 768-dim embeddings (Google text-embedding-004) - changing models requires index rebuild
- CORS configured only for `localhost:3000` - update `main.py` for other origins
- Ensure you use context7 for all modules to avoid old documentation references.

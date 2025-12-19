# 🍝 Ragooo

A local-first multi-agent RAG (Retrieval-Augmented Generation) system. Upload documents, create AI agents, and chat with your knowledge base.

*A delicious blend of RAG and ragù.*

## ✨ Features

- **Multi-Agent Architecture** - Create multiple AI agents, each with their own document collection and vector store
- **Document Processing** - Upload PDF, DOCX, CSV, Excel, TXT, and Markdown files
- **Vector Search** - FAISS-powered semantic search with Google's text-embedding-004
- **Streaming Responses** - Real-time SSE streaming from OpenRouter LLMs
- **Conversation History** - Persistent chat history with context awareness
- **Model Selection** - Choose from various models via OpenRouter (GPT-4, Claude, Llama, etc.)
- **Local-First** - All data stored locally, no external dependencies for storage

## 🏗️ Architecture

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

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- [OpenRouter API Key](https://openrouter.ai/)
- [Google AI API Key](https://aistudio.google.com/apikey) (for embeddings)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ragooo.git
   cd ragooo
   ```

2. **Configure environment variables**
   ```bash
   cp backend/.env.example backend/.env
   ```
   Edit `backend/.env`:
   ```env
   OPENROUTER_API_KEY=your_openrouter_key
   GOOGLE_API_KEY=your_google_api_key
   ```

3. **Start development servers**
   
   **Windows (PowerShell):**
   ```powershell
   .\start-dev.ps1
   ```
   
   **Or manually:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   python -m venv .venv
   .venv\Scripts\Activate.ps1  # Windows
   # source .venv/bin/activate  # Linux/Mac
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000

   # Terminal 2 - Frontend
   cd frontend
   npm install
   npm run dev
   ```

4. **Open the app**
   - Frontend: http://localhost:3000
   - API Docs: http://localhost:8000/docs

## 📁 Project Structure

```
ragooo/
├── backend/
│   ├── api/                 # FastAPI routes
│   │   ├── agents.py        # Agent CRUD
│   │   ├── chat.py          # Chat & streaming
│   │   ├── documents.py     # File upload & processing
│   │   └── conversations.py # Chat history
│   ├── database/            # SQLite models & session
│   ├── services/
│   │   ├── document_processor.py  # Text extraction
│   │   └── rag_service.py         # RAG query logic
│   ├── storage/
│   │   ├── file_storage.py  # Content-addressed file storage
│   │   └── vector_store.py  # FAISS wrapper
│   ├── config.py            # Settings via pydantic-settings
│   └── main.py              # FastAPI app entry
│
├── frontend/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── chat-interface.tsx
│   │   └── ...
│   └── lib/
│       ├── api.ts           # Typed API client
│       └── logger.ts        # Frontend logging
│
├── start-dev.ps1            # Windows dev server launcher
└── start-dev.bat            # Alternative Windows launcher
```

## 🔧 Configuration

### Backend Settings (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM inference | Required |
| `GOOGLE_API_KEY` | Google AI API key for embeddings | Required |
| `CHUNK_SIZE` | Document chunk size in characters | 512 |
| `CHUNK_OVERLAP` | Overlap between chunks | 50 |
| `TOP_K_RESULTS` | Number of context chunks to retrieve | 5 |
| `DEFAULT_MODEL` | Default LLM model | `x-ai/grok-3-fast` |

### Supported Document Types

- PDF (`.pdf`)
- Word Documents (`.docx`)
- Excel (`.xlsx`, `.xls`)
- CSV (`.csv`)
- Plain Text (`.txt`)
- Markdown (`.md`)

## 🎯 Usage

1. **Create an Agent** - Click "Create Agent" and configure name, description, and model
2. **Upload Documents** - Go to "Manage Documents" and upload your files
3. **Chat** - Ask questions about your documents in the chat interface
4. **Manage Conversations** - View chat history in the sidebar

## 🛠️ Development

### Adding New Document Types

1. Add extension to `DocumentProcessor.SUPPORTED_EXTENSIONS`
2. Implement extraction method in `document_processor.py`

### Adding API Endpoints

1. Create route in `backend/api/`
2. Add router to `backend/api/__init__.py`
3. Update frontend `lib/api.ts` with types and functions

### Logs

- Backend logs: `backend/logs/backend.log`
- Frontend errors: `backend/logs/frontend.log`
- Console: `window.ragooLogger` in browser DevTools

## 📝 License

MIT

## 🙏 Acknowledgments

- [OpenRouter](https://openrouter.ai/) - LLM API gateway
- [Google AI](https://ai.google.dev/) - Embeddings API
- [LangChain](https://langchain.com/) - Document processing
- [FAISS](https://github.com/facebookresearch/faiss) - Vector search
- [shadcn/ui](https://ui.shadcn.com/) - UI components

# Local RAG Agent - Development Plan

## Phase 1: Environment Setup
- [ ] Create Python virtual environment: `uv venv`
- [ ] Install backend dependencies: `uv pip install -r requirements.txt`
- [ ] Configure `.env` in `/backend` with `OPENROUTER_API_KEY` and `GOOGLE_API_KEY`
- [ ] Install frontend dependencies: `npm install`

## Phase 2: Backend Implementation
- [ ] **Database**: Verify `models.py` and `session.py` for SQLite setup
- [ ] **Storage**: Complete `file_storage.py` (local) and `vector_store.py` (FAISS)
- [ ] **Services**: 
    - [ ] `document_processor.py`: Implement PDF, DOCX, CSV, Excel, TXT extraction
    - [ ] `rag_service.py`: Implement context retrieval and OpenRouter streaming
- [ ] **API**:
    - [ ] `agents.py`: CRUD endpoints
    - [ ] `documents.py`: Upload and processing status
    - [ ] `chat.py`: Query and SSE streaming endpoints
    - [ ] `schemas.py`: Pydantic validation models

## Phase 3: Frontend Implementation
- [ ] **API Client**: Complete `lib/api.ts` with Axios and SSE streaming
- [ ] **Components**:
    - [ ] `AgentCard`: Display agent info and stats
    - [ ] `CreateAgentDialog`: Form for new agents
    - [ ] `DocumentList`: Manage uploaded files
    - [ ] `FileUpload`: Drag-and-drop with progress
    - [ ] `ChatInterface`: Streaming chat with source citations
- [ ] **Pages**:
    - [ ] Home: Agent dashboard
    - [ ] Documents: Per-agent file management
    - [ ] Chat: Per-agent RAG interface

## Phase 4: Testing & Refinement
- [ ] Verify end-to-end document ingestion
- [ ] Test RAG accuracy and source attribution
- [ ] Ensure proper error handling for API failures
- [ ] Optimize frontend performance (TanStack Query caching)

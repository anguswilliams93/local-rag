import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db, Agent, Document
from storage.file_storage import file_storage
from services.document_processor import document_processor
from .schemas import DocumentResponse, DocumentListResponse

logger = logging.getLogger("local-rag.documents")
router = APIRouter(prefix="/agents/{agent_id}/documents", tags=["documents"])


def get_agent_or_404(agent_id: str, db: Session) -> Agent:
    """Get agent by ID or raise 404."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with id '{agent_id}' not found"
        )
    return agent


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    agent_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload and process a document for an agent."""
    logger.info(f"📄 Upload request: agent={agent_id}, file='{file.filename}'")
    agent = get_agent_or_404(agent_id, db)

    if not document_processor.is_supported(file.filename):
        logger.warning(f"❌ Unsupported file type: {file.filename}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not supported: {file.filename}"
        )

    content = await file.read()
    file_size_kb = len(content) / 1024
    logger.info(f"📦 File received: {file_size_kb:.1f} KB")

    stored_filename, relative_path, content_hash = file_storage.store(
        agent_id=agent_id,
        filename=file.filename,
        content=content
    )
    logger.info(f"💾 File stored: hash={content_hash[:16]}...")

    # Check if document already exists for this agent
    existing_doc = db.query(Document).filter(
        Document.agent_id == agent_id,
        Document.content_hash == content_hash
    ).first()

    if existing_doc:
        logger.info(f"⚠️  Document already exists: id={existing_doc.id}")
        return existing_doc

    # Create document record
    doc = Document(
        agent_id=agent_id,
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_path=relative_path,
        content_hash=content_hash,
        file_type=document_processor.get_file_type(file.filename),
        file_size=len(content),
        status="processing"
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)
    logger.info(f"📝 Document record created: id={doc.id}, status=processing")

    try:
        # Process document
        logger.info(f"⚙️  Processing document: extracting text and generating embeddings...")
        abs_path = file_storage.get_absolute_path(relative_path)
        chunk_count = document_processor.process_document(
            agent_id=agent_id,
            file_path=abs_path,
            original_filename=file.filename
        )

        doc.status = "completed"
        doc.chunk_count = chunk_count
        db.commit()
        logger.info(f"✅ Document processed: chunks={chunk_count}")
    except Exception as e:
        logger.error(f"❌ Document processing failed: {str(e)}")
        doc.status = "failed"
        doc.error_message = str(e)
        db.commit()

    return doc


@router.get("", response_model=DocumentListResponse)
def list_documents(agent_id: str, db: Session = Depends(get_db)):
    """List all documents for an agent."""
    agent = get_agent_or_404(agent_id, db)
    docs = db.query(Document).filter(Document.agent_id == agent_id).all()

    return DocumentListResponse(
        documents=docs,
        total=len(docs)
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(agent_id: str, document_id: str, db: Session = Depends(get_db)):
    """Delete a document."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.agent_id == agent_id
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Note: In a real app, we'd also need to remove chunks from FAISS
    # For now, we just delete the file and the DB record
    file_storage.delete(doc.file_path)

    db.delete(doc)
    db.commit()
    return None

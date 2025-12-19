"""API endpoints for conversation history."""
import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db, Agent, Conversation, Message
from .schemas import (
    ConversationCreate,
    ConversationResponse,
    ConversationListResponse,
    MessageCreate,
    MessageResponse,
)

logger = logging.getLogger("local-rag.conversations")
router = APIRouter(prefix="/agents/{agent_id}/conversations", tags=["conversations"])


def get_agent_or_404(agent_id: str, db: Session) -> Agent:
    """Get agent by ID or raise 404."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with id '{agent_id}' not found"
        )
    return agent


def get_conversation_or_404(conversation_id: str, agent_id: str, db: Session) -> Conversation:
    """Get conversation by ID or raise 404."""
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.agent_id == agent_id
    ).first()
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{conversation_id}' not found"
        )
    return conversation


@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    agent_id: str,
    db: Session = Depends(get_db)
):
    """List all conversations for an agent, ordered by most recent first."""
    get_agent_or_404(agent_id, db)

    conversations = db.query(Conversation).filter(
        Conversation.agent_id == agent_id
    ).order_by(Conversation.updated_at.desc()).all()

    result = []
    for conv in conversations:
        message_count = len(conv.messages)
        # Get preview from last user message
        preview = None
        for msg in reversed(conv.messages):
            if msg.role == "user":
                preview = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
                break

        result.append(ConversationResponse(
            id=conv.id,
            agent_id=conv.agent_id,
            title=conv.title,
            preview=preview,
            message_count=message_count,
            created_at=conv.created_at.isoformat(),
            updated_at=conv.updated_at.isoformat(),
        ))

    logger.info(f"📋 Listed {len(result)} conversations for agent {agent_id}")
    return ConversationListResponse(conversations=result, total=len(result))


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    agent_id: str,
    request: ConversationCreate,
    db: Session = Depends(get_db)
):
    """Create a new conversation."""
    get_agent_or_404(agent_id, db)

    conversation = Conversation(
        agent_id=agent_id,
        title=request.title,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    logger.info(f"💬 Created conversation {conversation.id} for agent {agent_id}")

    return ConversationResponse(
        id=conversation.id,
        agent_id=conversation.agent_id,
        title=conversation.title,
        preview=None,
        message_count=0,
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat(),
    )


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    agent_id: str,
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific conversation with all messages."""
    conversation = get_conversation_or_404(conversation_id, agent_id, db)

    messages = []
    for msg in conversation.messages:
        sources = None
        if msg.sources:
            try:
                sources = json.loads(msg.sources)
            except:
                pass
        messages.append(MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            role=msg.role,
            content=msg.content,
            sources=sources,
            created_at=msg.created_at.isoformat(),
        ))

    preview = None
    for msg in reversed(conversation.messages):
        if msg.role == "user":
            preview = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
            break

    return ConversationResponse(
        id=conversation.id,
        agent_id=conversation.agent_id,
        title=conversation.title,
        preview=preview,
        message_count=len(messages),
        messages=messages,
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat(),
    )


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    agent_id: str,
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Delete a conversation and all its messages."""
    conversation = get_conversation_or_404(conversation_id, agent_id, db)

    db.delete(conversation)
    db.commit()

    logger.info(f"🗑️ Deleted conversation {conversation_id}")


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    agent_id: str,
    conversation_id: str,
    request: ConversationCreate,
    db: Session = Depends(get_db)
):
    """Update conversation title."""
    conversation = get_conversation_or_404(conversation_id, agent_id, db)

    if request.title is not None:
        conversation.title = request.title

    db.commit()
    db.refresh(conversation)

    return ConversationResponse(
        id=conversation.id,
        agent_id=conversation.agent_id,
        title=conversation.title,
        preview=None,
        message_count=len(conversation.messages),
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat(),
    )


@router.post("/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def add_message(
    agent_id: str,
    conversation_id: str,
    request: MessageCreate,
    db: Session = Depends(get_db)
):
    """Add a message to a conversation (used internally to save messages)."""
    conversation = get_conversation_or_404(conversation_id, agent_id, db)

    sources_json = None
    if request.sources:
        sources_json = json.dumps(request.sources)

    message = Message(
        conversation_id=conversation_id,
        role=request.role,
        content=request.content,
        sources=sources_json,
    )
    db.add(message)

    # Auto-generate title from first user message if not set
    if not conversation.title and request.role == "user":
        # Use first 50 chars of first message as title
        conversation.title = request.content[:50] + ("..." if len(request.content) > 50 else "")

    db.commit()
    db.refresh(message)
    db.refresh(conversation)

    sources = None
    if message.sources:
        try:
            sources = json.loads(message.sources)
        except:
            pass

    return MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        role=message.role,
        content=message.content,
        sources=sources,
        created_at=message.created_at.isoformat(),
    )

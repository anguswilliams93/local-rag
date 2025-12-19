import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db, Agent, Conversation, Message
from services.rag_service import rag_service
from .schemas import ChatRequest, ChatResponse

logger = logging.getLogger("local-rag.chat")
router = APIRouter(prefix="/agents/{agent_id}/chat", tags=["chat"])


def get_agent_or_404(agent_id: str, db: Session) -> Agent:
    """Get agent by ID or raise 404."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with id '{agent_id}' not found"
        )
    return agent


@router.post("", response_model=ChatResponse)
async def chat(
    agent_id: str,
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Send a message to an agent and get a response.

    The agent will search its knowledge base for relevant context
    and generate a response using the configured LLM model.
    """
    agent = get_agent_or_404(agent_id, db)
    logger.info(f"💬 Chat request: agent={agent.name}, query='{request.query[:50]}...'")

    # If conversation_id provided, load history from database
    chat_history = None
    conversation = None

    if request.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == request.conversation_id,
            Conversation.agent_id == agent_id
        ).first()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation '{request.conversation_id}' not found"
            )
        # Load message history from conversation
        messages = db.query(Message).filter(
            Message.conversation_id == conversation.id
        ).order_by(Message.created_at).all()
        if messages:
            chat_history = [
                {"role": msg.role, "content": msg.content}
                for msg in messages
            ]
            logger.info(f"📜 Loaded {len(chat_history)} messages from conversation")
    elif request.chat_history:
        # Use provided chat history (backward compatibility)
        chat_history = [
            {"role": msg.role, "content": msg.content}
            for msg in request.chat_history
        ]
        logger.info(f"📜 Chat history: {len(chat_history)} messages")

    try:
        logger.info(f"🔍 Retrieving context (top_k={request.top_k or 'default'})...")
        result = await rag_service.query_with_sources(
            agent_id=agent_id,
            query=request.query,
            model=agent.model,
            system_prompt=agent.system_prompt,
            chat_history=chat_history,
            top_k=request.top_k
        )

        logger.info(f"✅ Response generated: {len(result['response'])} chars, sources={len(result['sources'])}")

        # Save messages to conversation if conversation_id was provided
        if conversation:
            # Save user message
            user_message = Message(
                conversation_id=conversation.id,
                role="user",
                content=request.query
            )
            db.add(user_message)

            # Save assistant message with sources (serialize to JSON)
            assistant_message = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=result["response"],
                sources=json.dumps(result["sources"]) if result["sources"] else None
            )
            db.add(assistant_message)
            db.commit()
            logger.info(f"💾 Saved messages to conversation {conversation.id}")

        return ChatResponse(
            response=result["response"],
            sources=result["sources"],
            context_used=result["context_used"]
        )
    except ValueError as e:
        logger.error(f"❌ ValueError: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"❌ Chat error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating response: {str(e)}"
        )


@router.post("/stream")
async def chat_stream(
    agent_id: str,
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Stream a response from an agent.

    Returns Server-Sent Events (SSE) with the response chunks.
    """
    agent = get_agent_or_404(agent_id, db)
    logger.info(f"💬 Stream chat: agent={agent.name}, query='{request.query[:50]}...'")

    # If conversation_id provided, load history from database
    chat_history = None
    conversation_id = None

    if request.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == request.conversation_id,
            Conversation.agent_id == agent_id
        ).first()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation '{request.conversation_id}' not found"
            )
        conversation_id = conversation.id
        # Load message history from conversation
        messages = db.query(Message).filter(
            Message.conversation_id == conversation.id
        ).order_by(Message.created_at).all()
        if messages:
            chat_history = [
                {"role": msg.role, "content": msg.content}
                for msg in messages
            ]
            logger.info(f"📜 Loaded {len(chat_history)} messages from conversation")
    elif request.chat_history:
        chat_history = [
            {"role": msg.role, "content": msg.content}
            for msg in request.chat_history
        ]

    # Store values we need in the generator
    query_text = request.query
    model = agent.model
    system_prompt = agent.system_prompt
    top_k = request.top_k

    async def stream_with_save():
        """Wrap the stream to save messages after completion."""
        from database.session import SessionLocal

        full_response = ""
        sources = []

        async for chunk in rag_service.query_stream(
            agent_id=agent_id,
            query=query_text,
            model=model,
            system_prompt=system_prompt,
            chat_history=chat_history,
            top_k=top_k
        ):
            yield chunk

            # Parse the chunk to collect full response and sources
            if chunk.startswith("data: "):
                # Remove the "data: " prefix and trailing newlines
                content = chunk[6:].rstrip('\n')
                full_response += content
            elif chunk.startswith("sources: "):
                try:
                    sources = json.loads(chunk[9:].rstrip('\n'))
                except Exception:
                    pass

        # Save to conversation after stream completes using a new session
        if conversation_id:
            save_db = SessionLocal()
            try:
                user_message = Message(
                    conversation_id=conversation_id,
                    role="user",
                    content=query_text
                )
                save_db.add(user_message)

                assistant_message = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=full_response,
                    sources=json.dumps(sources) if sources else None
                )
                save_db.add(assistant_message)
                save_db.commit()
                logger.info(f"💾 Saved streamed messages to conversation {conversation_id}")
            except Exception as e:
                logger.error(f"❌ Error saving messages: {e}")
                save_db.rollback()
            finally:
                save_db.close()

    return StreamingResponse(
        stream_with_save(),
        media_type="text/event-stream"
    )

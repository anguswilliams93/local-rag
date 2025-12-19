from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


# Agent Schemas
class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    model: str = Field(default="openai/gpt-3.5-turbo")
    system_prompt: Optional[str] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None


class AgentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    model: str
    system_prompt: Optional[str]
    created_at: datetime
    updated_at: datetime
    document_count: int = 0
    total_chunks: int = 0

    class Config:
        from_attributes = True


class AgentListResponse(BaseModel):
    agents: list[AgentResponse]
    total: int


# Document Schemas
class DocumentResponse(BaseModel):
    id: str
    agent_id: str
    original_filename: str
    file_type: str
    file_size: int
    status: str
    error_message: Optional[str]
    chunk_count: int
    created_at: datetime
    processed_at: Optional[datetime]

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


# Chat Schemas
class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    chat_history: Optional[list[ChatMessage]] = None
    conversation_id: Optional[str] = None  # If provided, save to this conversation
    top_k: Optional[int] = Field(None, ge=1, le=20)


class ChatResponse(BaseModel):
    response: str
    sources: list[dict]
    context_used: bool


# Conversation Schemas
class ConversationCreate(BaseModel):
    title: Optional[str] = None


class MessageCreate(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str
    sources: Optional[list[dict]] = None


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    sources: Optional[list[dict]] = None
    created_at: str


class ConversationResponse(BaseModel):
    id: str
    agent_id: str
    title: Optional[str]
    preview: Optional[str] = None
    message_count: int = 0
    messages: Optional[list[MessageResponse]] = None
    created_at: str
    updated_at: str


class ConversationListResponse(BaseModel):
    conversations: list[ConversationResponse]
    total: int

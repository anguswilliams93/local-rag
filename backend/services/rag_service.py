import logging
from typing import AsyncGenerator, Optional
from openai import AsyncOpenAI
import json

from config import settings
from storage.vector_store import vector_store

logger = logging.getLogger("local-rag.rag")


class RAGService:
    """RAG service using OpenRouter for LLM inference."""

    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self):
        self._client: Optional[AsyncOpenAI] = None

    @property
    def client(self) -> AsyncOpenAI:
        """Lazy initialization of OpenAI client configured for OpenRouter."""
        if self._client is None:
            if not settings.openrouter_api_key:
                # Fallback for development if key is missing
                return AsyncOpenAI(
                    api_key="sk-dummy",
                    base_url=self.OPENROUTER_BASE_URL
                )

            self._client = AsyncOpenAI(
                api_key=settings.openrouter_api_key,
                base_url=self.OPENROUTER_BASE_URL,
                default_headers={
                    "HTTP-Referer": "http://localhost:8000",
                    "X-Title": "Ragooo"
                }
            )
        return self._client

    def retrieve_context(
        self,
        agent_id: str,
        query: str,
        top_k: Optional[int] = None
    ) -> list[dict]:
        """
        Retrieve relevant context from the agent's vector store.

        Returns:
            List of relevant chunks with metadata
        """
        logger.info(f"🔎 Retrieving context for query: '{query[:50]}...'")
        results = vector_store.query(
            agent_id=agent_id,
            query_text=query,
            top_k=top_k
        )
        logger.info(f"✅ Retrieved {len(results)} context chunks")
        return results

    def format_context(self, results: list[dict]) -> str:
        """Format retrieved results into context string for LLM."""
        if not results:
            return "No relevant context found in the knowledge base."

        context_parts = []
        for i, result in enumerate(results, 1):
            source = result.get("metadata", {}).get("source", "Unknown")
            text = result.get("text", "")
            context_parts.append(f"[Source {i}: {source}]\n{text}")

        return "\n\n---\n\n".join(context_parts)

    def build_messages(
        self,
        query: str,
        context: str,
        system_prompt: Optional[str] = None,
        chat_history: Optional[list[dict]] = None
    ) -> list[dict]:
        """Build messages array for the LLM."""
        if system_prompt is None:
            system_prompt = (
                "You are a helpful assistant. Answer questions based only on the provided context. "
                "If you cannot find the answer in the context, say so clearly. "
                "Always cite the source when providing information."
            )

        # Build conversation context instruction if there's history
        conversation_instruction = ""
        if chat_history and len(chat_history) > 0:
            conversation_instruction = """
## Conversation Context:
You are in an ongoing conversation. Pay close attention to the previous messages above.
- Reference and build upon your previous answers when relevant
- Maintain consistency with what you've already said
- If the user asks a follow-up question, use context from your prior responses
- Avoid repeating information you've already provided unless asked
"""

        # System message with context
        system_message = f"""{system_prompt}

## Context from Knowledge Base:

{context}
{conversation_instruction}
## Instructions:
- Answer based ONLY on the context provided above
- If the context doesn't contain relevant information, say so clearly
- Cite sources when providing information (e.g., "According to [Source 1: filename]...")
- Format your response using markdown for readability
- Be concise but thorough"""

        messages = [{"role": "system", "content": system_message}]

        # Add chat history if provided
        if chat_history:
            messages.extend(chat_history)

        # Add current query
        messages.append({"role": "user", "content": query})

        return messages

    async def query_with_sources(
        self,
        agent_id: str,
        query: str,
        model: str,
        system_prompt: Optional[str] = None,
        chat_history: Optional[list[dict]] = None,
        top_k: Optional[int] = None
    ) -> dict:
        """Perform RAG query and return response with sources."""
        logger.info(f"🤖 RAG Query: model={model}")

        results = self.retrieve_context(agent_id, query, top_k)
        context = self.format_context(results)
        messages = self.build_messages(query, context, system_prompt, chat_history)

        logger.info(f"📡 Sending request to OpenRouter ({model})...")
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=2048
        )
        logger.info(f"✅ Response received: {response.usage.total_tokens if response.usage else 'N/A'} tokens")

        sources = [
            {
                "filename": r["metadata"].get("source"),
                "chunk_index": r["metadata"].get("chunk_index"),
                "relevance": r.get("score")
            }
            for r in results
        ]

        return {
            "response": response.choices[0].message.content,
            "sources": sources,
            "context_used": len(results) > 0
        }

    async def query_stream(
        self,
        agent_id: str,
        query: str,
        model: str,
        system_prompt: Optional[str] = None,
        chat_history: Optional[list[dict]] = None,
        top_k: Optional[int] = None
    ) -> AsyncGenerator[str, None]:
        """Stream RAG query response."""
        logger.info(f"📡 Streaming RAG Query: model={model}")

        results = self.retrieve_context(agent_id, query, top_k)
        context = self.format_context(results)
        messages = self.build_messages(query, context, system_prompt, chat_history)

        # Send sources first as a special event
        sources = [
            {
                "filename": r["metadata"].get("source"),
                "chunk_index": r["metadata"].get("chunk_index"),
                "relevance": r.get("score")
            }
            for r in results
        ]
        logger.info(f"📚 Sending {len(sources)} sources")
        yield f"sources: {json.dumps(sources)}\n\n"

        try:
            logger.info(f"📡 Starting stream from OpenRouter ({model})...")
            stream = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=2048,
                stream=True
            )

            chunk_count = 0
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    chunk_count += 1
                    yield f"data: {chunk.choices[0].delta.content}\n\n"

            logger.info(f"✅ Stream complete: {chunk_count} chunks")
            yield "done: {}\n\n"
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Stream error: {error_msg}")
            # Send error as a special event
            yield f"error: {json.dumps({'message': error_msg})}\n\n"


# Singleton instance
rag_service = RAGService()

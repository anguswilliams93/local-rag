import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db, Agent
from storage.vector_store import vector_store
from storage.file_storage import file_storage
from .schemas import AgentCreate, AgentUpdate, AgentResponse, AgentListResponse

logger = logging.getLogger("local-rag.agents")
router = APIRouter(prefix="/agents", tags=["agents"])


def get_agent_or_404(agent_id: str, db: Session) -> Agent:
    """Get agent by ID or raise 404."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with id '{agent_id}' not found"
        )
    return agent


def agent_to_response(agent: Agent, db: Session) -> AgentResponse:
    """Convert Agent model to response with stats."""
    document_count = len(agent.documents)
    stats = vector_store.get_collection_stats(agent.id)

    return AgentResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        model=agent.model,
        system_prompt=agent.system_prompt,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        document_count=document_count,
        total_chunks=stats.get("total_chunks", 0)
    )


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(agent_data: AgentCreate, db: Session = Depends(get_db)):
    """Create a new RAG agent."""
    logger.info(f"Creating new agent: name='{agent_data.name}', model='{agent_data.model}'")

    agent = Agent(
        name=agent_data.name,
        description=agent_data.description,
        model=agent_data.model,
        system_prompt=agent_data.system_prompt
    )

    db.add(agent)
    db.commit()
    db.refresh(agent)

    # Create empty collection in vector store
    vector_store.get_or_create_collection(agent.id)

    logger.info(f"✅ Agent created: id={agent.id}")
    return agent_to_response(agent, db)


@router.get("", response_model=AgentListResponse)
def list_agents(db: Session = Depends(get_db)):
    """List all agents."""
    agents = db.query(Agent).order_by(Agent.created_at.desc()).all()

    return AgentListResponse(
        agents=[agent_to_response(a, db) for a in agents],
        total=len(agents)
    )


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    """Get a specific agent by ID."""
    agent = get_agent_or_404(agent_id, db)
    return agent_to_response(agent, db)


@router.patch("/{agent_id}", response_model=AgentResponse)
def update_agent(
    agent_id: str,
    agent_data: AgentUpdate,
    db: Session = Depends(get_db)
):
    """Update an agent's settings."""
    agent = get_agent_or_404(agent_id, db)

    update_data = agent_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(agent, key, value)

    db.commit()
    db.refresh(agent)

    return agent_to_response(agent, db)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    """Delete an agent and all its documents."""
    agent = get_agent_or_404(agent_id, db)

    # Delete files and vector index
    file_storage.delete_agent_files(agent.id)
    vector_store.delete_collection(agent.id)

    db.delete(agent)
    db.commit()
    return None

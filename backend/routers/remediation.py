from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from services.groq_remediation import RemediationService

router = APIRouter(prefix="/remediation", tags=["remediation"])
remediation_service = RemediationService()


class RemediationRequest(BaseModel):
    title: str
    description: str = ""
    recommendation: str = ""
    severity: str = "medium"
    service: str = ""
    resource_type: str = ""
    resource_id: str = ""
    region: str = ""


class ChatRequest(BaseModel):
    finding_context: str
    messages: list[dict]


@router.post("/resolve")
async def get_remediation(request: RemediationRequest, db: AsyncSession = Depends(get_db)):
    """Get AI-generated remediation steps for a security finding."""
    result = await remediation_service.get_remediation(
        finding_context=request.model_dump(),
        db=db,
    )
    return result


@router.post("/chat")
async def chat_followup(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Send a follow-up question about a finding's remediation."""
    result = await remediation_service.chat_followup(
        finding_context=request.finding_context,
        messages=request.messages,
    )
    return result

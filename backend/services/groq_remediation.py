import logging

from groq import AsyncGroq
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.remediation_cache import RemediationCache

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert AWS cloud security engineer. When given a security finding, provide:

1. **Impact Assessment**: Why this finding matters and what risks it poses.
2. **AWS CLI Fix**: Exact AWS CLI commands to remediate the issue.
3. **Terraform Fix**: Terraform code to fix and prevent recurrence.
4. **AWS Console Steps**: Step-by-step instructions using the AWS Management Console.
5. **Verification**: How to verify the fix was applied correctly.

Use markdown formatting. Be specific with resource ARNs, regions, and parameters.
Keep your response focused and actionable. Do not use emojis."""


class RemediationService:
    """Provides AI-powered remediation guidance using Groq."""

    def __init__(self) -> None:
        self._client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self._model = settings.GROQ_MODEL

    async def get_remediation(
        self,
        finding_context: dict,
        db: AsyncSession,
    ) -> dict:
        """Get AI remediation steps, checking cache first."""
        check_id = finding_context.get("check_id", finding_context.get("title", ""))
        severity = finding_context.get("severity", "medium")
        service = finding_context.get("service", "")

        # Check cache
        stmt = select(RemediationCache).where(
            RemediationCache.check_id == check_id,
            RemediationCache.severity == severity,
            RemediationCache.service == service,
        )
        result = await db.execute(stmt)
        cached = result.scalar_one_or_none()

        if cached:
            return {
                "steps": cached.ai_response,
                "model": cached.model or self._model,
                "tokens_used": cached.tokens_used,
            }

        # Generate via Groq
        user_prompt = (
            f"Security Finding:\n"
            f"- Title: {finding_context.get('title', 'N/A')}\n"
            f"- Severity: {severity}\n"
            f"- Service: {service}\n"
            f"- Resource Type: {finding_context.get('resource_type', 'N/A')}\n"
            f"- Resource ID: {finding_context.get('resource_id', 'N/A')}\n"
            f"- Region: {finding_context.get('region', 'N/A')}\n"
            f"- Description: {finding_context.get('description', 'N/A')}\n"
            f"- Current Recommendation: {finding_context.get('recommendation', 'N/A')}\n\n"
            f"Provide detailed remediation steps."
        )

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=3000,
        )

        steps = response.choices[0].message.content or ""
        tokens_used = response.usage.total_tokens if response.usage else None

        # Store in cache
        cache_entry = RemediationCache(
            check_id=check_id,
            severity=severity,
            service=service,
            ai_response=steps,
            model=self._model,
            tokens_used=tokens_used,
        )
        db.add(cache_entry)
        await db.commit()

        return {"steps": steps, "model": self._model, "tokens_used": tokens_used}

    async def chat_followup(
        self,
        finding_context: str,
        messages: list[dict],
    ) -> dict:
        """Handle follow-up chat questions about a finding."""
        system_message = (
            f"{SYSTEM_PROMPT}\n\n"
            f"Context about the security finding:\n{finding_context}"
        )

        groq_messages = [{"role": "system", "content": system_message}]
        for msg in messages:
            groq_messages.append({"role": msg["role"], "content": msg["content"]})

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=groq_messages,
            temperature=0.3,
            max_tokens=2000,
        )

        reply = response.choices[0].message.content or ""
        return {"reply": reply, "model": self._model}

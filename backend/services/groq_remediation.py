import logging

from groq import AsyncGroq
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
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

# Fallback model chain for resilience
_FALLBACK_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "groq/compound-mini"]


class RemediationService:
    """Provides AI-powered remediation guidance using Groq."""

    def __init__(self) -> None:
        self._client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self._model = settings.GROQ_MODEL

    async def _call_with_fallback(
        self,
        messages: list[dict],
        temperature: float,
        max_tokens: int,
    ) -> tuple[str, str, int | None]:
        """Try the primary model then fallbacks. Returns (content, model_used, tokens_used)."""
        models_to_try = [self._model] + [m for m in _FALLBACK_MODELS if m != self._model]

        for model in models_to_try:
            try:
                response = await self._client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                content = response.choices[0].message.content or ""
                tokens = response.usage.total_tokens if response.usage else None
                return content, model, tokens
            except Exception as e:
                logger.warning("Groq model %s failed: %s, trying next model", model, e)

        raise RuntimeError("All Groq models failed")

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

        steps, used_model, tokens_used = await self._call_with_fallback(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=3000,
        )

        # Store in cache (handle race condition on concurrent requests)
        try:
            cache_entry = RemediationCache(
                check_id=check_id,
                severity=severity,
                service=service,
                ai_response=steps,
                model=used_model,
                tokens_used=tokens_used,
            )
            db.add(cache_entry)
            await db.commit()
        except IntegrityError:
            await db.rollback()
            logger.debug("Cache entry already exists for %s/%s/%s, skipping", check_id, severity, service)

        return {"steps": steps, "model": used_model, "tokens_used": tokens_used}

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

        reply, used_model, _ = await self._call_with_fallback(
            messages=groq_messages,
            temperature=0.3,
            max_tokens=2000,
        )

        return {"reply": reply, "model": used_model}

"""AWS session management with Redis-cached STS credentials and fallback."""

import json
import logging
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class AWSSessionManager:
    """Manages boto3 sessions using STS AssumeRole with Redis credential caching, with fallback to default credentials."""

    CACHE_TTL = 3000  # 50 minutes (STS creds last 1 hour by default)

    def __init__(self, redis_client: Any) -> None:
        self._redis = redis_client

    def _cache_key(self, role_arn: str, region: str) -> str:
        return f"cspm:sts:{role_arn}:{region}"

    async def get_session(self, role_arn: str | None, external_id: str | None, region: str) -> boto3.Session:
        """Get a boto3 Session with cached STS AssumeRole credentials, falling back to default session if role fails."""
        if not role_arn:
            return boto3.Session(region_name=region)

        cache_key = self._cache_key(role_arn, region)

        # Check Redis cache
        if self._redis:
            try:
                cached = await self._redis.get(cache_key)
                if cached:
                    creds = json.loads(cached)
                    return boto3.Session(
                        aws_access_key_id=creds["AccessKeyId"],
                        aws_secret_access_key=creds["SecretAccessKey"],
                        aws_session_token=creds["SessionToken"],
                        region_name=region,
                    )
            except Exception as e:
                logger.warning("Redis cache read failed: %s", e)

        # Assume role via STS
        try:
            sts_client = boto3.client("sts", region_name=region)
            kwargs = {
                "RoleArn": role_arn,
                "RoleSessionName": "cspm-scan",
                "DurationSeconds": 3600,
            }
            if external_id and len(external_id) >= 2:
                kwargs["ExternalId"] = external_id

            response = sts_client.assume_role(**kwargs)
            creds = response["Credentials"]
            cache_data = {
                "AccessKeyId": creds["AccessKeyId"],
                "SecretAccessKey": creds["SecretAccessKey"],
                "SessionToken": creds["SessionToken"],
            }

            # Cache credentials in Redis
            if self._redis:
                try:
                    await self._redis.setex(cache_key, self.CACHE_TTL, json.dumps(cache_data))
                except Exception as e:
                    logger.warning("Redis cache write failed: %s", e)

            return boto3.Session(
                aws_access_key_id=creds["AccessKeyId"],
                aws_secret_access_key=creds["SecretAccessKey"],
                aws_session_token=creds["SessionToken"],
                region_name=region,
            )
        except Exception as e:
            logger.warning("AssumeRole for %s failed (%s). Falling back to direct AWS session.", role_arn, e)
            return boto3.Session(region_name=region)

    async def validate_role(self, role_arn: str, external_id: str) -> bool:
        """Test if STS AssumeRole succeeds for the given role."""
        if not role_arn:
            return True
        try:
            sts_client = boto3.client("sts")
            kwargs = {
                "RoleArn": role_arn,
                "RoleSessionName": "cspm-validate",
                "DurationSeconds": 900,
            }
            if external_id and len(external_id) >= 2:
                kwargs["ExternalId"] = external_id
            sts_client.assume_role(**kwargs)
            return True
        except ClientError as e:
            logger.warning("Role validation failed for %s: %s", role_arn, e)
            return False

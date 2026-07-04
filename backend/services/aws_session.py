"""AWS session management with Redis-cached STS credentials."""

import json
import logging
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class AWSSessionManager:
    """Manages boto3 sessions using STS AssumeRole with Redis credential caching."""

    CACHE_TTL = 3000  # 50 minutes (STS creds last 1 hour by default)

    def __init__(self, redis_client: Any) -> None:
        self._redis = redis_client

    def _cache_key(self, role_arn: str, region: str) -> str:
        return f"cspm:sts:{role_arn}:{region}"

    async def get_session(self, role_arn: str, external_id: str, region: str) -> boto3.Session:
        """Get a boto3 Session with cached STS AssumeRole credentials."""
        cache_key = self._cache_key(role_arn, region)

        # Check Redis cache
        cached = await self._redis.get(cache_key)
        if cached:
            creds = json.loads(cached)
            return boto3.Session(
                aws_access_key_id=creds["AccessKeyId"],
                aws_secret_access_key=creds["SecretAccessKey"],
                aws_session_token=creds["SessionToken"],
                region_name=region,
            )

        # Assume role via STS
        sts_client = boto3.client("sts")
        response = sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName="cspm-scan",
            ExternalId=external_id,
            DurationSeconds=3600,
        )

        creds = response["Credentials"]
        cache_data = {
            "AccessKeyId": creds["AccessKeyId"],
            "SecretAccessKey": creds["SecretAccessKey"],
            "SessionToken": creds["SessionToken"],
        }

        # Cache credentials in Redis
        await self._redis.setex(cache_key, self.CACHE_TTL, json.dumps(cache_data))

        return boto3.Session(
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"],
            region_name=region,
        )

    async def validate_role(self, role_arn: str, external_id: str) -> bool:
        """Test if STS AssumeRole succeeds for the given role."""
        try:
            sts_client = boto3.client("sts")
            sts_client.assume_role(
                RoleArn=role_arn,
                RoleSessionName="cspm-validate",
                ExternalId=external_id,
                DurationSeconds=900,
            )
            return True
        except ClientError as e:
            logger.warning("Role validation failed for %s: %s", role_arn, e)
            return False

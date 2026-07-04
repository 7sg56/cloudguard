import logging
from typing import Any

import boto3

logger = logging.getLogger(__name__)


class ResourceDiscoveryService:
    """Discovers AWS resources across services using boto3."""

    @staticmethod
    async def discover_all(session: boto3.Session, regions: list[str]) -> list[dict[str, Any]]:
        """Discover all resources across services and regions."""
        resources: list[dict[str, Any]] = []

        for region in regions:
            for discover_fn in [
                ResourceDiscoveryService._discover_s3,
                ResourceDiscoveryService._discover_ec2,
                ResourceDiscoveryService._discover_rds,
                ResourceDiscoveryService._discover_lambda,
                ResourceDiscoveryService._discover_security_groups,
            ]:
                try:
                    found = discover_fn(session, region)
                    resources.extend(found)
                except Exception as e:
                    logger.warning("Discovery failed for %s in %s: %s", discover_fn.__name__, region, e)

        # IAM is global
        try:
            resources.extend(ResourceDiscoveryService._discover_iam(session))
        except Exception as e:
            logger.warning("IAM discovery failed: %s", e)

        return resources

    @staticmethod
    def _discover_s3(session: boto3.Session, region: str) -> list[dict]:
        """Discover S3 buckets."""
        s3 = session.client("s3", region_name=region)
        results = []
        # S3 ListBuckets is global; filter by region via GetBucketLocation
        if region != session.region_name:
            return results
        response = s3.list_buckets()
        for bucket in response.get("Buckets", []):
            name = bucket["Name"]
            try:
                loc = s3.get_bucket_location(Bucket=name)
                bucket_region = loc.get("LocationConstraint") or "us-east-1"
            except Exception:
                bucket_region = "unknown"
            try:
                acl = s3.get_bucket_acl(Bucket=name)
                is_public = any(
                    g.get("Grantee", {}).get("URI", "").endswith("AllUsers")
                    for g in acl.get("Grants", [])
                )
            except Exception:
                is_public = None
            try:
                enc = s3.get_bucket_encryption(Bucket=name)
                encrypted = bool(enc.get("ServerSideEncryptionConfiguration"))
            except Exception:
                encrypted = False
            results.append({
                "resource_id": f"arn:aws:s3:::{name}",
                "resource_type": "AWS::S3::Bucket",
                "service": "s3",
                "region": bucket_region,
                "tags": {},
                "is_public": is_public,
                "encrypted": encrypted,
                "raw_data": {"CreationDate": str(bucket.get("CreationDate", ""))},
            })
        return results

    @staticmethod
    def _discover_ec2(session: boto3.Session, region: str) -> list[dict]:
        """Discover EC2 instances."""
        ec2 = session.client("ec2", region_name=region)
        results = []
        paginator = ec2.get_paginator("describe_instances")
        for page in paginator.paginate():
            for reservation in page.get("Reservations", []):
                for instance in reservation.get("Instances", []):
                    tags = {t["Key"]: t["Value"] for t in instance.get("Tags", [])}
                    results.append({
                        "resource_id": instance["InstanceId"],
                        "resource_type": "AWS::EC2::Instance",
                        "service": "ec2",
                        "region": region,
                        "tags": tags,
                        "is_public": bool(instance.get("PublicIpAddress")),
                        "encrypted": None,
                        "raw_data": {
                            "InstanceType": instance.get("InstanceType"),
                            "State": instance.get("State", {}).get("Name"),
                            "VpcId": instance.get("VpcId"),
                        },
                    })
        return results

    @staticmethod
    def _discover_rds(session: boto3.Session, region: str) -> list[dict]:
        """Discover RDS instances."""
        rds = session.client("rds", region_name=region)
        results = []
        paginator = rds.get_paginator("describe_db_instances")
        for page in paginator.paginate():
            for db in page.get("DBInstances", []):
                results.append({
                    "resource_id": db["DBInstanceArn"],
                    "resource_type": "AWS::RDS::DBInstance",
                    "service": "rds",
                    "region": region,
                    "tags": {t["Key"]: t["Value"] for t in db.get("TagList", [])},
                    "is_public": db.get("PubliclyAccessible", False),
                    "encrypted": db.get("StorageEncrypted", False),
                    "raw_data": {
                        "Engine": db.get("Engine"),
                        "EngineVersion": db.get("EngineVersion"),
                        "DBInstanceClass": db.get("DBInstanceClass"),
                        "MultiAZ": db.get("MultiAZ"),
                    },
                })
        return results

    @staticmethod
    def _discover_lambda(session: boto3.Session, region: str) -> list[dict]:
        """Discover Lambda functions."""
        lam = session.client("lambda", region_name=region)
        results = []
        paginator = lam.get_paginator("list_functions")
        for page in paginator.paginate():
            for fn in page.get("Functions", []):
                results.append({
                    "resource_id": fn["FunctionArn"],
                    "resource_type": "AWS::Lambda::Function",
                    "service": "lambda",
                    "region": region,
                    "tags": {},
                    "is_public": False,
                    "encrypted": None,
                    "raw_data": {
                        "Runtime": fn.get("Runtime"),
                        "MemorySize": fn.get("MemorySize"),
                        "Timeout": fn.get("Timeout"),
                    },
                })
        return results

    @staticmethod
    def _discover_iam(session: boto3.Session) -> list[dict]:
        """Discover IAM users (global service)."""
        iam = session.client("iam")
        results = []
        paginator = iam.get_paginator("list_users")
        for page in paginator.paginate():
            for user in page.get("Users", []):
                results.append({
                    "resource_id": user["Arn"],
                    "resource_type": "AWS::IAM::User",
                    "service": "iam",
                    "region": None,
                    "tags": {},
                    "is_public": None,
                    "encrypted": None,
                    "raw_data": {"CreateDate": str(user.get("CreateDate", ""))},
                })
        return results

    @staticmethod
    def _discover_security_groups(session: boto3.Session, region: str) -> list[dict]:
        """Discover VPC Security Groups."""
        ec2 = session.client("ec2", region_name=region)
        results = []
        paginator = ec2.get_paginator("describe_security_groups")
        for page in paginator.paginate():
            for sg in page.get("SecurityGroups", []):
                tags = {t["Key"]: t["Value"] for t in sg.get("Tags", [])}
                results.append({
                    "resource_id": sg["GroupId"],
                    "resource_type": "AWS::EC2::SecurityGroup",
                    "service": "vpc",
                    "region": region,
                    "tags": tags,
                    "is_public": None,
                    "encrypted": None,
                    "raw_data": {
                        "GroupName": sg.get("GroupName"),
                        "VpcId": sg.get("VpcId"),
                        "InboundRules": len(sg.get("IpPermissions", [])),
                        "OutboundRules": len(sg.get("IpPermissionsEgress", [])),
                    },
                })
        return results

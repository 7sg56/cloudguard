import logging
from typing import Any

import boto3

logger = logging.getLogger(__name__)


class ResourceDiscoveryService:
    """Discovers AWS resources across services using boto3."""

    @staticmethod
    def discover_all(session: boto3.Session, regions: list[str]) -> list[dict[str, Any]]:
        """Discover all resources across services and regions."""
        resources: list[dict[str, Any]] = []

        # 1. Global S3 buckets (queried once)
        try:
            resources.extend(ResourceDiscoveryService._discover_s3(session))
        except Exception as e:
            logger.warning("Global S3 discovery failed: %s", e)

        # 2. Global IAM users (queried once)
        try:
            resources.extend(ResourceDiscoveryService._discover_iam(session))
        except Exception as e:
            logger.warning("Global IAM discovery failed: %s", e)

        # 3. Regional services
        for region in regions:
            for discover_fn in [
                ResourceDiscoveryService._discover_ec2,
                ResourceDiscoveryService._discover_vpcs,
                ResourceDiscoveryService._discover_security_groups,
                ResourceDiscoveryService._discover_rds,
                ResourceDiscoveryService._discover_lambda,
            ]:
                try:
                    found = discover_fn(session, region)
                    resources.extend(found)
                except Exception as e:
                    logger.warning("Discovery failed for %s in %s: %s", discover_fn.__name__, region, e)

        return resources

    @staticmethod
    def _discover_s3(session: boto3.Session) -> list[dict]:
        """Discover S3 buckets."""
        s3 = session.client("s3")
        results = []
        try:
            response = s3.list_buckets()
        except Exception as e:
            logger.warning("Failed to list S3 buckets: %s", e)
            return results

        for bucket in response.get("Buckets", []):
            name = bucket["Name"]
            bucket_region = "us-east-1"
            try:
                loc = s3.get_bucket_location(Bucket=name)
                constraint = loc.get("LocationConstraint")
                if constraint:
                    bucket_region = constraint
            except Exception:
                pass

            is_public = False
            try:
                pab = s3.get_public_access_block(Bucket=name)
                conf = pab.get("PublicAccessBlockConfiguration", {})
                if not (conf.get("BlockPublicAcls") and conf.get("BlockPublicPolicy")):
                    is_public = True
            except Exception:
                # If no public access block, check ACL
                try:
                    acl = s3.get_bucket_acl(Bucket=name)
                    is_public = any(
                        g.get("Grantee", {}).get("URI", "").endswith("AllUsers")
                        for g in acl.get("Grants", [])
                    )
                except Exception:
                    is_public = False

            encrypted = False
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
                "raw_data": {"BucketName": name, "CreationDate": str(bucket.get("CreationDate", ""))},
            })
        return results

    @staticmethod
    def _discover_ec2(session: boto3.Session, region: str) -> list[dict]:
        """Discover EC2 instances."""
        ec2 = session.client("ec2", region_name=region)
        results = []
        try:
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
                                "PublicIp": instance.get("PublicIpAddress"),
                                "PrivateIp": instance.get("PrivateIpAddress"),
                            },
                        })
        except Exception as e:
            logger.warning("EC2 describe_instances failed in %s: %s", region, e)
        return results

    @staticmethod
    def _discover_vpcs(session: boto3.Session, region: str) -> list[dict]:
        """Discover VPCs."""
        ec2 = session.client("ec2", region_name=region)
        results = []
        try:
            vpcs = ec2.describe_vpcs().get("Vpcs", [])
            for vpc in vpcs:
                tags = {t["Key"]: t["Value"] for t in vpc.get("Tags", [])}
                results.append({
                    "resource_id": vpc["VpcId"],
                    "resource_type": "AWS::EC2::VPC",
                    "service": "vpc",
                    "region": region,
                    "tags": tags,
                    "is_public": False,
                    "encrypted": None,
                    "raw_data": {
                        "CidrBlock": vpc.get("CidrBlock"),
                        "IsDefault": vpc.get("IsDefault", False),
                        "State": vpc.get("State"),
                    },
                })
        except Exception as e:
            logger.warning("VPC describe failed in %s: %s", region, e)
        return results

    @staticmethod
    def _discover_security_groups(session: boto3.Session, region: str) -> list[dict]:
        """Discover VPC Security Groups."""
        ec2 = session.client("ec2", region_name=region)
        results = []
        try:
            paginator = ec2.get_paginator("describe_security_groups")
            for page in paginator.paginate():
                for sg in page.get("SecurityGroups", []):
                    tags = {t["Key"]: t["Value"] for t in sg.get("Tags", [])}
                    # Check if any rule allows 0.0.0.0/0
                    is_public = any(
                        any(ip_range.get("CidrIp") == "0.0.0.0/0" for ip_range in rule.get("IpRanges", []))
                        for rule in sg.get("IpPermissions", [])
                    )
                    results.append({
                        "resource_id": sg["GroupId"],
                        "resource_type": "AWS::EC2::SecurityGroup",
                        "service": "vpc",
                        "region": region,
                        "tags": tags,
                        "is_public": is_public,
                        "encrypted": None,
                        "raw_data": {
                            "GroupName": sg.get("GroupName"),
                            "Description": sg.get("Description"),
                            "VpcId": sg.get("VpcId"),
                            "InboundRules": len(sg.get("IpPermissions", [])),
                            "OutboundRules": len(sg.get("IpPermissionsEgress", [])),
                        },
                    })
        except Exception as e:
            logger.warning("Security groups describe failed in %s: %s", region, e)
        return results

    @staticmethod
    def _discover_rds(session: boto3.Session, region: str) -> list[dict]:
        """Discover RDS instances."""
        rds = session.client("rds", region_name=region)
        results = []
        try:
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
                            "DBInstanceIdentifier": db.get("DBInstanceIdentifier"),
                            "Engine": db.get("Engine"),
                            "EngineVersion": db.get("EngineVersion"),
                            "DBInstanceClass": db.get("DBInstanceClass"),
                            "MultiAZ": db.get("MultiAZ"),
                        },
                    })
        except Exception as e:
            logger.warning("RDS describe failed in %s: %s", region, e)
        return results

    @staticmethod
    def _discover_lambda(session: boto3.Session, region: str) -> list[dict]:
        """Discover Lambda functions."""
        lam = session.client("lambda", region_name=region)
        results = []
        try:
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
                            "FunctionName": fn.get("FunctionName"),
                            "Runtime": fn.get("Runtime"),
                            "MemorySize": fn.get("MemorySize"),
                            "Timeout": fn.get("Timeout"),
                        },
                    })
        except Exception as e:
            logger.warning("Lambda list_functions failed in %s: %s", region, e)
        return results

    @staticmethod
    def _discover_iam(session: boto3.Session) -> list[dict]:
        """Discover IAM users and roles (global service)."""
        iam = session.client("iam")
        results = []
        try:
            paginator = iam.get_paginator("list_users")
            for page in paginator.paginate():
                for user in page.get("Users", []):
                    results.append({
                        "resource_id": user["Arn"],
                        "resource_type": "AWS::IAM::User",
                        "service": "iam",
                        "region": "global",
                        "tags": {},
                        "is_public": False,
                        "encrypted": None,
                        "raw_data": {
                            "UserName": user.get("UserName"),
                            "CreateDate": str(user.get("CreateDate", "")),
                            "PasswordLastUsed": str(user.get("PasswordLastUsed", "")),
                        },
                    })
        except Exception as e:
            logger.warning("IAM list_users failed: %s", e)
        return results

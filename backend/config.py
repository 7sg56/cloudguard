from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """CSPM backend configuration loaded from environment variables."""

    DATABASE_URL: str = "postgresql+asyncpg://cspm:password@localhost:5432/cspm"
    REDIS_URL: str = "redis://localhost:6379/0"

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    AWS_DEFAULT_REGION: str = "us-east-1"

    PROWLER_OUTPUT_DIR: str = "/tmp/prowler-output"

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": "../.env", "extra": "ignore"}


settings = Settings()

from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Centralised application configuration.
    Loads values from environment variables or .env file.
    """
    # Application Info
    PROJECT_NAME: str = "Chennai Mobility AI"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Database Configuration (PostgreSQL-ready architecture)
    DATABASE_URL: Optional[str] = None
    POSTGRES_SERVER: Optional[str] = None
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "chennai_mobility"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_CONNECT_TIMEOUT: int = 2

    # External Provider Placeholders (Worker 1: Voice AI + Telephony)
    SARVAM_API_KEY: Optional[str] = None
    EXOTEL_ACCOUNT_SID: Optional[str] = None
    EXOTEL_API_KEY: Optional[str] = None
    EXOTEL_API_TOKEN: Optional[str] = None
    EXOTEL_SUB_DOMAIN: Optional[str] = None

    # External Provider Placeholders (Worker 2: Mobility Backend)
    GTFS_DATA_DIR: str = "data/fixtures"

    # External Provider Placeholders (Worker 3: Messaging + Complaints)
    WHATSAPP_API_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    SMS_PROVIDER_API_KEY: Optional[str] = None

    # Voice / Language Defaults
    DEFAULT_LANGUAGE: str = "ta"
    SUPPORTED_LANGUAGES: List[str] = ["ta", "en", "ta-en"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    @property
    def sync_database_url(self) -> Optional[str]:
        """
        Returns sync database URL if explicitly configured.
        Returns None when database is not configured, avoiding blocking network timeouts.
        """
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.POSTGRES_SERVER:
            return (
                f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
                f"{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        return None


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()

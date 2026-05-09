"""
NeuroGenix Email Agent — App Config
All secrets loaded from environment variables only. Never hardcoded.
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "NeuroGenix Email Agent"
    app_version: str = "1.0.0"
    debug: bool = True
    frontend_url: str = "http://localhost:5174"
    backend_url: str = "http://localhost:8000"

    # Database — set DATABASE_URL env var on Railway
    database_url: str = "sqlite:///./neurogenix_email_agent.db"

    # JWT
    jwt_secret_key: str = "N3ur0G3n1x_Em4il_Ag3nt_S3cr3t_2025_ChangeMe!"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    # Super Admin
    super_admin_email: str = "admin@neurogenix.ai"
    super_admin_password: str = "Neurogenix@2025!"

    # Encryption (for OAuth tokens)
    encryption_key: str = "dGhpcyBpcyBhIDMyIGJ5dGUga2V5Zm9yZW1haWw="

    # Claude AI — set CLAUDE_API_KEY in Railway ENV
    claude_api_key: str = ""
    anthropic_model: str = "claude-3-5-sonnet-20241022"

    # Google OAuth / Gmail API
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/mailboxes/oauth/google-callback"

    # Notifications
    approver_email: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    s = Settings()
    # Fix postgres:// → postgresql:// for SQLAlchemy compatibility
    if s.database_url and s.database_url.startswith("postgres://"):
        s.database_url = s.database_url.replace("postgres://", "postgresql://", 1)
    return s


settings = get_settings()

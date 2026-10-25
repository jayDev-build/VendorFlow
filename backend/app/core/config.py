from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_formgate_db = os.path.join(ROOT_DIR, "formgate.db").replace("\\", "/")
_vendorflow_db = os.path.join(ROOT_DIR, "vendorflow.db").replace("\\", "/")
DEFAULT_DB_FILE = _formgate_db if os.path.exists(_formgate_db) else _vendorflow_db

class Settings(BaseSettings):
    APP_NAME: str = "FormGate"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database
    # Defaults to absolute path SQLite for local development; supports PostgreSQL URL for production / Supabase
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DB_FILE}"

    # Security & Auth
    SECRET_KEY: str = "insecure-dev-secret-key-change-in-production-formgate-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    INVITATION_TOKEN_EXPIRE_DAYS: int = 14

    # CORS & Base URLs
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    APP_BASE_URL: str = "http://localhost:3000"
    API_BASE_URL: str = "http://localhost:8000"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str):
            return json.loads(v)
        return v

    # Ollama Local LLM (e.g. gemma4:e4b)
    OLLAMA_ENABLED: bool = True
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma4:e4b"
    OLLAMA_TIMEOUT_SECONDS: float = 240.0

    # OpenAI API
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Google Gemini Model
    GEMINI_API_KEY: str = "AQ.Ab8RN6KKbm_ZMIsfVTInueuG5AulIjW6Et-tfL5tKVLjwx2-XQ"
    GEMINI_PRIMARY_MODEL: str = "gemini-3.5-flash"
    GEMINI_MODEL: str = "gemini-3.5-flash"

    # Email Delivery (Resend API or Standard SMTP / Gmail / Outlook)
    RESEND_API_KEY: str = ""
    SENDER_EMAIL: str = "onboarding@formgate.io"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True

    # Supabase (Optional)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "vendor-documents"

    # Storage & File Upload
    LOCAL_STORAGE_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "uploads")
    MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_FILE_TYPES: List[str] = ["application/pdf", "image/png", "image/jpeg"]

    @field_validator("ALLOWED_FILE_TYPES", mode="before")
    @classmethod
    def assemble_allowed_types(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [i.strip() for i in v.split(",")]
        return v

    # Expiry Scheduler & Reminders
    EXPIRY_SCHEDULER_INTERVAL_SECONDS: int = 3600
    REMINDER_INTERVAL_DAYS: List[int] = [30, 7, 1]

    @field_validator("REMINDER_INTERVAL_DAYS", mode="before")
    @classmethod
    def assemble_reminder_days(cls, v: Union[str, List[int]]) -> List[int]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [int(i.strip()) for i in v.split(",")]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()

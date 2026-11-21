from typing import List, Union, Optional
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

    # Server & Port (Hugging Face Spaces defaults to port 7860)
    PORT: int = int(os.environ.get("PORT", 7860))
    HOST: str = os.environ.get("HOST", "0.0.0.0")

    # Database
    # Defaults to absolute path SQLite for zero-setup local dev;
    # In production, pass Supabase PostgreSQL URL:
    # e.g. postgresql+psycopg2://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DB_FILE}"

    # Security & Auth
    SECRET_KEY: str = "insecure-dev-secret-key-change-in-production-formgate-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    INVITATION_TOKEN_EXPIRE_DAYS: int = 14

    # CORS & Base URLs
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_CORS_ORIGINS: List[str] = [
        "https://formgate.in",
        "https://www.formgate.in",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    ALLOW_VERCEL_PREVIEWS: bool = True  # Automatically permits *.vercel.app preview branches
    APP_BASE_URL: str = "http://localhost:3000"
    API_BASE_URL: str = "http://localhost:8000"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip().rstrip("/") for i in v.split(",") if i.strip()]
        elif isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(i).strip().rstrip("/") for i in parsed if str(i).strip()]
            except Exception:
                return [i.strip().rstrip("/") for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return [str(i).strip().rstrip("/") for i in v if str(i).strip()]
        return v

    @field_validator("FRONTEND_URL", "APP_BASE_URL", "API_BASE_URL", mode="before")
    @classmethod
    def strip_trailing_slash(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().rstrip("/")
        return v

    # Storage Provider Selection: 'auto', 'cloudflare_r2', 'supabase', 'local'
    # Default set to 'local' for local file storage
    STORAGE_PROVIDER: str = "local"

    # Cloudflare R2 (Document Storage - S3 Compatible)
    CLOUDFLARE_R2_ACCOUNT_ID: str = ""
    CLOUDFLARE_R2_ACCESS_KEY_ID: str = ""
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: str = ""
    CLOUDFLARE_R2_BUCKET_NAME: str = "vendor-documents"
    CLOUDFLARE_R2_PUBLIC_URL: str = ""  # Optional custom domain or r2.dev URL

    # Common shorthand aliases for Cloudflare R2
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_PUBLIC_URL: str = ""

    # Supabase (Database, Auth & Storage)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
    SUPABASE_JWKS_URL: str = ""
    SUPABASE_STORAGE_BUCKET: str = "forms-documents"

    # Storage & File Upload Constraints
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

    # Google Gemini Model (Primary Workflow Generator)
    GEMINI_API_KEY: str = ""
    GEMINI_PRIMARY_MODEL: str = "gemini-2.5-flash"
    GEMINI_SECONDARY_MODEL: str = "gemini-2.5-flash-lite"
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # OpenAI API (Optional Fallback)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Ollama Local LLM (Disabled by default in cloud deployments)
    OLLAMA_ENABLED: bool = False
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma4:e4b"
    OLLAMA_TIMEOUT_SECONDS: float = 240.0

    # Email Delivery (Resend API or Standard SMTP / Gmail / Outlook)
    RESEND_API_KEY: str = ""
    SENDER_EMAIL: str = "portal@formgate.in"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True

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

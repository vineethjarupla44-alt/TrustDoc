import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "TrustDoc"
    PROJECT_ID: str = "TRUSTDOC-2026"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "trustdoc-super-secret-key-dev-2026")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    ALGORITHM: str = "HS256"
    INITIAL_ADMIN_SECRET: str = os.getenv("INITIAL_ADMIN_SECRET", "TRUSTDOC_ROOT_ADMIN_SETUP_2026")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'compliance_ai.db'}")

    # Storage
    UPLOAD_DIR: Path = BASE_DIR / "data" / "uploads"
    SAMPLE_DOCS_DIR: Path = BASE_DIR / "data" / "sample_documents"
    REGULATIONS_DIR: Path = BASE_DIR / "data" / "synthetic_regulations"

    # Security & Privacy
    MASK_PII_BY_DEFAULT: bool = True

    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins(self) -> list[str]:
        """Return the comma-separated CORS environment value as trusted origins."""
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.SAMPLE_DOCS_DIR.mkdir(parents=True, exist_ok=True)
settings.REGULATIONS_DIR.mkdir(parents=True, exist_ok=True)

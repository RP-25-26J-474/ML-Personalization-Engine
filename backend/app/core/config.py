from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DEBUG: bool = True
    CORS_ALLOW_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "http://127.0.0.1:5175", "http://localhost:5175"]

    # Demo-mode storage
    ARTIFACTS_DIR: str = "artifacts"
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "mlpe"

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: Any) -> Any:
        if isinstance(v, str):
            raw = v.strip().lower()
            if raw in {"1", "true", "yes", "on", "debug", "dev", "development"}:
                return True
            if raw in {"0", "false", "no", "off", "release", "prod", "production"}:
                return False
        return v


settings = Settings()

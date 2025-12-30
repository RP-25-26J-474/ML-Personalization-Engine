from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DEBUG: bool = True
    CORS_ALLOW_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Demo-mode storage
    ARTIFACTS_DIR: str = "artifacts"


settings = Settings()

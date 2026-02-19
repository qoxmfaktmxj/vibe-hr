from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Vibe-HR API"
    environment: str = "local"
    database_url: str = "sqlite:///./vibe_hr.db"
    cors_origins: str = "http://localhost:3000"
    seed_archive_enabled: bool = False
    seed_archive_sqlite_path: str = "./db/dev_seed_accum.sqlite"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()


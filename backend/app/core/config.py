from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Vibe-HR API"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/vibe_hr"
    cors_origins: str = "http://localhost:3000"
    auth_token_secret: str = "dev-only-change-me"
    auth_token_algorithm: str = "HS256"
    auth_token_expires_min: int = 480
    auth_token_issuer: str = "vibe-hr"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def validate_security_settings(self) -> None:
        if self.auth_token_expires_min <= 0:
            raise ValueError("AUTH_TOKEN_EXPIRES_MIN must be greater than 0.")

        if self.environment != "local" and self.auth_token_secret == "dev-only-change-me":
            raise ValueError("AUTH_TOKEN_SECRET must be set in non-local environments.")


settings = Settings()


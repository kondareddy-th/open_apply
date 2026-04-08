from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────
    # Default: SQLite (zero config, works immediately)
    # For PostgreSQL: DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/nexus
    database_url: str = "sqlite+aiosqlite:///./nexus.db"

    # ── LLM Provider ─────────────────────────────────────────
    llm_provider: str = "anthropic"  # "anthropic" or "openai"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    claude_model: str = "claude-sonnet-4-5-20250929"
    openai_model: str = "gpt-4o"

    # ── Gmail (optional — for email outreach) ────────────────
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_redirect_uri: str = "http://localhost:5175/api/auth/gmail/callback"

    # ── Server ────────────────────────────────────────────────
    # Standalone defaults. Add your production domain to CORS_ORIGINS env var.
    cors_origins: list[str] = [
        "http://localhost:5175",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5175",
    ]
    app_version: str = "0.2.0"

    # ── Deployment Mode ──────────────────────────────────────
    # Set to "/apps/nexus" when deployed behind a reverse proxy at that path.
    # Leave empty for standalone deployment.
    base_path: str = ""

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.database_url


settings = Settings()

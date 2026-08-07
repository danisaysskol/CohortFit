"""Central configuration. Everything tunable lives here, sourced from env / .env.

Nothing in the app hardcodes a path, model id, or threshold — they come from here so
a collaborator can change behavior without touching code (see .env.example at repo root).
"""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Data ---
    # In Docker this is the mounted /data; locally it defaults to the extracted demo folder.
    mimic_data_dir: Path = Path("mimic-iv-clinical-database-demo-2.2")

    # --- OpenAI (only schema + aggregates are ever sent; never patient rows) ---
    openai_api_key: str | None = None
    openai_model_primary: str = "gpt-5.6-terra"
    openai_model_fallback: str = "gpt-5.6-luna"
    openai_model_escalation: str = "gpt-5.6-sol"
    openai_temperature: float = 0.0
    openai_seed: int = 42

    # --- API ---
    cors_allow_origins: list[str] = ["*"]  # dev default; tighten for any real deploy


settings = Settings()

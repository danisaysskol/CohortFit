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

    # --- OpenAI (only the schema description + the user's text are sent; never raw rows) ---
    # NOTE: gpt-5.6 reasoning models reject a custom temperature, so we don't send one —
    # reproducibility comes from the deterministic IR->SQL compiler, not model sampling.
    # Never use the "sol" tier (expensive); terra is the ceiling here.
    openai_api_key: str | None = None
    openai_model_primary: str = "gpt-5.6-terra"     # NL -> cohort IR (structured output)
    openai_model_fallback: str = "gpt-5.6-luna"     # retried if the primary model errors
    openai_reasoning_effort: str = "low"            # bounded schema-mapping task

    # --- API ---
    # Comma-separated list of allowed origins ("*" = allow all). Kept as a plain string
    # (not a JSON list) so it's set safely from any shell/platform env — e.g.
    # CORS_ALLOW_ORIGINS=https://cohortfit.vercel.app  (dev default allows all).
    cors_allow_origins: str = "*"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]

    # --- Rate limiting (per client IP; protects the OpenAI cost path on a public API) ---
    # Caps requests to /cohort/build, /cohort/stream and /eval/run. Set a value to 0 to
    # disable that window (e.g. both 0 for local dev).
    rate_limit_per_minute: int = 30
    rate_limit_per_hour: int = 200


settings = Settings()

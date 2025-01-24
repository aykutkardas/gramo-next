import os
from pydantic import BaseModel, Field
from functools import lru_cache
from dotenv import load_dotenv
from typing import List

load_dotenv()

class Settings(BaseModel):
    """Application settings."""
    APP_NAME: str = Field(default_factory=lambda: os.getenv("APP_NAME", "Gramo API"))
    DEBUG: bool = Field(default_factory=lambda: os.getenv("DEBUG", "False").lower() == "true")
    API_V1_STR: str = Field(default_factory=lambda: os.getenv("API_V1_STR", "/api/v1"))
    TOKENS_PER_MINUTE: int = Field(default_factory=lambda: int(os.getenv("TOKENS_PER_MINUTE", "3000")))
    
    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:8000"
        ).split(",")
    )

    model_config = {
        "case_sensitive": True,
        "frozen": True,
    }

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings() 
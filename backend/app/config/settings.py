import os
from pydantic import BaseModel
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    """Application settings."""
    APP_NAME: str = "Gramo API"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"
    TOKENS_PER_MINUTE: int = 3000
    
    # CORS Configuration
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",    # Next.js frontend
        "http://localhost:8000",    # Local development
    ]

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings() 
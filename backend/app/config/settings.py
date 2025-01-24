import os
from pydantic import BaseModel
from functools import lru_cache
from dotenv import load_dotenv
from typing import List

load_dotenv()

class Settings(BaseModel):
    """Application settings."""
    APP_NAME: str = os.getenv("APP_NAME", "Gramo API")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    TOKENS_PER_MINUTE: int = int(os.getenv("TOKENS_PER_MINUTE", "3000"))
    
    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[str] = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:8000"
    ).split(",")

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings() 
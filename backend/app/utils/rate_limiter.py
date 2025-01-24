import asyncio
import logging
from datetime import datetime
from typing import Optional
from ..config.settings import settings

logger = logging.getLogger(__name__)

class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded."""
    pass

class TokenBucketRateLimiter:
    """Token bucket rate limiter for API requests."""
    
    def __init__(self, tokens_per_minute: Optional[int] = None):
        self.tokens_per_minute = tokens_per_minute or settings.TOKENS_PER_MINUTE
        self.tokens = self.tokens_per_minute
        self.last_update = datetime.now()
        self.lock = asyncio.Lock()
        self.backoff_time = 1.0
        logger.info(f"Initialized rate limiter with {self.tokens_per_minute} tokens per minute")
    
    async def acquire(self, tokens_needed: int) -> bool:
        """
        Attempt to acquire tokens from the bucket.
        
        Args:
            tokens_needed: Number of tokens needed for the operation
            
        Returns:
            bool: True if tokens were acquired successfully
            
        Raises:
            RateLimitExceeded: If rate limit is exceeded and backoff is too high
        """
        async with self.lock:
            now = datetime.now()
            time_passed = (now - self.last_update).total_seconds()
            token_replenishment = time_passed * (self.tokens_per_minute / 60)
            
            self.tokens = min(self.tokens_per_minute, self.tokens + token_replenishment)
            self.last_update = now
            
            if self.tokens < tokens_needed:
                wait_time = max(((tokens_needed - self.tokens) * 60) / self.tokens_per_minute, self.backoff_time)
                
                if wait_time > 30:  # If wait time is too long, fail fast
                    logger.error(f"Rate limit exceeded. Required wait time: {wait_time}s")
                    raise RateLimitExceeded(
                        f"Rate limit exceeded. Please try again in {int(wait_time)} seconds"
                    )
                
                logger.warning(f"Rate limit prevention: waiting {wait_time} seconds")
                await asyncio.sleep(wait_time)
                self.backoff_time *= 1.5
                self.tokens = self.tokens_per_minute
            else:
                self.backoff_time = max(1.0, self.backoff_time * 0.9)
            
            self.tokens -= tokens_needed
            return True
    
    async def reset(self) -> None:
        """Reset the rate limiter state."""
        async with self.lock:
            self.tokens = self.tokens_per_minute
            self.last_update = datetime.now()
            self.backoff_time = 1.0
            logger.info("Rate limiter reset") 
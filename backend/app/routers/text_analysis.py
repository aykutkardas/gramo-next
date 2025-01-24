import logging
from fastapi import APIRouter, HTTPException
from ..models.text_analysis import TextAnalysisRequest, TextAnalysisResponse
from ..services.writing_agent import WritingAgent
from ..utils.rate_limiter import RateLimitExceeded

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/text",
    tags=["text-analysis"],
    responses={404: {"description": "Not found"}},
)

writing_agent = WritingAgent()

@router.post("/analyze", response_model=TextAnalysisResponse)
async def analyze_text(request: TextAnalysisRequest):
    """
    Analyze text for grammar, style, and structure improvements.
    
    Args:
        request: Text analysis request containing text and analysis preferences
        
    Returns:
        TextAnalysisResponse: Analysis results and improvements
        
    Raises:
        HTTPException: If analysis fails or rate limit is exceeded
    """
    try:
        logger.info("Received text analysis request")
        result = await writing_agent.analyze_text(
            text=request.text,
            style=request.style,
            focus_areas=request.focus_areas
        )
        logger.info("Text analysis completed successfully")
        return result
        
    except RateLimitExceeded as e:
        logger.error(f"Rate limit exceeded: {str(e)}")
        raise HTTPException(
            status_code=429,
            detail=str(e)
        )
    except ValueError as e:
        logger.error(f"Invalid request: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error during text analysis: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

@router.get("/health")
async def health_check():
    """Check the health of the text analysis service."""
    return {"status": "healthy"} 
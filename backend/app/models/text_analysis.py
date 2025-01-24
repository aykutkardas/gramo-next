from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class TextStats(BaseModel):
    word_count: int
    sentence_count: int
    avg_word_length: float
    avg_sentence_length: float
    readability_score: float

class ToneAnalysis(BaseModel):
    primary_tone: str
    tone_scores: Dict[str, float]

class GrammarIssue(BaseModel):
    type: str
    text: str
    correction: str
    explanation: str

class StyleSuggestion(BaseModel):
    aspect: str
    current: str
    improvement: str
    rationale: str

class StructureIssue(BaseModel):
    type: str
    location: str
    suggestion: str
    rationale: str

class Analysis(BaseModel):
    grammar: Optional[Dict] = None
    style: Optional[Dict] = None
    structure: Optional[Dict] = None

class TextAnalysisRequest(BaseModel):
    text: str
    style: str = Field(default="professional", description="The desired writing style")
    focus_areas: List[str] = Field(
        default=["grammar", "style", "structure"],
        description="Areas to focus on during analysis"
    )

class TextAnalysisResponse(BaseModel):
    original_text: str
    improved_text: str
    text_stats: TextStats
    tone_analysis: ToneAnalysis
    analysis: Analysis
    improvements: List[str] = [] 
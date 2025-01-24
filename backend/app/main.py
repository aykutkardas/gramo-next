import os
import json
import logging
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import litellm
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

def calculate_text_stats(text: str) -> dict:
    """Calculate basic text statistics."""
    words = re.findall(r'\b\w+\b', text.lower())
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    
    # Calculate average word length
    avg_word_length = sum(len(word) for word in words) / len(words) if words else 0
    
    # Calculate average sentence length
    avg_sentence_length = len(words) / len(sentences) if sentences else 0
    
    # Calculate readability score based on multiple factors
    word_complexity = sum(1 for word in words if len(word) > 6) / len(words) if words else 0
    sentence_complexity = sum(1 for s in sentences if len(s.split()) > 15) / len(sentences) if sentences else 0
    
    # Adjusted readability score with more reasonable weights
    readability_score = 100 - (
        (0.2 * avg_sentence_length) +  # Reduced from 0.39
        (5.0 * avg_word_length) +      # Reduced from 11.8
        (8.0 * word_complexity) +      # Reduced from 15.59
        (6.0 * sentence_complexity)    # Reduced from 10.0
    )
    readability_score = max(0, min(100, readability_score))
    
    return {
        "word_count": len(words),
        "sentence_count": len(sentences),
        "avg_word_length": round(avg_word_length, 1),
        "avg_sentence_length": round(avg_sentence_length, 1),
        "readability_score": round(readability_score, 1)
    }

def analyze_writing_tone(text: str) -> dict:
    """Analyze the writing tone based on comprehensive patterns."""
    text = text.lower()
    
    tone_patterns = {
        "formal": [
            r'\b(therefore|furthermore|consequently|thus|hence|accordingly)\b',
            r'\b(moreover|nevertheless|however|despite|although|whereas)\b',
            r'\b(demonstrate|indicate|suggest|conclude|analyze|determine)\b'
        ],
        "casual": [
            r'\b(like|just|pretty|kind of|sort of|you know)\b',
            r'\b(anyway|basically|actually|literally|stuff|things)\b',
            r'\b(cool|awesome|nice|great|okay|ok)\b',
            r'!{2,}|\?{2,}',  # Multiple exclamation/question marks
        ],
        "technical": [
            r'\b(specifically|particularly|significantly|methodology|implementation)\b',
            r'\b(system|process|function|data|analysis|result)\b',
            r'\b(configure|implement|integrate|optimize|validate)\b'
        ],
        "friendly": [
            r'\b(thanks|please|appreciate|welcome|glad|happy)\b',
            r'\b(love|enjoy|feel|think|believe|hope)\b',
            r'\b(we|our|us|together|share|help)\b',
            r'(?:^|\s)(?::\)|:\(|;\)|\(:)(?:\s|$)',  # Basic emoticons
        ]
    }
    
    tone_scores = {}
    total_weight = 0
    
    for tone, patterns in tone_patterns.items():
        score = 0
        for pattern in patterns:
            matches = len(re.findall(pattern, text, re.IGNORECASE))
            score += matches
        
        # Apply contextual weighting
        if tone == "formal":
            score *= 1.2  # Give slightly more weight to formal indicators
        elif tone == "technical":
            score *= 1.1  # Technical terms are strong indicators
            
        tone_scores[tone] = score
        total_weight += score
    
    # Normalize scores to percentages with a minimum baseline
    baseline = 0.1  # Ensure some minimal presence of each tone
    for tone in tone_scores:
        if total_weight > 0:
            tone_scores[tone] = round((tone_scores[tone] / total_weight * 80) + (baseline * 20))
        else:
            tone_scores[tone] = 25  # Equal distribution if no patterns found
    
    # Determine primary tone with confidence threshold
    primary_tone = max(tone_scores.items(), key=lambda x: x[1])[0]
    if max(tone_scores.values()) < 30:
        primary_tone = "balanced"  # If no tone is dominant enough
    
    return {
        "primary_tone": primary_tone,
        "tone_scores": tone_scores
    }

class TokenBucketRateLimiter:
    def __init__(self, tokens_per_minute=3000):
        self.tokens_per_minute = tokens_per_minute
        self.tokens = tokens_per_minute
        self.last_update = datetime.now()
        self.lock = asyncio.Lock()
        self.backoff_time = 1.0
    
    async def acquire(self, tokens_needed):
        async with self.lock:
            now = datetime.now()
            time_passed = (now - self.last_update).total_seconds()
            token_replenishment = time_passed * (self.tokens_per_minute / 60)
            self.tokens = min(self.tokens_per_minute, self.tokens + token_replenishment)
            self.last_update = now
            
            if self.tokens < tokens_needed:
                wait_time = max(((tokens_needed - self.tokens) * 60) / self.tokens_per_minute, self.backoff_time)
                logger.warning(f"Rate limit prevention: waiting {wait_time} seconds")
                await asyncio.sleep(wait_time)
                self.backoff_time *= 1.5
                self.tokens = self.tokens_per_minute
            else:
                self.backoff_time = max(1.0, self.backoff_time * 0.9)
            
            self.tokens -= tokens_needed
            return True

class WritingAgent:
    def __init__(self):
        self.grammar_agent = {
            "role": "system",
            "content": """You are a Grammar Analysis Agent specialized in identifying and correcting text issues.

TASK:
Analyze the text and provide detailed feedback on grammar, spelling, and punctuation.

OUTPUT FORMAT:
Return a JSON object with this structure:
{
    "analysis": {
        "issues": [
            {
                "type": "grammar/spelling/punctuation",
                "text": "problematic text",
                "correction": "suggested correction",
                "explanation": "why this needs correction"
            }
        ],
        "improved_text": "complete corrected version of the text",
        "confidence_score": 0-100
    }
}"""
        }

        self.style_agent = {
            "role": "system",
            "content": """You are a Style Analysis Agent focused on improving writing clarity and impact.

TASK:
Analyze the text's style, tone, and readability.

OUTPUT FORMAT:
Return a JSON object with this structure:
{
    "analysis": {
        "style_score": 0-100,
        "tone": "formal/informal/technical/casual",
        "suggestions": [
            {
                "aspect": "clarity/conciseness/tone/etc",
                "current": "current problematic text",
                "improvement": "suggested improvement",
                "rationale": "why this improvement helps"
            }
        ],
        "improved_text": "complete improved version"
    }
}"""
        }

        self.editor_agent = {
            "role": "system",
            "content": """You are an Editor Agent specializing in text structure and organization.

TASK:
Analyze the text's structure, flow, and organization.

OUTPUT FORMAT:
Return a JSON object with this structure:
{
    "analysis": {
        "structure_score": 0-100,
        "flow_issues": [
            {
                "type": "transition/paragraph/organization",
                "location": "problematic section",
                "suggestion": "improvement suggestion",
                "rationale": "why this improves the text"
            }
        ],
        "improved_text": "complete restructured version"
    }
}"""
        }

    async def analyze_text(self, text, style=None, focus_areas=None):
        result = {
            "original_text": text,
            "improved_text": text,
            "text_stats": calculate_text_stats(text),
            "tone_analysis": analyze_writing_tone(text),
            "analysis": {
                "grammar": None,
                "style": None,
                "structure": None
            },
            "improvements": []
        }

        try:
            if "grammar" in (focus_areas or []):
                grammar_response = await self._process_with_agent(
                    self.grammar_agent,
                    f"Analyze this text and provide detailed grammar feedback: {text}"
                )
                if grammar_response and isinstance(grammar_response, dict):
                    result["analysis"]["grammar"] = grammar_response.get("analysis", {})
                    if "improved_text" in grammar_response.get("analysis", {}):
                        result["improved_text"] = grammar_response["analysis"]["improved_text"]

            if "style" in (focus_areas or []):
                style_prompt = f"Analyze this text for style improvements with focus on {style or 'clarity'}: {result['improved_text']}"
                style_response = await self._process_with_agent(self.style_agent, style_prompt)
                if style_response and isinstance(style_response, dict):
                    result["analysis"]["style"] = style_response.get("analysis", {})
                    if "improved_text" in style_response.get("analysis", {}):
                        result["improved_text"] = style_response["analysis"]["improved_text"]

            if "structure" in (focus_areas or []):
                structure_prompt = f"Analyze this text for structural improvements: {result['improved_text']}"
                structure_response = await self._process_with_agent(self.editor_agent, structure_prompt)
                if structure_response and isinstance(structure_response, dict):
                    result["analysis"]["structure"] = structure_response.get("analysis", {})
                    if "improved_text" in structure_response.get("analysis", {}):
                        result["improved_text"] = structure_response["analysis"]["improved_text"]

            # Collect all improvements
            if result["analysis"]["grammar"]:
                result["improvements"].extend([{
                    "type": "grammar",
                    "issue": issue["text"],
                    "correction": issue["correction"],
                    "explanation": issue["explanation"]
                } for issue in result["analysis"]["grammar"].get("issues", [])])

            if result["analysis"]["style"]:
                result["improvements"].extend([{
                    "type": "style",
                    "aspect": sugg["aspect"],
                    "current": sugg["current"],
                    "improvement": sugg["improvement"],
                    "rationale": sugg["rationale"]
                } for sugg in result["analysis"]["style"].get("suggestions", [])])

            if result["analysis"]["structure"]:
                result["improvements"].extend([{
                    "type": "structure",
                    "issue": issue["location"],
                    "suggestion": issue["suggestion"],
                    "rationale": issue["rationale"]
                } for issue in result["analysis"]["structure"].get("flow_issues", [])])

            # Generate more specific and actionable suggestions
            suggestions = []
            if "grammar" in focus_areas:
                grammar_suggestions = []
                for issue in result["analysis"]["grammar"].get("issues", []):
                    suggestion = {
                        "type": "Grammar",
                        "description": f"Issue with {issue['type'].lower()}",
                        "pros": ["Easy to fix", "Will improve clarity"],
                        "cons": ["May require restructuring the sentence"],
                        "implementation": f"Suggested correction: {issue['explanation']}"
                    }
                    grammar_suggestions.append(suggestion)
                suggestions.extend(grammar_suggestions)

            if "style" in focus_areas:
                style_suggestions = []
                # Add style-specific suggestions based on tone analysis
                if result["tone_analysis"]["primary_tone"] != style:
                    suggestion = {
                        "type": "Style",
                        "description": f"Text tone doesn't match desired {style} style",
                        "pros": ["Will better match intended audience", "Improves communication effectiveness"],
                        "cons": ["May require vocabulary adjustments"],
                        "implementation": f"Consider using more {style}-appropriate language and phrasing"
                    }
                    style_suggestions.append(suggestion)
                style_suggestions.extend([s for s in result["analysis"]["style"].get("suggestions", [])])
                suggestions.extend(style_suggestions)

            # Generate more specific proactive feedback
            proactive_feedback = []
            if result["text_stats"]["readability_score"] < 70:
                proactive_feedback.append({
                    "type": "Readability",
                    "description": "Text could be more readable",
                    "suggestion": "Consider using shorter sentences and simpler words",
                    "area": "structure"
                })
            
            if result["text_stats"]["avg_sentence_length"] > 20:
                proactive_feedback.append({
                    "type": "Sentence Length",
                    "description": "Some sentences are too long",
                    "suggestion": "Break down longer sentences into smaller, clearer ones",
                    "area": "structure"
                })

            # Calculate more accurate goal achievement metrics
            total_issues = len(result["analysis"]["grammar"].get("issues", [])) + len(result["analysis"]["style"].get("suggestions", []))
            achievement_score = 100 - (total_issues * 10)  # Deduct points for each issue
            achievement_score = max(0, min(100, achievement_score))  # Clamp between 0-100

            remaining_steps = []
            if result["analysis"]["grammar"].get("issues", []):
                remaining_steps.append("Fix grammar and spelling issues")
            if result["analysis"]["style"].get("suggestions", []):
                remaining_steps.append("Address style improvement suggestions")
            if result["text_stats"]["readability_score"] < 70:
                remaining_steps.append("Improve overall readability")

            return {
                "grammar_issues": result["analysis"]["grammar"].get("issues", []),
                "suggestions": suggestions,
                "style_feedback": result["analysis"]["style"],
                "improved_text": result["improved_text"],
                "proactive_feedback": proactive_feedback,
                "goal_achievement": {
                    "achieved": achievement_score >= 80,
                    "score": achievement_score,
                    "remaining_steps": remaining_steps
                },
                "text_stats": result["text_stats"],
                "tone_analysis": result["tone_analysis"]
            }

        except Exception as e:
            logger.error(f"Error in analyze_text: {str(e)}")
            return result

    async def _process_with_agent(self, agent, prompt):
        try:
            messages = [
                agent,
                {"role": "user", "content": prompt}
            ]
            
            response = await litellm.acompletion(
                model="groq/mixtral-8x7b-32768",
                messages=messages,
                temperature=0.7,
                max_tokens=4000,
                api_key=os.getenv("GROQ_API_KEY")
            )
            
            if not response or not response.choices:
                logger.error("Empty response from Groq API")
                return None
                
            content = response.choices[0].message.content
            
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                logger.warning("Response was not valid JSON")
                return None
                
        except Exception as e:
            logger.error(f"Error in _process_with_agent: {str(e)}")
            return None

class TextRequest(BaseModel):
    text: str
    style: Optional[str] = "professional"
    focus_areas: Optional[List[str]] = ["grammar", "style", "structure"]

app = FastAPI()
writing_agent = WritingAgent()
rate_limiter = TokenBucketRateLimiter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def analyze_text(request: TextRequest):
    if not request.text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
        
    try:
        # Truncate input text if it's too long
        max_input_length = 2000
        text = request.text
        if len(text) > max_input_length:
            logger.warning(f"Input text truncated from {len(text)} to {max_input_length} characters")
            text = text[:max_input_length] + "..."
            
        await rate_limiter.acquire(100)  # Estimate token usage
        
        result = await writing_agent.analyze_text(
            text=text,
            style=request.style,
            focus_areas=request.focus_areas
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
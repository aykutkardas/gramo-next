import logging
import json
from typing import Dict, Optional, List
import litellm
from ..utils.text_analysis import calculate_text_stats, analyze_writing_tone
from ..utils.rate_limiter import TokenBucketRateLimiter, RateLimitExceeded
import os
import asyncio
import re

logger = logging.getLogger(__name__)

# Configure LiteLLM
litellm.set_verbose = False
litellm.success_callback = []
litellm.failure_callback = []

def clean_json_string(s: str) -> str:
    """Clean and prepare a string for JSON parsing."""
    try:
        # Remove code block markers
        if '```' in s:
            pattern = r'```(?:json)?(.*?)```'
            matches = re.findall(pattern, s, re.DOTALL)
            if matches:
                s = matches[0]
        
        # Remove any leading/trailing whitespace
        s = s.strip()
        
        # Fix invalid escape sequences
        s = re.sub(r'\\([^"\/bfnrtu\\])', r'\1', s)
        
        # Handle proper escape characters
        escapes = {
            '\\"': '"',     # Unescape quotes
            '\\n': '\n',    # Convert \n to newline
            '\\t': '\t',    # Convert \t to tab
            '\\\\': '\\',   # Handle escaped backslashes
            '\\/': '/',     # Handle escaped forward slashes
            '\\b': '\b',    # Handle backspace
            '\\f': '\f',    # Handle form feed
            '\\r': '\r'     # Handle carriage return
        }
        for escape_from, escape_to in escapes.items():
            s = s.replace(escape_from, escape_to)
        
        # Remove any BOM or special characters
        s = s.encode('utf-8', 'ignore').decode('utf-8')
        
        return s
    except Exception as e:
        logger.error(f"Error cleaning JSON string: {str(e)}")
        return s

class WritingAgent:
    """Service for analyzing and improving text using AI agents."""
    
    def __init__(self):
        self.rate_limiter = TokenBucketRateLimiter()
        
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

    async def analyze_text(
        self,
        text: str,
        style: Optional[str] = None,
        focus_areas: Optional[List[str]] = None
    ) -> Dict:
        """
        Analyze text using various AI agents.
        
        Args:
            text: The text to analyze
            style: Desired writing style
            focus_areas: List of areas to focus on during analysis
            
        Returns:
            Dict containing analysis results
            
        Raises:
            RateLimitExceeded: If rate limit is exceeded
            ValueError: If text is empty or invalid
        """
        if not text.strip():
            raise ValueError("Text cannot be empty")
            
        logger.info(f"Starting text analysis with focus areas: {focus_areas}")
        
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
                structure_response = await self._process_with_agent(
                    self.editor_agent,
                    f"Analyze this text for structural improvements: {result['improved_text']}"
                )
                if structure_response and isinstance(structure_response, dict):
                    result["analysis"]["structure"] = structure_response.get("analysis", {})
                    if "improved_text" in structure_response.get("analysis", {}):
                        result["improved_text"] = structure_response["analysis"]["improved_text"]

            # Collect improvements
            for area, analysis in result["analysis"].items():
                if analysis:
                    if area == "grammar" and "issues" in analysis:
                        for issue in analysis["issues"]:
                            result["improvements"].append(
                                f"Grammar: {issue['text']} -> {issue['correction']}"
                            )
                    elif area == "style" and "suggestions" in analysis:
                        for sugg in analysis["suggestions"]:
                            result["improvements"].append(
                                f"Style: {sugg['aspect']} - {sugg['improvement']}"
                            )
                    elif area == "structure" and "flow_issues" in analysis:
                        for issue in analysis["flow_issues"]:
                            result["improvements"].append(
                                f"Structure: {issue['suggestion']}"
                            )

            logger.info("Text analysis completed successfully")
            return result

        except RateLimitExceeded as e:
            logger.error(f"Rate limit exceeded during text analysis: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error during text analysis: {str(e)}")
            raise ValueError(f"Failed to analyze text: {str(e)}")

    async def _process_with_agent(self, agent: Dict, prompt: str) -> Optional[Dict]:
        """
        Process text with an AI agent.
        
        Args:
            agent: The agent configuration
            prompt: The prompt to send to the agent
            
        Returns:
            Dict containing agent's response or None if parsing fails
            
        Raises:
            RateLimitExceeded: If rate limit is exceeded
        """
        max_retries = 3
        base_delay = 3  # seconds
        
        for attempt in range(max_retries):
            try:
                # Estimate token usage (rough estimate)
                estimated_tokens = len(prompt.split()) + 500  # Add buffer for response
                await self.rate_limiter.acquire(estimated_tokens)
                
                messages = [
                    agent,
                    {"role": "user", "content": prompt}
                ]
                
                try:
                    response = await litellm.acompletion(
                        model="groq/mixtral-8x7b-32768",
                        messages=messages,
                        temperature=0.7,
                        max_tokens=1000,
                        api_key=os.getenv("GROQ_API_KEY")
                    )
                    
                    content = response.choices[0].message.content
                    logger.debug(f"Raw API response content: {content}")
                    
                    # Clean and prepare the content for JSON parsing
                    cleaned_content = clean_json_string(content)
                    logger.debug(f"Cleaned content: {cleaned_content}")
                    
                    # Try multiple parsing approaches
                    try:
                        # First try: direct JSON parsing
                        return json.loads(cleaned_content)
                    except json.JSONDecodeError as e1:
                        logger.warning(f"Initial JSON parsing failed: {str(e1)}")
                        try:
                            # Second try: handle potential string escaping
                            return json.loads(cleaned_content.encode('utf-8').decode('unicode-escape'))
                        except json.JSONDecodeError as e2:
                            logger.warning(f"Second JSON parsing attempt failed: {str(e2)}")
                            try:
                                # Third try: use ast.literal_eval
                                import ast
                                parsed = ast.literal_eval(cleaned_content)
                                if isinstance(parsed, dict):
                                    return parsed
                                logger.error("Parsed content is not a dictionary")
                            except Exception as e3:
                                logger.error(f"All parsing attempts failed: {str(e3)}")
                                logger.error(f"Problematic content: {cleaned_content}")
                                return None
                        
                except litellm.RateLimitError as e:
                    wait_time = base_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"Rate limit hit, attempt {attempt + 1}/{max_retries}. Waiting {wait_time}s")
                    await asyncio.sleep(wait_time)
                    continue
                    
            except Exception as e:
                logger.error(f"Error processing with agent: {str(e)}")
                if attempt < max_retries - 1:
                    wait_time = base_delay * (2 ** attempt)
                    logger.info(f"Retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                    await asyncio.sleep(wait_time)
                    continue
                return None
                
        logger.error("All retry attempts failed")
        return None 
from crewai import Agent, Task, Crew, Process
from groq import Groq
import os
import json
from typing import Any, Optional, Type, Callable
from pydantic import BaseModel, Field
from langchain_groq import ChatGroq
import time
from tenacity import retry, stop_after_attempt, wait_exponential
from litellm import completion, RateLimitError
import asyncio
from datetime import datetime, timedelta
import logging
import re
import litellm

logger = logging.getLogger(__name__)

class TokenBucketRateLimiter:
    def __init__(self, tokens_per_minute=3000):  # Increased from 1500
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
            self.tokens = min(
                self.tokens_per_minute,
                self.tokens + token_replenishment
            )
            self.last_update = now
            
            if self.tokens < tokens_needed:
                wait_time = max(
                    ((tokens_needed - self.tokens) * 60) / self.tokens_per_minute,
                    self.backoff_time
                )
                logger.warning(f"Rate limit prevention: waiting {wait_time} seconds")
                await asyncio.sleep(wait_time)
                self.backoff_time *= 1.5
                self.tokens = self.tokens_per_minute
            else:
                self.backoff_time = max(1.0, self.backoff_time * 0.9)
            
            self.tokens -= tokens_needed
            return True

class GroqAnalysisTool:
    """Tool for analyzing text using Groq API"""
    _rate_limiter = TokenBucketRateLimiter()
    
    def __init__(self, api_key: str, model: str):
        self.name = "analyze_with_groq"
        self.description = "Tool for analyzing text using Groq API"
        self.api_key = api_key
        self.model = "mixtral-8x7b-32768"  # Using consistent model
        self._last_request_time = 0
        self._min_request_interval = 1.0  # Reduced from 3.0
        self._consecutive_failures = 0
        self._max_tokens = 250  # Increased from 150
        
    async def _wait_for_rate_limit(self, estimated_tokens=100):  # Reduced from 150
        await self._rate_limiter.acquire(estimated_tokens)
        current_time = time.time()
        time_since_last_request = current_time - self._last_request_time
        
        if time_since_last_request < self._min_request_interval:
            await asyncio.sleep(self._min_request_interval - time_since_last_request)
        
        self._last_request_time = time.time()

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=2, min=4, max=20),
        reraise=True
    )
    async def _make_api_call(self, task_description: str) -> Any:
        try:
            await self._wait_for_rate_limit()
            
            # Use shorter system prompt
            response = await completion(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a JSON-only writing assistant."},
                    {"role": "user", "content": task_description}
                ],
                temperature=0.1,
                max_tokens=self._max_tokens,
                api_key=self.api_key
            )
            self._consecutive_failures = 0
            return response
            
        except RateLimitError as e:
            self._consecutive_failures += 1
            logger.warning(f"Rate limit hit, retrying with reduced tokens")
            self._max_tokens = max(100, self._max_tokens - 50)  # Reduce tokens on each retry
            raise
            
        except Exception as e:
            self._consecutive_failures += 1
            if "rate_limit" in str(e).lower():
                self._min_request_interval *= 1.5
            raise

    async def func(self, task_description: str) -> Any:
        try:
            # Try to batch the request
            batch_result = await self._rate_limiter.batch_requests({
                "task": task_description,
                "timestamp": time.time()
            })
            
            if batch_result:
                # Process the batch of requests
                responses = []
                for request in batch_result:
                    response = await self._make_api_call(request["task"])
                    if hasattr(response, 'choices'):
                        responses.append(response.choices[0].message.content)
                    else:
                        responses.append(response['choices'][0]['message']['content'])
                
                # Return the response for this specific request
                for response in responses:
                    try:
                        result = json.loads(response)
                        if isinstance(result, dict):
                            return result
                    except json.JSONDecodeError:
                        continue
            
            # If batching failed or this was the only request, process individually
            response = await self._make_api_call(task_description)
            if hasattr(response, 'choices'):
                return response.choices[0].message.content
            return response['choices'][0]['message']['content']
            
        except Exception as e:
            logger.error(f"Error in Groq API call: {str(e)}")
            return json.dumps({
                "error": str(e),
                "result": "Analysis failed"
            })

class WritingAgents:
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

    async def analyze_text(self, text, style=None, goal=None, focus_areas=None):
        """Analyze text using AI agents for comprehensive feedback."""
        result = {
            "original_text": text,
            "improved_text": text,
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
                structure_prompt = f"Analyze this text for structural improvements with goal: {goal or 'improve clarity'}: {result['improved_text']}"
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

            return result

        except Exception as e:
            logger.error(f"Error in analyze_text: {str(e)}")
            return result

    async def _process_with_agent(self, agent, prompt):
        """Process text with a specific agent using Groq API."""
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

class WritingTasks:
    @staticmethod
    def create_analysis_task(agent, text, style, goal=None, max_words=None):
        task_description = f"""Analyze and improve the following text:
        
{text}

Style requirement: {style}
{f'Goal: {goal}' if goal else ''}
{f'Word limit: {max_words} words' if max_words else ''}

Return a JSON object with the following structure:
{{
    "grammar_issues": [
        {{
            "type": "grammar/spelling/word-combination",
            "correction": "corrected text",
            "explanation": "explanation of the correction"
        }}
    ],
    "suggestions": [
        "suggestion for improving style"
    ],
    "structural_improvements": [
        "suggestion for improving structure"
    ],
    "goal_specific_recommendations": [
        "recommendation for achieving the goal"
    ],
    "improved_text": "complete improved version of the text"
}}"""
        
        expected_output = "A JSON string containing grammar issues, suggestions, structural improvements, goal-specific recommendations, and improved text"
        
        return Task(
            description=task_description,
            expected_output=expected_output,
            agent=agent
        )

    @staticmethod
    def create_refinement_task(agent, text, previous_analysis):
        task_description = f"""Review and refine the following text based on the previous analysis:
        
Text: {text}

Previous Analysis: {previous_analysis}

Return a JSON object with the following structure:
{{
    "style_improvements": [
        "suggestion for style improvement"
    ],
    "tone_adjustments": [
        "suggestion for tone adjustment"
    ],
    "refined_text": "complete refined version of the text",
    "additional_suggestions": [
        "additional improvement suggestion"
    ]
}}"""

        expected_output = "A JSON string containing style improvements, tone adjustments, refined text, and additional suggestions"

        return Task(
            description=task_description,
            expected_output=expected_output,
            agent=agent
        )

    @staticmethod
    def create_final_review_task(agent, original_text, improved_text, goal=None):
        task_description = f"""Perform a final review comparing the original and improved text:
        
Original: {original_text}
Improved: {improved_text}
{f'Goal: {goal}' if goal else ''}

Return a JSON object with the following structure:
{{
    "goal_achievement": {{
        "achieved": true/false,
        "score": 0-100,
        "remaining_steps": [
            "step needed to better achieve the goal"
        ]
    }},
    "style_feedback": {{
        "tone": "formal/informal/casual/friendly",
        "readability_score": 85,
        "complexity": "simple/moderate/complex",
        "sharpness": "clear/needs improvement/unclear",
        "fluency": "smooth/choppy/needs work",
        "intonation": "natural/monotone/varied",
        "style_suggestions": [
            "suggestion for improving style"
        ]
    }},
    "final_improvements": [
        "suggestion for final improvement"
    ],
    "overall_assessment": "overall assessment of the improvements"
}}"""

        expected_output = "A JSON string containing goal achievement metrics, style feedback, final improvements, and overall assessment"

        return Task(
            description=task_description,
            expected_output=expected_output,
            agent=agent
        )

class WritingCrew:
    def __init__(self):
        self.agents = WritingAgents()
        self._rate_limiter = TokenBucketRateLimiter(tokens_per_minute=3000)
        litellm.set_verbose = True

    async def analyze_text(self, text: str, style: str = "professional", goal: str = None, focus_areas: list[str] = None):
        try:
            # Truncate input text if it's too long
            max_input_length = 2000
            if len(text) > max_input_length:
                logger.warning(f"Input text truncated from {len(text)} to {max_input_length} characters")
                text = text[:max_input_length] + "..."

            # Initialize result with agents
            result = await self.agents.analyze_text(
                text=text,
                style=style,
                goal=goal,
                focus_areas=focus_areas or ["grammar", "style", "structure"]
            )

            if not result:
                logger.error("Failed to get analysis result")
                return self._get_default_response(text, "Failed to analyze text")

            # Verify improvements were made
            has_improvements = (
                len(result.get("analysis", {}).get("grammar", {}).get("issues", [])) > 0 or
                len(result.get("analysis", {}).get("style", {}).get("suggestions", [])) > 0 or
                len(result.get("analysis", {}).get("structure", {}).get("flow_issues", [])) > 0 or
                len(result.get("improvements", [])) > 0
            )

            if not has_improvements and text.strip() != result.get("improved_text", "").strip():
                logger.warning("Text was modified but no improvements were recorded")
                return self._get_default_response(text, "Analysis produced changes without recording improvements")

            return result

        except Exception as e:
            logger.error(f"Error in analyze_text: {str(e)}")
            return self._get_default_response(text, str(e))

    def _get_default_response(self, text, error=None):
        """Get a default response when analysis fails."""
        return {
            "original_text": text,
            "improved_text": text,
            "analysis": {
                "grammar": None,
                "style": None,
                "structure": None
            },
            "improvements": [],
            "error": str(error) if error else "Unknown error occurred"
        } 
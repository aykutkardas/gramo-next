import os
import json
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from groq import Groq

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in the .env file")

# Initialize Groq client
client = Groq(api_key=GROQ_API_KEY)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextAnalysisRequest(BaseModel):
    text: str
    style: str = "grammar"

@app.post("/analyze")
async def analyze_text(request: TextAnalysisRequest):
    """
    Analyze text for grammar, style, and provide improvements using Groq.
    """
    style_prompts = {
        "grammar": "Focus on fixing grammar and spelling issues while maintaining the original style.",
        "friendly": "Make the text more friendly and approachable while fixing any grammar issues.",
        "professional": "Make the text more formal and professional while fixing any grammar issues.",
        "concise": "Make the text more concise and clearer while fixing any grammar issues.",
    }

    style_instruction = style_prompts.get(request.style, style_prompts["grammar"])
    
    prompt = f"""You are a professional writing assistant. Your task is to analyze and improve the following text according to the specified style: {style_instruction}

Important: You must respond with a valid JSON object containing ONLY the following structure, with no additional text or explanations outside the JSON:

{{
    "grammar_issues": [
        {{
            "type": "grammar/spelling/word-combination",
            "position": {{
                "start": 0,
                "end": 0
            }},
            "original": "text with issue",
            "suggestion": "corrected text",
            "explanation": "brief explanation"
        }}
    ],
    "corrected_text": "text with all corrections and style adjustments applied",
    "suggestions": [
        "suggestion 1",
        "suggestion 2"
    ],
    "style_feedback": {{
        "tone": "formal/informal/casual/friendly",
        "readability_score": 85,
        "complexity": "simple/moderate/complex",
        "sharpness": "clear/needs improvement/unclear",
        "fluency": "smooth/choppy/needs work",
        "intonation": "natural/monotone/varied",
        "style_suggestions": [
            "style suggestion 1",
            "style suggestion 2"
        ]
    }}
}}

Text to analyze: {request.text}

Remember: Provide ONLY the JSON response with no additional text or explanations."""

    try:
        response = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional writing assistant that always responds with valid JSON. Never include any text outside the JSON structure."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="mixtral-8x7b-32768",
            temperature=0.1,
            max_tokens=2000,
            response_format={ "type": "json_object" }
        )

        try:
            result = json.loads(response.choices[0].message.content)
            # Ensure all required fields are present with valid values
            if not result.get("style_feedback"):
                result["style_feedback"] = {
                    "tone": "neutral",
                    "readability_score": 50,
                    "complexity": "moderate",
                    "sharpness": "clear",
                    "fluency": "smooth",
                    "intonation": "natural",
                    "style_suggestions": []
                }
            return result
        except json.JSONDecodeError as e:
            return {
                "error": f"Failed to parse response: {str(e)}",
                "grammar_issues": [],
                "corrected_text": request.text,
                "suggestions": ["Error analyzing text"],
                "style_feedback": {
                    "tone": "unknown",
                    "readability_score": 0,
                    "complexity": "unknown",
                    "sharpness": "unknown",
                    "fluency": "unknown",
                    "intonation": "unknown",
                    "style_suggestions": []
                }
            }
    except Exception as e:
        return {
            "error": f"API call failed: {str(e)}",
            "grammar_issues": [],
            "corrected_text": request.text,
            "suggestions": ["Service temporarily unavailable"],
            "style_feedback": {
                "tone": "unknown",
                "readability_score": 0,
                "complexity": "unknown",
                "sharpness": "unknown",
                "fluency": "unknown",
                "intonation": "unknown",
                "style_suggestions": []
            }
        }

@app.get("/health")
async def root():
    return {"message": "Welcome to Gramo API"}
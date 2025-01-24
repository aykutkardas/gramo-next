import re
from typing import Dict

def calculate_text_stats(text: str) -> dict:
    """Calculate basic text statistics."""
    words = re.findall(r'\b\w+\b', text.lower())
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    
    avg_word_length = sum(len(word) for word in words) / len(words) if words else 0
    avg_sentence_length = len(words) / len(sentences) if sentences else 0
    
    word_complexity = sum(1 for word in words if len(word) > 6) / len(words) if words else 0
    sentence_complexity = sum(1 for s in sentences if len(s.split()) > 15) / len(sentences) if sentences else 0
    
    readability_score = 100 - (
        (0.2 * avg_sentence_length) +
        (5.0 * avg_word_length) +
        (8.0 * word_complexity) +
        (6.0 * sentence_complexity)
    )
    readability_score = max(0, min(100, readability_score))
    
    return {
        "word_count": len(words),
        "sentence_count": len(sentences),
        "avg_word_length": round(avg_word_length, 1),
        "avg_sentence_length": round(avg_sentence_length, 1),
        "readability_score": round(readability_score, 1)
    }

def analyze_writing_tone(text: str) -> Dict:
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
            r'!{2,}|\?{2,}'
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
            r'(?:^|\s)(?::\)|:\(|;\)|\(:)(?:\s|$)'
        ]
    }
    
    tone_scores = {}
    total_weight = 0
    
    for tone, patterns in tone_patterns.items():
        score = 0
        for pattern in patterns:
            matches = len(re.findall(pattern, text, re.IGNORECASE))
            score += matches
        
        if tone == "formal":
            score *= 1.2
        elif tone == "technical":
            score *= 1.1
            
        tone_scores[tone] = score
        total_weight += score
    
    baseline = 0.1
    for tone in tone_scores:
        if total_weight > 0:
            tone_scores[tone] = round((tone_scores[tone] / total_weight * 80) + (baseline * 20))
        else:
            tone_scores[tone] = 25
    
    primary_tone = max(tone_scores.items(), key=lambda x: x[1])[0]
    if max(tone_scores.values()) < 30:
        primary_tone = "balanced"
    
    return {
        "primary_tone": primary_tone,
        "tone_scores": tone_scores
    } 
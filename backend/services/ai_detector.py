"""
AI Detector Service — Checks if emails sound robotic and rewrites them
"""
import logging
import re

logger = logging.getLogger(__name__)

# Red flag phrases that indicate AI-generated text
_RED_FLAGS = [
    r"i hope this (email|message|note) finds you well",
    r"i (wanted|am writing|am reaching out) to",
    r"i trust you(\'re| are) doing well",
    r"please do not hesitate to",
    r"i would like to (take this opportunity|bring to your attention)",
    r"it has come to my attention",
    r"as per our (previous|last) (communication|conversation|email)",
    r"kindly (note|be informed|revert|confirm)",
    r"dear (sir|ma'am|valued|esteemed)",
    r"i am (pleased|delighted|happy) to inform you",
    r"in (light|view) of (the foregoing|the above)",
    r"warm regards|best regards|yours sincerely",
    r"leverage|synerg|paradigm|holistic approach",
    r"circling back|touch base|ping you|reach out",
]


def _ai_score(text: str) -> float:
    """
    Returns a score 0.0 (human) to 1.0 (very AI-like).
    Based on red-flag phrase detection + structural analysis.
    """
    text_lower = text.lower()
    hits = 0
    for pattern in _RED_FLAGS:
        if re.search(pattern, text_lower):
            hits += 1

    # Additional checks
    words = text.split()
    avg_word_len = sum(len(w) for w in words) / len(words) if words else 0
    sentences = re.split(r'[.!?]+', text)
    sentence_lengths = [len(s.split()) for s in sentences if s.strip()]
    # Very uniform sentence lengths = AI-like
    length_variance = (
        max(sentence_lengths) - min(sentence_lengths)
        if len(sentence_lengths) > 1 else 0
    )
    uniformity_penalty = 0.1 if length_variance < 3 and len(sentence_lengths) > 2 else 0

    score = min(1.0, (hits / max(len(_RED_FLAGS), 1)) * 2 + uniformity_penalty)
    return round(score, 3)


def _rewrite_via_claude(client, text: str) -> str:
    """Use Claude to rewrite the email to sound more human."""
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": (
                "Rewrite this cold email to sound more like a real human wrote it. "
                "Rules: Remove any robotic phrases. Vary sentence length. "
                "Make it feel personal and casual-professional. "
                "Keep the same message and length. "
                "Do NOT add any commentary — just return the rewritten email.\n\n"
                f"Original email:\n{text}"
            )
        }],
        system=(
            "You are a human-sounding email editor. "
            "You never use corporate buzzwords or AI-sounding phrases. "
            "Your output is ONLY the rewritten email, nothing else."
        ),
    )
    return response.content[0].text.strip()


def check_and_rewrite(client, body: str, threshold: float = 0.3) -> tuple:
    """
    Check if email sounds AI-generated. If score > threshold, rewrite.
    Returns: (final_body, ai_score, was_rewritten)
    """
    try:
        score = _ai_score(body)
        if score > threshold:
            logger.info(f"🤖 AI score {score} > threshold {threshold} — rewriting")
            rewritten = _rewrite_via_claude(client, body)
            return rewritten, score, True
        return body, score, False
    except Exception as e:
        logger.warning(f"⚠️ AI detector error: {e} — using original")
        return body, 0.0, False

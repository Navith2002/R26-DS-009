"""Bounded retries shared by spelling and both grammar languages."""
import logging
import os
import time

logger = logging.getLogger(__name__)
DEFAULT_MODEL = "gemini-3.6-flash"
TRANSIENT_CODES = {429, 500, 502, 503, 504}


def configured_model():
    return os.environ.get("GEMINI_MODEL", "").strip() or DEFAULT_MODEL


def _available_fallback(client, current):
    """Use only text models advertised by Google for this client's key."""
    try:
        candidates = []
        for entry in client.models.list():
            name = (entry.name or "").removeprefix("models/")
            actions = entry.supported_actions or []
            if (name != current.removeprefix("models/")
                    and "flash" in name and "generateContent" in actions
                    and not any(tag in name for tag in (
                        "preview", "exp", "image", "audio", "live", "tts"))):
                candidates.append(name)
        # Prefer the established text Flash model when the account offers it.
        candidates.sort(key=lambda name: (name != "gemini-2.5-flash", name))
        return candidates[0] if candidates else None
    except Exception:
        return None


def generate_content(client, *, model, contents):
    # No tools are used for correction. Disable automatic function calling
    # explicitly, avoiding the SDK's AFC warning for generate_content.
    for attempt in range(3):
        try:
            return client.models.generate_content(
                model=model,
                contents=contents,
                config={"automatic_function_calling": {"disable": True}},
            )
        except Exception as exc:
            code = getattr(exc, "code", None)
            try:
                code = int(code)
            except (TypeError, ValueError):
                code = None
            if attempt == 2 and code in {500, 502, 503, 504}:
                fallback = _available_fallback(client, model)
                if fallback:
                    logger.warning("Gemini model unavailable; trying an available text Flash model")
                    return client.models.generate_content(
                        model=fallback, contents=contents,
                        config={"automatic_function_calling": {"disable": True}},
                    )
            if code not in TRANSIENT_CODES or attempt == 2:
                raise
            # Log only the status code, never request text or API credentials.
            logger.warning("Gemini HTTP %s; retrying (%s/2)", code, attempt + 1)
            time.sleep(2 ** attempt)

"""Bounded retries shared by spelling and both grammar languages."""
import logging
import os
import time

logger = logging.getLogger(__name__)
DEFAULT_MODEL = "gemini-3.6-flash"
TRANSIENT_CODES = {429, 500, 502, 503, 504}


def configured_model():
    return os.environ.get("GEMINI_MODEL", "").strip() or DEFAULT_MODEL


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
            if code not in TRANSIENT_CODES or attempt == 2:
                raise
            # Log only the status code, never request text or API credentials.
            logger.warning("Gemini HTTP %s; retrying (%s/2)", code, attempt + 1)
            time.sleep(2 ** attempt)

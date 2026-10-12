"""
reading_error_router.py
========================

Mounts the reading-error-detection component (backend/reading_error/
main.py -- its own full FastAPI app, audio-based, Whisper + jiwer WER/CER)
onto the shared app at /reading-error, instead of running it as its own
process/port the way it originally would have.

Full ASGI mount (app.mount() in backend/app.py), same as
fluency_router.py and for the same reason -- that module's routes are
already decorated directly on its own FastAPI() instance, so mounting the
whole app reuses it as-is with no route-by-route rewrite. Unlike
fluency_profiling, this module has no @app.on_event("startup") handler
(its Whisper models load lazily on first /predict call, not at startup --
see load_model() in reading_error/main.py), so there's no startup-event
propagation to do here the way fluency_router.py's register_fluency_startup
does.

Imported under a unique module name ("reading_error_main"), not "main" --
grammar_check/main.py and fluency_profiling/main.py both also live on
sys.path elsewhere in this process, and a plain `import main` would
silently resolve to whichever "main" module Python's import cache
happened to see first. importlib with an explicit spec name sidesteps
that entirely.
"""
import os
import sys
import importlib.util

_READING_ERROR_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "reading_error",
)
if _READING_ERROR_DIR not in sys.path:
    sys.path.insert(0, _READING_ERROR_DIR)

_spec = importlib.util.spec_from_file_location(
    "reading_error_main", os.path.join(_READING_ERROR_DIR, "main.py")
)
reading_error_main = importlib.util.module_from_spec(_spec)
sys.modules["reading_error_main"] = reading_error_main
_spec.loader.exec_module(reading_error_main)

app = reading_error_main.app  # the full FastAPI app that module builds

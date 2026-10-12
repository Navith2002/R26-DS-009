"""
fluency_router.py
==================

Mounts the reading-fluency-profiling component (backend/fluency_profiling/
backend/main.py -- its own full FastAPI app, audio-based, with real
startup-time model loading: Whisper + a Random Forest + scalers) onto the
shared app at /fluency, instead of running it as its own process/port the
way it originally would have.

This is a full ASGI mount (app.mount in backend/app.py), not an APIRouter
the way grammar_router.py wraps grammar_check/ -- that module's routes are
already decorated directly on its own FastAPI() instance with real
startup-time work, so mounting the whole app reuses it as-is with no
route-by-route rewrite.

Imported under a unique module name ("fluency_main"), not "main" --
grammar_check/main.py also lives on sys.path elsewhere in this process
(imported the same way by grammar_router.py used to; even though that
router no longer imports it directly, other tooling might), and a plain
`import main` would silently resolve to whichever "main" module Python's
import cache happened to see first. importlib with an explicit spec name
sidesteps that entirely.
"""
import os
import sys
import importlib.util

_FLUENCY_BACKEND_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "fluency_profiling",
)
if _FLUENCY_BACKEND_DIR not in sys.path:
    sys.path.insert(0, _FLUENCY_BACKEND_DIR)

_spec = importlib.util.spec_from_file_location(
    "fluency_main", os.path.join(_FLUENCY_BACKEND_DIR, "main.py")
)
fluency_main = importlib.util.module_from_spec(_spec)
sys.modules["fluency_main"] = fluency_main
_spec.loader.exec_module(fluency_main)

app = fluency_main.app  # the full FastAPI app that module builds


def register_fluency_startup(root_app):
    """
    Re-registers this sub-app's own startup handlers (Whisper + sklearn
    model loading) onto the root app.

    FastAPI/Starlette's app.mount() does NOT automatically fire a mounted
    sub-app's own @app.on_event("startup") handlers when the ROOT app
    starts -- uvicorn only sends the ASGI lifespan "startup" message to
    the root application; propagating it to mounted sub-apps is left to
    the root app to do itself. Without this, fluency_main.store.ready
    would stay False forever and every /fluency endpoint would 503.

    FastAPI.add_event_handler() was removed as of fastapi==0.141 (the
    version pinned in this shared venv) -- appending directly to the root
    router's own on_startup list is the one part of the old on_event
    mechanism still present (Starlette's default lifespan reads this list
    when the ASGI lifespan "startup" message arrives, same as it always
    has; only the FastAPI-level convenience wrapper method is gone).
    """
    root_app.router.on_startup.extend(app.router.on_startup)

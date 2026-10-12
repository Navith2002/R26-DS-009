"""
grammar_router.py
==================

The spelling/grammar-check (Sinhala/Tamil handwriting-recognition) pipeline,
wrapped as an APIRouter mounted under /grammar on the main app (app.py) --
instead of running as its own FastAPI app on its own port/venv, the way
grammar_check/main.py originally did as a standalone service.

grammar_check/'s modules (pipeline.py, grammar_module.py, hybrid_corrector.py,
etc.) import each other by plain top-level name, e.g.
`from grammar_module import build_sentences` in pipeline.py -- so
grammar_check/ is added to sys.path below, the same way running
`python main.py` from inside that directory would put it on the path
implicitly. Do this before importing anything from pipeline.
"""
import os
import sys
import tempfile
import traceback
from pathlib import Path

_GRAMMAR_CHECK_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "grammar_check")
if _GRAMMAR_CHECK_DIR not in sys.path:
    sys.path.insert(0, _GRAMMAR_CHECK_DIR)

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from pipeline import analyze_page, LOCAL_MODEL_DIR, MODEL_DIRS, DEVICE, GEMINI_KEY

router = APIRouter(prefix="/grammar", tags=["grammar-check"])


@router.post("/analyze")
async def analyze(image: UploadFile = File(...), language: str = Form("si")):
    suffix = Path(image.filename or "").suffix or ".png"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await image.read())
        tmp_path = tmp.name
    try:
        result = analyze_page(tmp_path, language=language)
        return result
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@router.get("/health")
def health():
    model_ready = Path(LOCAL_MODEL_DIR).exists() and \
                  (Path(LOCAL_MODEL_DIR) / "config.json").exists()
    models_ready = {
        lang: Path(d).exists() and (Path(d) / "config.json").exists()
        for lang, d in MODEL_DIRS.items()
    }
    return {
        "status": "ok",
        "device": DEVICE,
        "model_dir": LOCAL_MODEL_DIR,       # kept for old clients -- Sinhala model dir
        "model_ready": model_ready,          # kept for old clients -- Sinhala readiness
        "models": MODEL_DIRS,                # {"si": ..., "ta": ...}
        "models_ready": models_ready,        # {"si": bool, "ta": bool}
        "llm_ready": bool(GEMINI_KEY),
    }

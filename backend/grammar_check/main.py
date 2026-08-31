# NOTE: superseded as the way this component actually runs. The app now
# starts from ../app.py (the shared entrypoint, single venv, port 8000),
# which mounts these same /analyze and /health routes under /grammar via
# ../grammar_router.py. This file is kept only as a standalone way to run
# just this component on its own (e.g. `python main.py`, port 6060) if
# you ever need to isolate it again.
import os
import sys
import tempfile

# Windows consoles default to a legacy codepage (cp1252) that can't encode
# the emoji used in the startup banner / pipeline prints below -- reconfigure
# stdout/stderr to UTF-8 so `python main.py` (and anything piped from it)
# doesn't crash before the server even starts.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
import traceback
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from pipeline import analyze_page, LOCAL_MODEL_DIR, MODEL_DIRS, DEVICE, GEMINI_KEY

app = FastAPI(title="Sinhala/Tamil HTR Pipeline")

# Mirrors the old flask_cors CORS(app) default: allow every origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/analyze")
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


@app.get("/health")
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
        "model_dir": LOCAL_MODEL_DIR,     # kept for old clients -- Sinhala model dir
        "model_ready": model_ready,        # kept for old clients -- Sinhala readiness
        "models": MODEL_DIRS,              # {"si": ..., "ta": ...}
        "models_ready": models_ready,      # {"si": bool, "ta": bool}
        "llm_ready": bool(GEMINI_KEY),
    }


if __name__ == "__main__":
    import asyncio
    import uvicorn

    if not (Path(LOCAL_MODEL_DIR) / "config.json").exists():
        print("❌ Model not found. Run first:")
        print("   python pipeline.py download")
    else:
        print("\n" + "=" * 55)
        print("  Sinhala/Tamil HTR Pipeline — FastAPI")
        print("=" * 55)
        print("  API       : http://localhost:6060")
        print("  POST /analyze — upload image")
        print("  GET  /health  — check status")
        print(f"  Device    : {DEVICE}")
        print(f"  LLM       : {'✅ Gemini' if GEMINI_KEY else '⚠️  No API key (correction disabled)'}")
        print("=" * 55 + "\n")

        config = uvicorn.Config("main:app", host="0.0.0.0", port=6060, reload=False)
        server = uvicorn.Server(config)
        # NOTE: deliberately not uvicorn.run()/asyncio.run() here -- this
        # machine's installed Python has a corrupted Lib/asyncio/runners.py
        # (the `with Runner(...)` block is mis-indented one level too deep,
        # inside the preceding `if`, after an unconditional `raise`, making
        # it unreachable) so asyncio.run() silently no-ops instead of
        # running the event loop. Driving the loop manually sidesteps that
        # broken stdlib function entirely. See the module docstring above.
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(server.serve())
        finally:
            loop.close()

"""
app.py
======

FastAPI entry point for the audited bilingual Handwriting Quality Analysis API.

POST /analyze
multipart/form-data:
    image: UploadFile
    language: sinhala | tamil
"""

import os
import re
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv

# Must run before any of this project's own modules are imported below --
# grammar_check/pipeline.py reads GEMINI_API_KEY/ANTHROPIC_API_KEY from
# os.environ at *module import time* (via `from grammar_router import
# ...` a few lines down), so .env has to be loaded first or those come
# back empty. Pointed at this file's own directory (not left to load_dotenv's
# cwd-based search) so `uvicorn app:app` works the same regardless of
# where it's launched from.
load_dotenv(Path(__file__).resolve().parent / ".env")

import cv2
import numpy as np

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

# The handwriting quality-analysis component (analysis_service.py and the
# modules it imports by plain top-level name -- image_utils, scoring,
# segmentation, etc.) lives in handwriting_Qlty/, not next to this file.
# Adding it to sys.path here is the only change needed to keep all of
# those modules' own imports (and their __file__-relative paths for
# models/uploads/outputs) working completely unmodified -- same approach
# used for grammar_check/ via grammar_router.py below.
_HANDWRITING_QLTY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "handwriting_Qlty")
if _HANDWRITING_QLTY_DIR not in sys.path:
    sys.path.insert(0, _HANDWRITING_QLTY_DIR)

from analysis_service import (
    analyze_handwriting,
    get_model_status,
    UPLOAD_DIR,
    OUTPUT_DIR,
)
from grammar_router import router as grammar_router
from fluency_router import app as fluency_app, register_fluency_startup
from reading_error_router import app as reading_error_app


API_VERSION = "4.1.0-result-first"

ALLOWED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".bmp",
    ".tif",
    ".tiff",
}

MAX_FILE_SIZE = 10 * 1024 * 1024

LANGUAGE_ALIASES = {
    "sinhala": "sinhala",
    "sin": "sinhala",
    "si": "sinhala",
    "tamil": "tamil",
    "tam": "tamil",
    "ta": "tamil",
}


app = FastAPI(
    title="Handwriting Quality Analysis API",
    version=API_VERSION,
    description=(
        "Sinhala and Tamil handwriting-quality analysis with Stage 1A "
        "input validation, Stage 1B segmentation reliability, line/word/"
        "character-region segmentation, language-specific calibrated ML, "
        "low-confidence teacher review, teacher-grounded explanation and "
        "top-priority child-friendly feedback."
    ),
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    # Vite auto-increments to 5174/5175/... whenever 5173 is already taken
    # (e.g. a leftover dev-server process from an earlier run) -- without
    # this, the frontend silently fails every fetch() to this API from
    # whichever port it landed on, with no visible error beyond the
    # browser's own CORS console warning. Any localhost/127.0.0.1 port is
    # fine to allow here since this only ever matters in local dev.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.mount(
    "/outputs",
    StaticFiles(
        directory=OUTPUT_DIR
    ),
    name="outputs",
)

# Spelling/grammar-check (Sinhala/Tamil HTR) component -- was its own
# FastAPI app on its own port/venv (grammar_check/main.py); now runs in
# this same process, under /grammar/analyze and /grammar/health.
app.include_router(grammar_router)

# Reading-fluency-profiling component (audio-based) -- was its own
# FastAPI app on its own port/venv (fluency_profiling/backend/main.py);
# now runs in this same process, under /fluency/assess, /fluency/sentences,
# etc. Full ASGI mount rather than an APIRouter (see fluency_router.py for
# why) -- register_fluency_startup() makes its own startup-time model
# loading (Whisper + sklearn) actually run, since mounting alone doesn't
# propagate that.
app.mount("/fluency", fluency_app)
register_fluency_startup(app)

# Reading-error-detection component (audio-based) -- was its own FastAPI
# app on its own port/venv (reading_error/main.py); now runs in this same
# process, under /reading-error/predict. Full ASGI mount like fluency
# above; no startup-event propagation needed here since this module's
# Whisper models load lazily on first request, not at app startup.
app.mount("/reading-error", reading_error_app)


def sanitize_filename(filename):
    filename = Path(filename).name

    return re.sub(
        r"[^A-Za-z0-9._-]",
        "_",
        filename,
    )


def normalize_language(language):
    value = str(language).strip().lower()

    normalized = LANGUAGE_ALIASES.get(
        value
    )

    if normalized is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported language. Use 'sinhala' or 'tamil'."
            ),
        )

    return normalized


def validate_filename(upload):
    if (
        upload.filename is None
        or not upload.filename.strip()
    ):
        raise HTTPException(
            status_code=400,
            detail="No valid filename was provided.",
        )

    filename = sanitize_filename(
        upload.filename
    )

    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported image format. "
                "Supported: PNG, JPG, JPEG, BMP, TIF, TIFF."
            ),
        )

    return filename


def decode_image(contents):
    try:
        array = np.frombuffer(
            contents,
            dtype=np.uint8,
        )

        image = cv2.imdecode(
            array,
            cv2.IMREAD_COLOR,
        )

    except Exception:
        image = None

    if image is None or image.size == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded file could not be decoded as a valid image."
            ),
        )

    return image


@app.get("/")
async def root():
    return {
        "service": "Handwriting Quality Analysis API",
        "version": API_VERSION,
        "status": "running",
        "supported_languages": [
            "sinhala",
            "tamil",
        ],
        "architecture": [
            "Stage 1A - Input Quality",
            "Stage 1B - Segmentation Reliability",
            "Stage 2 - Calibrated ML Handwriting Quality",
        ],
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    status = get_model_status()

    ready_languages = [
        language
        for language, info in status.items()
        if info.get("ready", False)
    ]

    return {
        "status": (
            "ok"
            if ready_languages
            else "degraded"
        ),
        "ready_languages": ready_languages,
        "models": status,
    }


@app.get("/models/status")
async def model_status():
    return {
        "models": get_model_status()
    }


@app.post("/analyze")
async def analyze(
    image: UploadFile = File(...),
    language: str = Form(...),
):
    selected_language = normalize_language(
        language
    )

    status = get_model_status()

    if not status.get(
        selected_language,
        {},
    ).get(
        "ready",
        False,
    ):
        raise HTTPException(
            status_code=503,
            detail={
                "message": (
                    f"{selected_language.title()} model is not ready."
                ),
                "model_status": status.get(
                    selected_language,
                    {},
                ),
            },
        )

    filename = validate_filename(
        image
    )

    try:
        contents = await image.read()
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unable to read uploaded file: {error}"
            ),
        )

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty.",
        )

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Maximum upload size is 10 MB.",
        )

    cv_image = decode_image(
        contents
    )

    analysis_id = str(
        uuid.uuid4()
    )[:8]

    saved_filename = (
        f"{analysis_id}_"
        f"{selected_language}_"
        f"{filename}"
    )

    upload_path = os.path.join(
        UPLOAD_DIR,
        saved_filename,
    )

    try:
        with open(
            upload_path,
            "wb",
        ) as file:
            file.write(contents)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to save uploaded image: {error}"
            ),
        )

    try:
        result = await run_in_threadpool(
            analyze_handwriting,
            cv_image,
            analysis_id,
            selected_language,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Handwriting analysis failed: "
                f"{error}"
            ),
        )

    result["analysis_id"] = analysis_id
    result["filename"] = filename
    result["uploaded_file"] = saved_filename

    return result

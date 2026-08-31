from pathlib import Path
import gc
import re
import shutil
import subprocess
import threading
import unicodedata
import uuid

import soundfile as sf
import torch

from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from fastapi.middleware.cors import CORSMiddleware
from jiwer import wer, cer

from transformers import (
    WhisperFeatureExtractor,
    WhisperForConditionalGeneration,
    WhisperProcessor,
    WhisperTokenizer,
)


# =========================================================
# FastAPI Application
# =========================================================

app = FastAPI(
    title="Reading Assessment API",
    version="1.3.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Paths
# =========================================================

# Backend folder
BASE_DIR = Path(__file__).resolve().parent

# Integrated into the shared WriteBright backend: this file now runs
# mounted at /reading-error (see ../reading_error_router.py) instead of
# as its own process. MODELS_DIR now points at the shared
# backend/models/ folder (one level up -- sinhala_whisper_medium_final
# and tamil_whisper_model_medium_final live there directly, not nested
# under a reading_error/ subfolder) instead of a local models/ folder
# next to this file, which was never populated here. Same fix as every
# other integrated component (grammar_check, fluency_profiling).
MODELS_DIR = BASE_DIR.parent / "models"

# Backend/temp folder
TEMP_DIR = BASE_DIR / "temp"

# Create temp directory automatically if it does not exist
TEMP_DIR.mkdir(parents=True, exist_ok=True)


MODEL_PATHS = {
    "Tamil": (
        MODELS_DIR
        / "tamil_whisper_model_medium_final"
    ),

    "Sinhala": (
        MODELS_DIR
        / "sinhala_whisper_medium_final"
    ),
}


# Whisper language names
LANGUAGE_CONFIG = {
    "Tamil": "tamil",
    "Sinhala": "sinhala",
}


MODEL_NAMES = {
    "Tamil": (
        "Whisper Medium - "
        "Fine-Tuned Tamil"
    ),

    "Sinhala": (
        "Whisper Medium - "
        "Fine-Tuned Sinhala Normalized"
    ),
}


# =========================================================
# Model Memory
# =========================================================

# Keep only one Whisper Medium model in memory at a time.
# This is useful when running on devices with limited RAM/VRAM.
loaded_model = {
    "language": None,
    "processor": None,
    "model": None,
    "device": None,
}


# RLock is used so model-management functions can safely
# call other model-management functions while holding the lock.
model_lock = threading.RLock()


# =========================================================
# Utility: Normalize Language Name
# =========================================================

def normalize_language_name(language: str) -> str:
    """
    Accept values such as:
    Tamil, tamil, TAMIL, Sinhala, sinhala, SINHALA

    Return exactly:
    Tamil or Sinhala
    """

    if not language:
        raise ValueError(
            "Language is required."
        )

    language_clean = (
        language
        .strip()
        .lower()
    )

    language_map = {
        "tamil": "Tamil",
        "sinhala": "Sinhala",
    }

    if language_clean not in language_map:
        raise ValueError(
            "Language must be Tamil or Sinhala."
        )

    return language_map[language_clean]


# =========================================================
# Root Endpoint
# =========================================================

@app.get("/")
def root():

    model_status_data = {}

    for language, path in MODEL_PATHS.items():

        model_status_data[language] = {
            "name": MODEL_NAMES[language],
            "path": str(path),
            "folder_exists": path.exists(),
        }

    return {
        "status": "running",

        "message": (
            "Reading Assessment API "
            "is running"
        ),

        "available_models": (
            model_status_data
        ),

        "currently_loaded": (
            loaded_model["language"]
        ),
    }


# =========================================================
# Health Endpoint
# =========================================================

@app.get("/health")
def health():

    return {
        "status": "ok",
        "models_directory": str(MODELS_DIR),
        "temp_directory": str(TEMP_DIR),
        "ffmpeg_available": (
            shutil.which("ffmpeg")
            is not None
        ),
        "tamil_model_found": (
            MODEL_PATHS["Tamil"].exists()
        ),
        "sinhala_model_found": (
            MODEL_PATHS["Sinhala"].exists()
        ),
    }


# =========================================================
# Model Status Endpoint
# =========================================================

@app.get("/model-status")
def model_status():

    return {
        "model_loaded": (
            loaded_model["model"]
            is not None
        ),

        "loaded_language": (
            loaded_model["language"]
        ),

        "device": (
            loaded_model["device"]
        ),

        "model_path": (
            str(
                MODEL_PATHS[
                    loaded_model["language"]
                ]
            )
            if loaded_model["language"]
            in MODEL_PATHS
            else None
        ),
    }


# =========================================================
# Device Selection
# =========================================================

def get_device() -> str:

    # NVIDIA GPU
    if torch.cuda.is_available():
        return "cuda"

    # Apple Silicon GPU
    if (
        hasattr(torch.backends, "mps")
        and torch.backends.mps.is_available()
    ):
        return "mps"

    # CPU fallback
    return "cpu"


# =========================================================
# Clear Device Memory
# =========================================================

def clear_device_cache() -> None:

    gc.collect()

    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    if (
        hasattr(torch.backends, "mps")
        and torch.backends.mps.is_available()
    ):

        try:
            torch.mps.empty_cache()

        except Exception:
            pass


# =========================================================
# Unload Current Model
# =========================================================

def unload_current_model() -> None:

    current_model = (
        loaded_model.get("model")
    )

    current_language = (
        loaded_model.get("language")
    )

    if current_model is not None:

        print(
            f"Unloading "
            f"{current_language} model..."
        )

        try:

            current_model.to("cpu")

        except Exception as error:

            print(
                "Warning while moving "
                f"model to CPU: {error}"
            )

    loaded_model["language"] = None
    loaded_model["processor"] = None
    loaded_model["model"] = None
    loaded_model["device"] = None

    current_model = None

    clear_device_cache()

    print(
        "Previous model removed "
        "from memory."
    )


# =========================================================
# Validate Local Model Folder
# =========================================================

def validate_model_folder(
    language: str,
    model_path: Path,
) -> None:

    if not model_path.exists():

        raise FileNotFoundError(
            f"{language} model folder "
            f"not found: {model_path}"
        )

    if not model_path.is_dir():

        raise FileNotFoundError(
            f"{language} model path is "
            f"not a directory: {model_path}"
        )

    # config.json is required by Hugging Face model loading.
    config_file = (
        model_path
        / "config.json"
    )

    if not config_file.exists():

        raise FileNotFoundError(
            f"{language} model folder exists, "
            "but config.json was not found: "
            f"{config_file}"
        )

    # Check that at least one common model-weight file exists.
    possible_weight_files = [
        model_path / "model.safetensors",
        model_path / "pytorch_model.bin",
    ]

    if not any(
        file.exists()
        for file in possible_weight_files
    ):

        # Some large models may be stored as sharded files.
        safetensor_shards = list(
            model_path.glob(
                "model-*.safetensors"
            )
        )

        pytorch_shards = list(
            model_path.glob(
                "pytorch_model-*.bin"
            )
        )

        if (
            not safetensor_shards
            and not pytorch_shards
        ):

            raise FileNotFoundError(
                f"No model weight files were "
                f"found inside {model_path}"
            )


# =========================================================
# Load Whisper Model
# =========================================================

def load_model(language: str):

    language = (
        normalize_language_name(
            language
        )
    )

    if language not in MODEL_PATHS:

        raise ValueError(
            f"Unsupported language: "
            f"{language}"
        )

    with model_lock:

        # ---------------------------------------------
        # Return current model if already loaded
        # ---------------------------------------------

        if (
            loaded_model["language"]
            == language
            and loaded_model["model"]
            is not None
        ):

            print(
                f"{language} model "
                "is already loaded."
            )

            return (
                loaded_model["processor"],
                loaded_model["model"],
                loaded_model["device"],
            )


        # ---------------------------------------------
        # Unload previous model
        # ---------------------------------------------

        if (
            loaded_model["model"]
            is not None
        ):

            print(
                "Switching from "
                f"{loaded_model['language']} "
                f"to {language}..."
            )

            unload_current_model()


        # ---------------------------------------------
        # Model directory
        # ---------------------------------------------

        model_path = (
            MODEL_PATHS[language]
        )

        validate_model_folder(
            language,
            model_path,
        )


        print(
            f"Loading {language} "
            f"model from: "
            f"{model_path}"
        )


        # ---------------------------------------------
        # Feature Extractor
        # ---------------------------------------------

        feature_extractor = (
            WhisperFeatureExtractor
            .from_pretrained(
                str(model_path),
                local_files_only=True,
            )
        )


        # ---------------------------------------------
        # Tokenizer
        # ---------------------------------------------

        tokenizer = (
            WhisperTokenizer
            .from_pretrained(
                str(model_path),

                local_files_only=True,

                language=(
                    LANGUAGE_CONFIG[
                        language
                    ]
                ),

                task="transcribe",
            )
        )


        # ---------------------------------------------
        # Processor
        # ---------------------------------------------

        processor = (
            WhisperProcessor(
                feature_extractor=(
                    feature_extractor
                ),

                tokenizer=tokenizer,
            )
        )


        # ---------------------------------------------
        # Model
        # ---------------------------------------------

        model = (
            WhisperForConditionalGeneration
            .from_pretrained(
                str(model_path),

                local_files_only=True,

                low_cpu_mem_usage=True,
            )
        )


        # ---------------------------------------------
        # Device
        # ---------------------------------------------

        device = get_device()

        model.to(device)

        model.eval()


        # ---------------------------------------------
        # Generation Settings
        # ---------------------------------------------

        model.generation_config.language = (
            LANGUAGE_CONFIG[
                language
            ]
        )

        model.generation_config.task = (
            "transcribe"
        )


        # ---------------------------------------------
        # Save Loaded Model
        # ---------------------------------------------

        loaded_model["language"] = (
            language
        )

        loaded_model["processor"] = (
            processor
        )

        loaded_model["model"] = (
            model
        )

        loaded_model["device"] = (
            device
        )


        print(
            f"✅ {language} model "
            "loaded successfully "
            f"on device: {device}"
        )


        return (
            processor,
            model,
            device,
        )


# =========================================================
# Text Normalization
# =========================================================

def normalize_text(
    text: str,
    language: str = None,
) -> str:

    if not text:
        return ""

    # Unicode normalization
    text = unicodedata.normalize(
        "NFC",
        text
    )

    text = text.strip()


    # Remove punctuation that should not
    # affect reading evaluation.
    text = re.sub(
        r'[.,!?;:"“”‘’()'
        r'\[\]{}<>…।|/\\]',
        '',
        text
    )


    # Normalize whitespace
    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


# =========================================================
# Detect Reading Error Type
# =========================================================

def detect_error_type(
    expected: str,
    predicted: str,
    language: str,
) -> str:

    expected = normalize_text(
        expected,
        language
    )

    predicted = normalize_text(
        predicted,
        language
    )


    # Exact match
    if expected == predicted:

        return "Correct"


    expected_words = (
        expected.split()
    )

    predicted_words = (
        predicted.split()
    )


    # Missing words
    if (
        len(predicted_words)
        < len(expected_words)
    ):

        return "Missing words"


    # Extra words
    if (
        len(predicted_words)
        > len(expected_words)
    ):

        return "Extra words"


    # Same number of words but different content
    return (
        "Pronunciation / word error"
    )


# =========================================================
# Audio Conversion
# =========================================================

def convert_audio_to_wav(
    input_path: Path,
    output_path: Path,
) -> None:

    if shutil.which("ffmpeg") is None:

        raise RuntimeError(
            "FFmpeg is not installed "
            "or is not available in PATH."
        )

    command = [
        "ffmpeg",

        "-y",

        "-loglevel",
        "error",

        "-i",
        str(input_path),

        "-ac",
        "1",

        "-ar",
        "16000",

        "-sample_fmt",
        "s16",

        str(output_path),
    ]


    result = subprocess.run(
        command,

        stdout=subprocess.PIPE,

        stderr=subprocess.PIPE,

        text=True,
    )


    if result.returncode != 0:

        print(
            "FFmpeg error:"
        )

        print(
            result.stderr
        )

        raise RuntimeError(
            "Unable to convert "
            "the uploaded audio file."
        )


# =========================================================
# Prediction Endpoint
# =========================================================

@app.post("/predict")
async def predict(
    language: str = Form(...),
    expected_text: str = Form(...),
    audio: UploadFile = File(...),
):

    try:

        language = (
            normalize_language_name(
                language
            )
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


    # ---------------------------------------------
    # Normalize expected text
    # ---------------------------------------------

    expected_text = normalize_text(
        expected_text,
        language
    )


    if not expected_text:

        raise HTTPException(
            status_code=400,

            detail=(
                "Expected text "
                "cannot be empty."
            ),
        )


    # ---------------------------------------------
    # Temporary files
    # ---------------------------------------------

    original_suffix = (
        Path(
            audio.filename or ""
        ).suffix.lower()
        or ".webm"
    )


    unique_id = uuid.uuid4().hex


    uploaded_path = (
        TEMP_DIR
        / (
            f"uploaded_audio_"
            f"{unique_id}"
            f"{original_suffix}"
        )
    )


    converted_path = (
        TEMP_DIR
        / (
            f"converted_audio_"
            f"{unique_id}.wav"
        )
    )


    try:

        # =============================================
        # Save Uploaded Audio
        # =============================================

        with uploaded_path.open(
            "wb"
        ) as buffer:

            shutil.copyfileobj(
                audio.file,
                buffer,
            )


        if (
            uploaded_path.stat().st_size
            == 0
        ):

            raise HTTPException(
                status_code=400,

                detail=(
                    "The uploaded audio "
                    "file is empty."
                ),
            )


        # =============================================
        # Convert Audio
        # =============================================

        convert_audio_to_wav(
            uploaded_path,
            converted_path,
        )


        # =============================================
        # Read WAV
        # =============================================

        y, sample_rate = sf.read(
            str(converted_path),

            dtype="float32",
        )


        # Convert stereo to mono
        if y.ndim > 1:

            y = y.mean(
                axis=1
            )


        # Whisper requires 16 kHz audio
        if sample_rate != 16000:

            raise RuntimeError(
                "Unexpected sample rate: "
                f"{sample_rate}. "
                "Expected 16000 Hz."
            )


        if len(y) == 0:

            raise HTTPException(
                status_code=400,

                detail=(
                    "The converted audio "
                    "is empty."
                ),
            )


        # =============================================
        # Duration
        # =============================================

        duration = (
            len(y)
            / sample_rate
        )


        if duration < 1:

            return {
                "status": "error",

                "message": (
                    "Recording is too short. "
                    "Please record again."
                ),
            }


        # =============================================
        # Load Selected Model
        # =============================================

        processor, model, device = (
            load_model(language)
        )


        # =============================================
        # Feature Extraction
        # =============================================

        input_features = (
            processor
            .feature_extractor(
                y,

                sampling_rate=16000,

                return_tensors="pt",
            )
            .input_features
            .to(device)
        )


        # =============================================
        # Decoder Language Prompt
        # =============================================

        forced_decoder_ids = (
            processor
            .get_decoder_prompt_ids(
                language=(
                    LANGUAGE_CONFIG[
                        language
                    ]
                ),

                task="transcribe",
            )
        )


        # =============================================
        # Generate Prediction
        # =============================================

        with torch.inference_mode():

            predicted_ids = (
                model.generate(
                    input_features,

                    forced_decoder_ids=(
                        forced_decoder_ids
                    ),

                    max_new_tokens=100,

                    do_sample=False,

                    num_beams=1,
                )
            )


        # =============================================
        # Decode Prediction
        # =============================================

        predicted_text = (
            processor
            .tokenizer
            .batch_decode(
                predicted_ids,

                skip_special_tokens=True,
            )[0]
        )


        predicted_text = (
            normalize_text(
                predicted_text,
                language
            )
        )


        # =============================================
        # WER
        # =============================================

        wer_score = wer(
            expected_text,
            predicted_text,
        )


        # =============================================
        # CER
        # =============================================

        cer_score = cer(
            expected_text,
            predicted_text,
        )


        # =============================================
        # WER-Derived Word Accuracy
        # =============================================

        accuracy = max(
            0.0,

            min(
                100.0,

                (
                    1
                    - wer_score
                )
                * 100,
            ),
        )


        # =============================================
        # Exact Match
        # =============================================

        exact_match = (
            expected_text
            == predicted_text
        )


        # =============================================
        # Speech Rate
        # =============================================

        expected_word_count = len(
            expected_text.split()
        )


        speech_rate = (
            expected_word_count
            / duration

            if duration > 0

            else 0.0
        )


        # =============================================
        # Voice Energy
        # =============================================

        energy = float(
            (
                y.astype(
                    "float64"
                )
                ** 2
            ).mean()
        )


        # =============================================
        # Speech Behaviour
        # =============================================

        if speech_rate < 1.0:

            speech_behavior = (
                "Hesitant"
            )

        elif speech_rate <= 3.0:

            speech_behavior = (
                "Fluent"
            )

        else:

            speech_behavior = (
                "Fast Speech"
            )


        # =============================================
        # Confidence Level
        # =============================================

        if (
            accuracy >= 90
            and energy > 0.001
        ):

            confidence = (
                "High"
            )

        elif accuracy >= 70:

            confidence = (
                "Medium"
            )

        else:

            confidence = (
                "Low"
            )


        # =============================================
        # Error Type
        # =============================================

        error_type = (
            detect_error_type(
                expected_text,
                predicted_text,
                language,
            )
        )


        # =============================================
        # Response
        # =============================================

        return {
            "status": "success",

            "language": language,

            "model": (
                MODEL_NAMES[
                    language
                ]
            ),

            "device": device,

            "expected_text": (
                expected_text
            ),

            "predicted_text": (
                predicted_text
            ),

            # Raw ratios
            "wer": round(
                wer_score,
                3
            ),

            "cer": round(
                cer_score,
                3
            ),

            # Percent values
            "wer_percent": round(
                wer_score * 100,
                2
            ),

            "cer_percent": round(
                cer_score * 100,
                2
            ),

            # WER-derived word accuracy
            "accuracy": round(
                accuracy,
                2
            ),

            # Full sentence exact match
            "exact_match": (
                exact_match
            ),

            "duration": round(
                duration,
                2
            ),

            "speech_rate": round(
                speech_rate,
                2
            ),

            "voice_energy": round(
                energy,
                6
            ),

            "speech_behavior": (
                speech_behavior
            ),

            "confidence": (
                confidence
            ),

            "error_type": (
                error_type
            ),
        }


    # =====================================================
    # HTTP Error
    # =====================================================

    except HTTPException:

        raise


    # =====================================================
    # Other Errors
    # =====================================================

    except Exception as error:

        print(
            f"Prediction error for "
            f"{language}: "
            f"{type(error).__name__}: "
            f"{error}"
        )


        raise HTTPException(
            status_code=500,

            detail=(
                "Prediction failed: "
                f"{type(error).__name__}: "
                f"{error}"
            ),
        ) from error


    # =====================================================
    # Cleanup
    # =====================================================

    finally:

        await audio.close()


        for path in [
            uploaded_path,
            converted_path,
        ]:

            try:

                if path.exists():

                    path.unlink()

            except OSError as cleanup_error:

                print(
                    "Unable to remove "
                    "temporary file "
                    f"{path}: "
                    f"{cleanup_error}"
                )

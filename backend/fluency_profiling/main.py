"""
main.py — FastAPI Backend
"""

import os
import io
import uuid
import json
import shutil
import warnings
import tempfile
import unicodedata
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import librosa
import joblib
import torch

from fastapi              import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses    import JSONResponse
from pydantic             import BaseModel
from typing               import Optional, List
from sklearn.metrics.pairwise import cosine_similarity
from transformers         import pipeline as hf_pipeline
from pydub import AudioSegment

# pydub shells out to ffmpeg/ffprobe for anything that isn't already a
# plain WAV (browser recordings arrive as webm/ogg) -- if neither is on
# PATH, AudioSegment.from_file() fails with a bare "WinError 2: The
# system cannot find the file specified" that looks nothing like a
# missing-ffmpeg error.
#
# Setting AudioSegment.converter/.ffprobe does NOT fix this on this
# pydub version -- its probing path (mediainfo_json -> get_prober_name())
# calls which("ffprobe") and always runs the bare command name, ignoring
# any class attribute entirely (only the separate conversion path reads
# .converter). The only thing that actually reaches that which() call is
# the process's own PATH, so prepend the ffmpeg folder to os.environ
# directly -- this affects every subprocess this process spawns from
# here on, regardless of what PATH the parent shell/terminal has (a
# `pip install`/PATH change only takes effect in NEW terminals on
# Windows, not whichever one this server happens to already be running
# in). glob.glob() falls back to the winget per-user install location
# (its folder name embeds the exact ffmpeg version, hence the wildcard)
# if ffmpeg isn't already resolvable.
import glob


def _find_ffmpeg_bin_dir():
    if shutil.which("ffmpeg") and shutil.which("ffprobe"):
        return None  # already on PATH, nothing to add
    pattern = os.path.expandvars(
        r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\ffmpeg-*\bin"
    )
    for candidate in glob.glob(pattern):
        return candidate
    return None


_ffmpeg_bin_dir = _find_ffmpeg_bin_dir()
if _ffmpeg_bin_dir and _ffmpeg_bin_dir not in os.environ.get("PATH", ""):
    os.environ["PATH"] = _ffmpeg_bin_dir + os.pathsep + os.environ.get("PATH", "")


# CONFIGURATION


# Integrated into the shared WriteBright backend: this file now runs
# mounted at /fluency (see ../fluency_router.py) instead of as its own
# process, with its cwd no longer guaranteed to be this directory -- so
# every path below is resolved from __file__ instead of the bare
# cwd-relative strings this file used standalone. MODELS_DIR in
# particular now points at the shared backend/models/fluency_profiling/
# (where the trained random_forest.pkl etc. actually live) rather than a
# local models/ folder next to this file, which was never populated here.
_BASE_DIR          = os.path.dirname(os.path.abspath(__file__))
PIPELINE_OUT_DIR   = os.path.join(_BASE_DIR, "pipeline_output")
MODELS_DIR         = os.path.join(_BASE_DIR, "..", "models", "fluency_profiling")
PROFILES_DIR       = os.path.join(_BASE_DIR, "student_profiles")       # saved student JSON profiles

RF_MODEL_PATH      = os.path.join(MODELS_DIR, "random_forest.pkl")
SCALER_PATH        = os.path.join(MODELS_DIR, "scaler.pkl")
SKILL_SCALER_PATH  = os.path.join(MODELS_DIR, "skill_scaler.pkl")
CLIP_SCALER_PATH   = os.path.join(MODELS_DIR, "clip_scaler.pkl")
CENTROIDS_CSV      = os.path.join(PIPELINE_OUT_DIR, "cluster_centroids.csv")
CLUSTER_NAMES_CSV  = os.path.join(PIPELINE_OUT_DIR, "cluster_names.csv")
GROUND_TRUTH_CSV   = os.path.join(_BASE_DIR, "ground_truth.csv")
ACTIVITY_BANK_CSV  = os.path.join(_BASE_DIR, "activity_bank.csv")

SAMPLE_RATE        = 16000

SKILL_DIMS = [
    "overall_accuracy",
    "fluency",
    "hesitation",
    "sentence_length_gap",
]

# Matches RF_FEATURES in train_models.py — cer (not wer), consistent
# with the CER-primary decision made in audio_pipeline.py. chars_per_sec
# (not zcr) — matches the fluency-dimension redefinition in
# audio_pipeline.py's build_skill_vectors: ZCR doesn't capture reading
# pace/duration, chars_per_sec does (see extract_features docstring).
RF_FEATURES = [
    "cer",
    "chars_per_sec",
    "mean_pause_s",
    "hesitation_count",
    "energy_variance",
    "duration_s",
    "length_class_enc",
]

# CER thresholds — kept here only for the /assess response label,
# mirrors audio_pipeline.py's CER_FLUENT/CER_MODERATE.
CER_FLUENT   = 0.10
CER_MODERATE = 0.35

WEAKNESS_DIRECTION = {
    "overall_accuracy":    False,  # higher = better, like fluency: invert for weakness
    "fluency":             False,
    "hesitation":          True,
    "sentence_length_gap": True,
}



# FASTAPI APP SETUP


app = FastAPI(
    title       = "Reading Fluency Profiling API",
    description = "IT22169426 | AMARADASA V N N | R26-DS-009",
    version     = "1.0.0",
)

# Allow React frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],    # in production, replace with your frontend URL
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

os.makedirs(PROFILES_DIR, exist_ok=True)



# LOAD MODELS ON STARTUP


class ModelStore:
    """Holds all loaded models and reference data in memory."""
    rf             = None
    scaler         = None
    skill_scaler   = None
    clip_scaler    = None
    centroids_df   = None
    cluster_names  = None
    act_df         = None
    gt_dict        = None
    len_dict       = None
    whisper_model  = None
    ready          = False


store = ModelStore()


@app.on_event("startup")
async def load_models():
    """Load all models and data when the server starts."""
    print("\n" + "=" * 60)
    print("Loading models and assets...")
    print("=" * 60)

    try:
        # Random Forest + scaler
        store.rf     = joblib.load(RF_MODEL_PATH)
        store.scaler = joblib.load(SCALER_PATH)
        print(f"  Random Forest loaded  — {store.rf.n_estimators} trees")

        # Skill-vector scaler — fit on per-STUDENT AVERAGES (68-sentence
        # means). Kept loaded for reference/consistency with
        # cluster_centroids.csv, but NOT used to scale a single live
        # clip below — its range is far too narrow for that (see
        # clip_scaler below).
        store.skill_scaler = joblib.load(SKILL_SCALER_PATH)
        print(f"  Skill scaler loaded")

        # Clip-level scaler — fit on individual clips' raw cer/zcr/
        # mean_pause_s (before per-student aggregation). This is what
        # predict_profile() uses to scale a single live /assess clip,
        # since a clip's variance is far wider than a student average's.
        store.clip_scaler = joblib.load(CLIP_SCALER_PATH)
        print(f"  Clip scaler loaded")

        # Cluster centroids and names
        store.centroids_df  = pd.read_csv(CENTROIDS_CSV)
        names_df            = pd.read_csv(CLUSTER_NAMES_CSV)
        store.cluster_names = dict(zip(names_df["cluster"], names_df["name"]))
        print(f"  Clusters loaded       — {len(store.cluster_names)} profiles")

        # Activity bank
        store.act_df = pd.read_csv(ACTIVITY_BANK_CSV)
        print(f"  Activity bank loaded  — {len(store.act_df)} activities")

        # Ground truth sentences
        gt_df = pd.read_csv(GROUND_TRUTH_CSV)
        gt_df["sentence_id"] = gt_df["sentence_id"].astype(str).str.zfill(3)
        store.gt_dict  = dict(zip(gt_df["sentence_id"], gt_df["text"]))
        store.len_dict = dict(zip(gt_df["sentence_id"], gt_df["length_class"]))
        print(f"  Ground truth loaded   — {len(store.gt_dict)} sentences")

        # Whisper model
        print("  Loading Whisper model (this may take a moment)...")
        device      = 0 if torch.cuda.is_available() else -1
        torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        store.whisper_model = hf_pipeline(
            task        = "automatic-speech-recognition",
            model       = "Lingalingeswaran/whisper-small-sinhala",
            device      = device,
            torch_dtype = torch_dtype,
        )
        print("  Whisper ready.")

        store.ready = True
        print("\nAll models loaded. API is ready.\n")

    except Exception as e:
        print(f"\nERROR loading models: {e}")
        print("Make sure train_models.py has been run first.")
        store.ready = False



# RESPONSE MODELS


class SkillProfile(BaseModel):
    overall_accuracy:    float
    fluency:             float
    hesitation:          float
    sentence_length_gap: float


class ActivityItem(BaseModel):
    act_id:              str
    name:                str
    target_skill:        str
    difficulty:          str
    description:         str
    reading_instruction: Optional[str] = ""
    cosine_similarity:   float


class AssessmentResponse(BaseModel):
    student_id:       Optional[str]
    sentence_id:      str
    wer:              float
    cer:              float
    fluency_label:    str
    transcript:       str
    ground_truth:     str
    cluster:          int
    profile_name:     str
    confidence:       float
    skill_4d:         SkillProfile
    weakest:          List[str]
    recommendations:  List[ActivityItem]
    note:             str



# CORE FUNCTIONS


def extract_features(y: np.ndarray, sr: int, ground_truth: str = "") -> dict:
    """Extract librosa audio features from one clip. Kept identical to
    audio_pipeline.py's version — see that docstring for the full
    rationale on chars_per_sec replacing zcr as the fluency signal, and
    zcr/energy_variance now being speech-only rather than whole-clip."""
    duration  = len(y) / sr
    intervals = librosa.effects.split(y, top_db=30)

    pauses = []
    for i in range(1, len(intervals)):
        pause_dur = (intervals[i][0] - intervals[i-1][1]) / sr
        if pause_dur > 0.15:
            pauses.append(pause_dur)

    hesitation_count = len(pauses)
    mean_pause       = float(np.mean(pauses)) if pauses else 0.0
    speech_samples   = sum(end - start for start, end in intervals)
    speech_duration  = speech_samples / sr

    if len(intervals) > 0:
        speech_signal = np.concatenate([y[start:end] for start, end in intervals])
    else:
        speech_signal = y

    zcr              = float(librosa.feature.zero_crossing_rate(speech_signal)[0].mean())
    rms              = librosa.feature.rms(y=speech_signal)[0]
    energy_variance  = float(np.var(rms))

    char_count    = len(ground_truth.replace(" ", ""))
    chars_per_sec = (char_count / speech_duration) if speech_duration > 0 else 0.0

    return {
        "duration_s":        round(duration, 3),
        "speech_duration_s": round(speech_duration, 3),
        "hesitation_count":  hesitation_count,
        "mean_pause_s":      round(mean_pause, 3),
        "zcr":               round(zcr, 4),
        "energy_variance":   round(energy_variance, 6),
        "chars_per_sec":     round(chars_per_sec, 3),
    }


# Groups of Sinhala letters that are acoustically indistinguishable
# (or near-indistinguishable) in modern spoken Sinhala, even though
# they are written differently. Each group maps to a single canonical
# character before comparison, so swaps within a group are NOT counted
# as errors. Kept identical to audio_pipeline.py — 'ස' intentionally
# excluded from the sibilant group.
CONFUSABLE_LETTER_GROUPS = [
    "ලළ",   # la / retroflex ḷa
    "ණන",   # retroflex ṇa / dental na
    "ශෂ",  # śa / ṣa / sa (all → /s/)
    "කඛ",   # ka / kha
    "ගඝ",   # ga / gha
    "චඡ",   # ca / cha
    "ජඣ",   # ja / jha
    "ටඨ",   # ṭa / ṭha
    "ඩඪ",   # ḍa / ḍha
    "තථ",   # ta / tha
    "දධ",   # da / dha
    "පඵ",   # pa / pha
    "බභ",   # ba / bha
]

_CONFUSABLE_TRANSLATION_TABLE = str.maketrans({
    ch: group[0]
    for group in CONFUSABLE_LETTER_GROUPS
    for ch in group[1:]
})


def normalize_confusables(text: str) -> str:
    """Map acoustically-confusable Sinhala letters to a canonical form
    so that WER/CER don't penalize swaps between them."""
    return text.translate(_CONFUSABLE_TRANSLATION_TABLE)


def strip_punctuation(text: str) -> str:
    """Remove all punctuation so Whisper's punctuation choices aren't
    scored as reading errors. Kept identical to audio_pipeline.py's
    version — see that docstring for why Unicode category ('P*') is
    used instead of a hand-picked character list, and why Sinhala
    combining marks (category 'M') are correctly left untouched."""
    return "".join(ch for ch in text if not unicodedata.category(ch).startswith("P"))


def calculate_wer(reference: str, hypothesis: str) -> float:
    """Word Error Rate using dynamic programming. Kept for the /assess
    response as a reference/reporting value only — CER is what feeds
    the Random Forest and the accuracy dimension of the skill vector."""
    reference  = normalize_confusables(strip_punctuation(reference))
    hypothesis = normalize_confusables(strip_punctuation(hypothesis))

    ref = reference.strip().split()
    hyp = hypothesis.strip().split()
    r, h = len(ref), len(hyp)
    if r == 0:
        return 0.0

    d = np.zeros((r + 1, h + 1), dtype=int)
    for i in range(r + 1): d[i][0] = i
    for j in range(h + 1): d[0][j] = j

    for i in range(1, r + 1):
        for j in range(1, h + 1):
            if ref[i-1] == hyp[j-1]:
                d[i][j] = d[i-1][j-1]
            else:
                d[i][j] = 1 + min(d[i-1][j], d[i][j-1], d[i-1][j-1])

    return round(min(d[r][h] / r, 1.0), 4)


def calculate_cer(reference: str, hypothesis: str) -> float:
    """Character Error Rate — PRIMARY accuracy metric. Same DP approach
    as calculate_wer, but at the character level with spaces stripped
    from both strings first, so word-boundary/segmentation differences
    aren't counted as errors while genuine letter-level errors still
    are. Same punctuation-stripping and confusable-letter normalization
    as calculate_wer."""
    reference  = normalize_confusables(strip_punctuation(reference)).replace(" ", "")
    hypothesis = normalize_confusables(strip_punctuation(hypothesis)).replace(" ", "")

    r, h = len(reference), len(hypothesis)
    if r == 0:
        return 0.0

    d = np.zeros((r + 1, h + 1), dtype=int)
    for i in range(r + 1): d[i][0] = i
    for j in range(h + 1): d[0][j] = j

    for i in range(1, r + 1):
        for j in range(1, h + 1):
            if reference[i-1] == hypothesis[j-1]:
                d[i][j] = d[i-1][j-1]
            else:
                d[i][j] = 1 + min(d[i-1][j], d[i][j-1], d[i-1][j-1])

    return round(min(d[r][h] / r, 1.0), 4)


def get_fluency_label_cer(cer: float) -> str:
    """CER-based fluency label — mirrors audio_pipeline.py thresholds."""
    if cer <= CER_FLUENT:
        return "Fluent"
    elif cer <= CER_MODERATE:
        return "Moderate"
    else:
        return "Struggling"


def ensure_wav(input_path: str) -> str:
    """
    Convert whatever audio format the client sent (webm, ogg, etc.) into a
    real 16kHz mono WAV that librosa/soundfile can open. Browser recordings
    are never true .wav even when the filename says so.
    """
    wav_path = input_path.rsplit(".", 1)[0] + "_converted.wav"
    audio = AudioSegment.from_file(input_path)
    audio = audio.set_frame_rate(SAMPLE_RATE).set_channels(1)
    audio.export(wav_path, format="wav")
    return wav_path


def predict_profile(wav_path: str, ground_truth: str, sentence_id: str):
    """
    Core inference function.
    Given one audio file path and ground truth text:
    1. Transcribe with Whisper
    2. Calculate WER
    3. Extract librosa features
    4. Predict cluster with Random Forest
    5. Build 4D skill profile
    6. Identify weakest dimensions
    Returns a result dict.
    """
    # Load audio
    y, sr = librosa.load(wav_path, sr=SAMPLE_RATE, mono=True)

    # Transcribe
    try:
        result     = store.whisper_model(
            wav_path,
            generate_kwargs={"language": "sinhala", "task": "transcribe"}
        )
        transcript = result["text"].strip()
    except Exception:
        result     = store.whisper_model(wav_path)
        transcript = result["text"].strip()

    # WER (reference/reporting only) + CER (PRIMARY accuracy metric)
    wer = calculate_wer(ground_truth, transcript) if ground_truth else -1.0
    cer = calculate_cer(ground_truth, transcript) if ground_truth else -1.0

    # librosa features — ground_truth needed now for chars_per_sec
    features = extract_features(y, sr, ground_truth)

    # Sentence length class
    word_count       = len(ground_truth.split()) if ground_truth else 7
    length_class_enc = 1 if word_count > 7 else 0

    # Build RF feature vector — cer, not wer, matches train_models.py.
    # chars_per_sec, not zcr — matches the fluency-dimension redefinition.
    row = {
        "cer":              max(cer, 0.0),
        "chars_per_sec":    features["chars_per_sec"],
        "mean_pause_s":     features["mean_pause_s"],
        "hesitation_count": features["hesitation_count"],
        "energy_variance":  features["energy_variance"],
        "duration_s":       features["duration_s"],
        "length_class_enc": length_class_enc,
    }

    X          = np.array([[row[f] for f in RF_FEATURES]])
    X_scaled   = store.scaler.transform(X)
    cluster    = int(store.rf.predict(X_scaled)[0])
    proba      = store.rf.predict_proba(X_scaled)[0]
    confidence = float(proba.max())
    profile    = store.cluster_names.get(cluster, f"Profile {cluster}")

    # 4D skill profile
    centroid_row = store.centroids_df[
        store.centroids_df["cluster"] == cluster
    ].iloc[0]

    # Put this clip's raw CER/chars_per_sec/pause on a 0-1 scale
    # calibrated against the full per-CLIP distribution — NOT the
    # per-student-average scale (see clip_scaler comments in
    # audio_pipeline.py's build_skill_vectors for why that distinction
    # matters: per-student averages compress variance so heavily that
    # almost every individual clip clips to 0 or 1 against that narrower
    # range). sentence_length_gap still comes from the cluster centroid
    # since it can't be computed from one clip.
    raw_dims    = np.array([[max(cer, 0.0), features["chars_per_sec"], features["mean_pause_s"]]])
    scaled_dims = store.clip_scaler.transform(raw_dims)[0]
    scaled_dims = np.clip(scaled_dims, 0.0, 1.0)  # guard against a clip more extreme than anything in the training set

    skill_4d = {
        "overall_accuracy":    round(1.0 - scaled_dims[0], 4),  # scaler was fit on CER (error), invert for accuracy
        "fluency":             round(scaled_dims[1], 4),
        "hesitation":          round(scaled_dims[2], 4),
        "sentence_length_gap": round(float(centroid_row["sentence_length_gap"]), 4),
    }

    # Identify weakest dimensions
    weakness_scores = {}
    for dim, val in skill_4d.items():
        weakness_scores[dim] = val if WEAKNESS_DIRECTION[dim] else (1.0 - val)

    ranked_dims = sorted(weakness_scores, key=weakness_scores.get, reverse=True)
    weakest     = ranked_dims[:2]

    return {
        "wer":            wer,
        "cer":            cer,
        "fluency_label":  get_fluency_label_cer(cer) if cer >= 0 else "N/A",
        "transcript":     transcript,
        "features":       features,
        "cluster":        cluster,
        "profile_name":   profile,
        "confidence":     confidence,
        "skill_4d":       skill_4d,
        "weakest":        weakest,
    }


def get_recommendations(weakest: list, cluster: int, top_n: int = 5) -> list:
    """
    Cosine similarity between student weakness vector
    and activity target vectors.
    Returns list of top_n activity dicts.
    """
    dim_order    = ["overall_accuracy", "fluency",
                    "hesitation", "sentence_length_gap"]
    weakness_vec = np.array([[1 if d in weakest else 0 for d in dim_order]])

    skill_to_vec = {
        "Accuracy":        [1, 0, 0, 0],
        "Fluency":         [0, 1, 0, 0],
        "Hesitation":      [0, 0, 1, 0],
        "Sentence Length": [0, 0, 0, 1],
    }

    scores = []
    for _, row in store.act_df.iterrows():
        target_key = str(row.get("Target_Skill", "")).strip()
        if "Accuracy"   in target_key: target_key = "Accuracy"
        elif "Fluency"  in target_key: target_key = "Fluency"
        elif "Hesitation" in target_key or "Confidence" in target_key:
            target_key = "Hesitation"
        elif "Sentence" in target_key or "Length" in target_key:
            target_key = "Sentence Length"

        target_vec = skill_to_vec.get(target_key, [0, 0, 0, 0])
        sim        = float(cosine_similarity(weakness_vec, [target_vec])[0][0])
        scores.append(sim)

    act_df         = store.act_df.copy()
    act_df["sim"]  = scores

    # Difficulty filter based on cluster
    struggling_cluster = 2
    if cluster == struggling_cluster:
        allowed = ["Beginner"]
    else:
        allowed = ["Beginner", "Intermediate"]

    filtered = act_df[act_df["Difficulty"].isin(allowed)]
    if len(filtered) == 0:
        filtered = act_df

    diff_order         = {"Beginner": 0, "Intermediate": 1, "Advanced": 2}
    filtered           = filtered.copy()
    filtered["d_ord"]  = filtered["Difficulty"].map(diff_order).fillna(2)
    filtered           = filtered.sort_values(
        ["sim", "d_ord"], ascending=[False, True]
    ).head(top_n)

    results = []
    for _, row in filtered.iterrows():
        results.append({
            "act_id":              str(row.get("ACT_ID", "")),
            "name":                str(row.get("Name", "")),
            "target_skill":        str(row.get("Target_Skill", "")),
            "difficulty":          str(row.get("Difficulty", "")),
            "description":         str(row.get("Description", "")),
            "reading_instruction": str(row.get("reading_instruction", "")),
            "cosine_similarity":   round(row["sim"], 4),
        })

    return results



# ENDPOINTS


@app.get("/")
async def health_check():
    """Health check — confirms API is running and models are loaded."""
    return {
        "status":  "running" if store.ready else "models not loaded",
        "system":  "Reading Fluency Profiling API",
        "version": "1.0.0",
        "author":  "IT22169426 | AMARADASA V N N | R26-DS-009",
        "models_ready": store.ready,
    }


@app.post("/assess")
async def assess(
    audio:       UploadFile = File(..., description="Cleaned .wav audio file"),
    sentence_id: str        = Form("001", description="Sentence ID e.g. 001"),
    student_id:  str        = Form("", description="Optional student ID"),
):
    """
    Full assessment from one audio file.

    The sentence ID is used to look up the correct ground truth text
    from ground_truth.csv automatically.

    Returns: reader profile, 4D skill vector, top 5 activity recommendations.
    """
    if not store.ready:
        raise HTTPException(503, "Models not loaded. Check server startup logs.")

    if not audio.filename.endswith(".wav"):
        raise HTTPException(400, "Only .wav files are supported.")

    # Save uploaded file to temp location
    tmp_path = os.path.join(tempfile.gettempdir(),
                            f"assess_{uuid.uuid4().hex}.wav")
    converted_path = None
    try:
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(audio.file, f)

        # Browser recordings are webm/ogg even when named .wav — convert first
        converted_path = ensure_wav(tmp_path)

        # Look up ground truth
        sid          = str(sentence_id).zfill(3)
        ground_truth = store.gt_dict.get(sid, "")
        if not ground_truth:
            raise HTTPException(
                400,
                f"Sentence ID '{sid}' not found in ground_truth.csv. "
                f"Use /assess/custom to provide your own ground truth."
            )

        # Run inference
        result = predict_profile(converted_path, ground_truth, sid)

        # Get recommendations
        recs = get_recommendations(result["weakest"], result["cluster"])

        # Save profile if student_id provided
        if student_id:
            profile_data = {
                "student_id":   student_id,
                "sentence_id":  sid,
                **{k: v for k, v in result.items() if k != "features"},
                "recommendations": recs,
            }
            profile_path = os.path.join(
                PROFILES_DIR, f"{student_id}_profile.json"
            )
            with open(profile_path, "w", encoding="utf-8") as f:
                json.dump(profile_data, f, ensure_ascii=False, indent=2)

        return {
            "student_id":      student_id or None,
            "sentence_id":     sid,
            "wer":             result["wer"],
            "cer":             result["cer"],
            "fluency_label":   result["fluency_label"],
            "transcript":      result["transcript"],
            "ground_truth":    ground_truth,
            "cluster":         result["cluster"],
            "profile_name":    result["profile_name"],
            "confidence":      round(result["confidence"], 4),
            "skill_4d":        result["skill_4d"],
            "weakest":         result["weakest"],
            "recommendations": recs,
            "note": (
                "Profile based on 1 recording. "
                "Record all 68 sentences for a fully accurate 4D profile."
            ),
        }

    finally:
        # PermissionError (WinError 32, "file in use by another process")
        # here would otherwise replace whatever the real error was --
        # e.g. ensure_wav() raising because ffmpeg isn't on PATH can leave
        # a handle on tmp_path open transiently. Best-effort cleanup only;
        # a leftover temp file in %TEMP% is harmless, masking the actual
        # failure is not.
        for path in (tmp_path, converted_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass


@app.post("/assess/custom")
async def assess_custom(
    audio:        UploadFile = File(..., description="Cleaned .wav audio file"),
    ground_truth: str        = Form(..., description="Correct Sinhala sentence text"),
    student_id:   str        = Form("", description="Optional student ID"),
):
    """
    Assessment with a custom ground truth sentence.

    Use this when the student reads a sentence not in the 68-sentence dataset.
    The student types the correct sentence and it is used for WER calculation.
    """
    if not store.ready:
        raise HTTPException(503, "Models not loaded.")

    if not audio.filename.endswith(".wav"):
        raise HTTPException(400, "Only .wav files are supported.")

    if not ground_truth.strip():
        raise HTTPException(
            400, "ground_truth cannot be empty. "
                 "Type the correct Sinhala sentence the student should read."
        )

    tmp_path = os.path.join(tempfile.gettempdir(),
                            f"custom_{uuid.uuid4().hex}.wav")
    converted_path = None
    try:
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(audio.file, f)

        # Browser recordings are webm/ogg even when named .wav — convert first
        converted_path = ensure_wav(tmp_path)

        result = predict_profile(converted_path, ground_truth.strip(), "custom")
        recs   = get_recommendations(result["weakest"], result["cluster"])

        if student_id:
            profile_data = {
                "student_id":   student_id,
                "sentence_id":  "custom",
                "ground_truth": ground_truth,
                **{k: v for k, v in result.items() if k != "features"},
                "recommendations": recs,
            }
            profile_path = os.path.join(
                PROFILES_DIR, f"{student_id}_profile.json"
            )
            with open(profile_path, "w", encoding="utf-8") as f:
                json.dump(profile_data, f, ensure_ascii=False, indent=2)

        return {
            "student_id":      student_id or None,
            "sentence_id":     "custom",
            "wer":             result["wer"],
            "cer":             result["cer"],
            "fluency_label":   result["fluency_label"],
            "transcript":      result["transcript"],
            "ground_truth":    ground_truth,
            "cluster":         result["cluster"],
            "profile_name":    result["profile_name"],
            "confidence":      round(result["confidence"], 4),
            "skill_4d":        result["skill_4d"],
            "weakest":         result["weakest"],
            "recommendations": recs,
            "note": (
                "Profile based on 1 recording with custom ground truth. "
                "Record all 68 sentences for a fully accurate 4D profile."
            ),
        }

    finally:
        # PermissionError (WinError 32, "file in use by another process")
        # here would otherwise replace whatever the real error was --
        # e.g. ensure_wav() raising because ffmpeg isn't on PATH can leave
        # a handle on tmp_path open transiently. Best-effort cleanup only;
        # a leftover temp file in %TEMP% is harmless, masking the actual
        # failure is not.
        for path in (tmp_path, converted_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass


@app.get("/activities")
async def get_all_activities():
    """Return the full activity bank."""
    if not store.ready:
        raise HTTPException(503, "Models not loaded.")

    activities = []
    for _, row in store.act_df.iterrows():
        activities.append({
            "act_id":              str(row.get("ACT_ID", "")),
            "name":                str(row.get("Name", "")),
            "target_skill":        str(row.get("Target_Skill", "")),
            "difficulty":          str(row.get("Difficulty", "")),
            "description":         str(row.get("Description", "")),
            "reading_instruction": str(row.get("reading_instruction", "")),
            "sentence_source":     str(row.get("sentence_source", "")),
            "reading_mode":        str(row.get("reading_mode", "")),
        })
    return {"count": len(activities), "activities": activities}


@app.get("/activities/{cluster_id}")
async def get_activities_for_cluster(cluster_id: int):
    """
    Return recommended activities for a specific cluster.
    Useful for pre-loading the dashboard after profile prediction.
    """
    if not store.ready:
        raise HTTPException(503, "Models not loaded.")

    profile_name = store.cluster_names.get(cluster_id, f"Profile {cluster_id}")

    # Get all 4 dimensions as equally weak for general cluster recommendations
    weakest = ["fluency", "hesitation"]
    recs    = get_recommendations(weakest, cluster_id, top_n=10)

    return {
        "cluster":      cluster_id,
        "profile_name": profile_name,
        "activities":   recs,
    }


@app.get("/profile/{student_id}")
async def get_student_profile(student_id: str):
    """Return the saved profile for a student (if it exists)."""
    profile_path = os.path.join(PROFILES_DIR, f"{student_id}_profile.json")

    if not os.path.exists(profile_path):
        raise HTTPException(
            404,
            f"No saved profile found for student '{student_id}'. "
            "Run /assess first to generate a profile."
        )

    with open(profile_path, "r", encoding="utf-8") as f:
        profile = json.load(f)

    return profile


@app.get("/sentences")
async def get_sentences():
    """Return all 68 ground truth sentences."""
    if not store.gt_dict:
        raise HTTPException(503, "Ground truth not loaded.")

    sentences = []
    for sid, text in sorted(store.gt_dict.items()):
        sentences.append({
            "sentence_id":  sid,
            "text":         text,
            "length_class": store.len_dict.get(sid, "unknown"),
        })

    return {"count": len(sentences), "sentences": sentences}


@app.get("/clusters")
async def get_clusters():
    """Return all reader profile cluster names."""
    if not store.cluster_names:
        raise HTTPException(503, "Cluster names not loaded.")

    clusters = []
    for cluster_id, name in sorted(store.cluster_names.items()):
        centroid_row = store.centroids_df[
            store.centroids_df["cluster"] == cluster_id
        ].iloc[0]
        clusters.append({
            "cluster":      int(cluster_id),
            "name":         name,
            "centroid": {
                "overall_accuracy":    round(float(centroid_row["overall_accuracy"]), 4),
                "fluency":             round(float(centroid_row["fluency"]), 4),
                "hesitation":          round(float(centroid_row["hesitation"]), 4),
                "sentence_length_gap": round(float(centroid_row["sentence_length_gap"]), 4),
            },
        })

    return {"count": len(clusters), "clusters": clusters}
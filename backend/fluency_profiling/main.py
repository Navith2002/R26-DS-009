"""
main.py — FastAPI Backend
"""

import os
import io
import re
import uuid
import json
import random
import shutil
import logging
import warnings
import tempfile
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
from starlette.concurrency import run_in_threadpool

from text_metrics import (
    CONFUSABLE_LETTER_GROUPS,
    normalize_confusables,
    strip_punctuation,
    calculate_wer,
    calculate_cer,
    effective_cer_for_scoring,
    clean_char_length,
    extract_features,
)
import activity_store
import llm_recommender

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
GROUND_TRUTH_CSV      = os.path.join(_BASE_DIR, "ground_truth.csv")
ACTIVITY_BANK_CSV     = os.path.join(_BASE_DIR, "activity_bank.csv")
ACTIVITY_SENTENCES_CSV = os.path.join(_BASE_DIR, "activity_sentences.csv")

SAMPLE_RATE        = 16000
MAX_FILE_SIZE      = 10 * 1024 * 1024  # 10 MB cap on /assess audio uploads

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

# Below this much actual speech, or with fewer than this many detected
# pauses, mean_pause_s is a mean over too few samples (sometimes just one,
# or zero) to trust as a real hesitation/pacing read — flagged rather than
# silently shown with false precision. See hesitation_low_confidence below.
MIN_SPEECH_FOR_HESITATION_S = 1.5
MIN_PAUSES_FOR_HESITATION   = 2

# clip_scaler.pkl's fitted max for chars_per_sec is 27.1, but that's driven
# by misread outliers, not genuinely fast reading: of the training clips
# above ~13 chars/sec, mean WER is 0.85 (a short detected-speech segment on
# a BAD reading inflates the rate, since the formula divides the full
# reference length by an abnormally short speech duration -- the same
# failure mode the mismatch gate targets, just showing up as scale
# pollution here instead of a direct accuracy error). 99% of all 4206
# training clips fall at or below ~14.3 chars/sec. Capping the ceiling used
# for fluency scaling here (just past that p99) keeps genuinely fast,
# accurate readers from being compressed toward the bottom of the scale by
# a handful of garbled outlier clips. Only affects the displayed
# skill_4d.fluency number -- the RF's cluster assignment uses a separate,
# untouched scaler (store.scaler) and isn't affected by this.
PACE_SCALING_MAX_CHARS_PER_SEC = 14.5

WEAKNESS_DIRECTION = {
    "overall_accuracy":    False,  # higher = better, like fluency: invert for weakness
    "fluency":             False,
    "hesitation":          True,
    "sentence_length_gap": True,
}

# Used only for the generic fallback feedback_text when the LLM recommender
# (llm_recommender.py) fails or is unconfigured -- the student still gets a
# short note naming what to work on, never a raw error. Localized per the
# app's own Sinhala/Tamil toggle (see FluencyLanguageContext.jsx's
# lang: 'si' | 'ta') so the fallback matches the rest of the page instead
# of switching to English mid-report.
# English gloss of each cluster's static frontend description (see
# PROFILE_NAMES / profile.descs.* in Profilesummary.jsx -- those Sinhala/
# Tamil strings live in the frontend's i18n bundle, which the backend has
# no access to and which isn't resolved until after this response is sent).
# Passed to the LLM as "already_said" context so feedback_text adds
# something new instead of repeating the same generic sentiment. Only the
# meaning needs to roughly track the frontend strings, not the exact
# wording -- keep in sync when a cluster's static description changes.
CLUSTER_ALREADY_SAID = {
    "Accurate":                                   "reads accurately with few mistakes",
    "Accurate & Fast Reader":                     "reads accurately and quickly",
    "Accurate & Slow Reader & Hesitant":          "reads accurately but slowly, with hesitation; told to work on speed and confidence",
    "Moderate Accuracy":                          "reads with some mistakes",
    "Moderate Accuracy & Slow Reader & Hesitant": "reads with some mistakes, slowly and with hesitation; told to work on accuracy, speed and confidence",
    "Needs Accuracy":                             "read something that didn't match the given sentence; told to slow down and try the exact sentence again",
}

# Above this scoring_cer (same constant get_fluency_label_cer() uses for
# its own "Struggling" cutoff), the static per-profile blurb the frontend
# shows (profile.descs.* in fluencyTranslations.js, keyed off
# resolve_profile_desc_key() below) switches to the "Needs Accuracy"
# bucket regardless of which cluster the Random Forest predicted.
#
# Why: the RF cluster (`profile_name`) is predicted from pace/pause/
# energy features alongside accuracy, not from accuracy alone, and on a
# badly mismatched or very-low-accuracy reading it can still land on a
# reassuring cluster like "Accurate" at low confidence -- directly
# contradicting the CER-based fluency_label badge ("Struggling") shown
# right above it on the results page.
#
# Deliberately reuses CER_MODERATE (the exact cutoff fluency_label's own
# "Struggling" bucket starts at) rather than a second, independently-
# chosen number: an earlier version of this gate compared against
# skill_4d.overall_accuracy, a value rescaled by clip_scaler against the
# training clip distribution -- a DIFFERENT scale from raw cer, so a
# clip could score "Struggling" on the raw-cer-based badge while still
# clearing that rescaled threshold (e.g. cer=0.50, well past
# CER_MODERATE, while overall_accuracy still read >0.35). Gating on
# scoring_cer against CER_MODERATE directly guarantees this can never
# happen: it's the exact same metric and threshold family the badge
# above it already uses, just reused here instead of duplicated.
PROFILE_DESC_CER_THRESHOLD = CER_MODERATE

WEAKNESS_LABELS = {
    "si": {
        "overall_accuracy":    "නිරවද්‍යතාවය",
        "fluency":             "කියවීමේ වේගය",
        "hesitation":          "පැකිලීම අඩු කිරීම",
        "sentence_length_gap": "දිග වාක්‍ය කියවීම",
    },
    "ta": {
        "overall_accuracy":    "துல்லியம்",
        "fluency":             "படிக்கும் வேகம்",
        "hesitation":          "தயக்கத்தை குறைத்தல்",
        "sentence_length_gap": "நீண்ட வாக்கியங்களை படித்தல்",
    },
}



# FASTAPI APP SETUP


logger = logging.getLogger(__name__)

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
    act_sentence_map = None  # {ACT_ID: [sentence_id, ...]} -- which sentences each activity may draw from
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
        store.centroids_df  = pd.read_csv(CENTROIDS_CSV, encoding="utf-8")
        names_df            = pd.read_csv(CLUSTER_NAMES_CSV, encoding="utf-8")
        store.cluster_names = dict(zip(names_df["cluster"], names_df["name"]))
        print(f"  Clusters loaded       — {len(store.cluster_names)} profiles")

        # Activity bank — Firestore "activities" collection first, falling
        # back to the local CSV if Firestore is unreachable/misconfigured
        # so startup never hard-fails on a network/credentials issue.
        try:
            store.act_df = activity_store.load_activities()
            print(f"  Activity bank loaded  — {len(store.act_df)} activities (Firestore)")
        except Exception as firestore_err:
            print(f"  Firestore activity load failed ({firestore_err}); falling back to CSV")
            store.act_df = pd.read_csv(ACTIVITY_BANK_CSV, encoding="utf-8")
            print(f"  Activity bank loaded  — {len(store.act_df)} activities (CSV fallback)")

        # Activity -> candidate sentence IDs — same Firestore-first,
        # CSV-fallback pattern as the activity bank above.
        try:
            store.act_sentence_map = activity_store.load_activity_sentence_map()
            print(f"  Activity sentence map loaded — {len(store.act_sentence_map)} activities (Firestore)")
        except Exception as firestore_err:
            print(f"  Firestore activity_sentences load failed ({firestore_err}); falling back to CSV")
            as_df = pd.read_csv(ACTIVITY_SENTENCES_CSV, encoding="utf-8")
            as_df["sentence_id"] = as_df["sentence_id"].astype(str).str.zfill(3)
            store.act_sentence_map = as_df.groupby("ACT_ID")["sentence_id"].apply(list).to_dict()
            print(f"  Activity sentence map loaded — {len(store.act_sentence_map)} activities (CSV fallback)")

        # Ground truth sentences — explicit UTF-8 since this column holds
        # Sinhala Unicode text (pandas' platform default can't be relied on).
        # Same Firestore-first, CSV-fallback pattern as above.
        try:
            sentences      = activity_store.load_sentences()
            store.gt_dict  = {sid: data["text"] for sid, data in sentences.items()}
            store.len_dict = {sid: data["length_class"] for sid, data in sentences.items()}
            print(f"  Ground truth loaded   — {len(store.gt_dict)} sentences (Firestore)")
        except Exception as firestore_err:
            print(f"  Firestore sentences load failed ({firestore_err}); falling back to CSV")
            gt_df = pd.read_csv(GROUND_TRUTH_CSV, encoding="utf-8")
            gt_df["sentence_id"] = gt_df["sentence_id"].astype(str).str.zfill(3)
            store.gt_dict  = dict(zip(gt_df["sentence_id"], gt_df["text"]))
            store.len_dict = dict(zip(gt_df["sentence_id"], gt_df["length_class"]))
            print(f"  Ground truth loaded   — {len(store.gt_dict)} sentences (CSV fallback)")

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
    rationale:           Optional[str] = ""


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
    profile_desc_key: str
    confidence:       float
    skill_4d:         SkillProfile
    weakest:          List[str]
    recommendations:  List[ActivityItem]
    feedback_text:    str
    note:             str



# CORE FUNCTIONS


def build_assessment_note(result: dict, base_note: str) -> str:
    """Prepend any data-quality caveats to the standard per-endpoint note,
    so the UI surfaces them without needing its own code change (it
    already just renders result.note as-is)."""
    prefix = ""
    if result["mismatch_detected"]:
        prefix += (
            "The recording doesn't appear to match the expected sentence at all — "
            "accuracy and the profile below were scored accordingly. "
        )
    if result["hesitation_low_confidence"]:
        prefix += (
            "This recording was too short / had too few pauses to reliably "
            "judge pacing and hesitation — treat that score as a rough estimate. "
        )
    return prefix + base_note


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
    except Exception as exc:
        # Expected cause: this model doesn't support a forced language kwarg.
        # Logged (not silently discarded) so a different failure here --
        # OOM, corrupt audio -- is still visible instead of only showing up
        # as a confusing error from the fallback call below.
        logger.warning("Whisper forced-language transcription failed, "
                        "falling back to default call: %s", exc)
        result     = store.whisper_model(wav_path)
        transcript = result["text"].strip()

    # WER (reference/reporting only) + CER (PRIMARY accuracy metric)
    wer = calculate_wer(ground_truth, transcript) if ground_truth else -1.0
    cer = calculate_cer(ground_truth, transcript) if ground_truth else -1.0

    # `scoring_cer` feeds the RF features and the skill_4d accuracy score
    # below. It equals `cer` for ordinary misreadings; it's only raised to
    # 1.0 when WER + length both signal the student read a different
    # sentence entirely, a case plain CER under-scores for Sinhala (see
    # effective_cer_for_scoring's docstring). The raw `cer` returned below
    # for the CER% display is left untouched either way.
    mismatch_detected = False
    scoring_cer        = cer
    if ground_truth and cer >= 0:
        scoring_cer        = effective_cer_for_scoring(ground_truth, transcript, cer, wer)
        # calculate_cer returns a numpy.float64 (via the DP array), so a
        # plain `!=` here yields numpy.bool_, not bool -- FastAPI's
        # jsonable_encoder can't serialize that (it tries to treat it as
        # an iterable/object first and raises). bool() normalizes it.
        mismatch_detected  = bool(scoring_cer != cer)

    # librosa features — ground_truth needed now for chars_per_sec
    features = extract_features(y, sr, ground_truth)

    # chars_per_sec (as returned by extract_features) always divides by the
    # EXPECTED sentence's length, which only makes sense when the student
    # actually read roughly that sentence. When mismatch_detected is true
    # (see scoring_cer above), that assumption is false, so the raw value
    # isn't "how fast they read" at all -- it's "expected length / however
    # long they happened to talk," which can look artificially fast or slow
    # depending purely on how the wrong sentence's length compares to the
    # reference's. Recomputed from what was actually transcribed instead,
    # which is the only honest pace measurement available once we know the
    # content itself can't be trusted — still imperfect (ASR could mishear
    # length too) but no longer systematically distorted by the mismatch.
    if mismatch_detected and features["speech_duration_s"] > 0:
        features["chars_per_sec"] = round(
            clean_char_length(transcript) / features["speech_duration_s"], 3
        )

    # mean_pause_s/hesitation_count are a mean over very few samples on a
    # short clip (sometimes a single pause, sometimes zero) -- not wrong,
    # just not statistically trustworthy as "this student's pacing/pausing
    # style" yet. Flagged for the caller rather than silently shown with
    # false precision; the underlying number is left exactly as computed
    # since it still feeds the trained clip_scaler/RF below.
    hesitation_low_confidence = (
        features["speech_duration_s"] < MIN_SPEECH_FOR_HESITATION_S
        or features["hesitation_count"] < MIN_PAUSES_FOR_HESITATION
    )

    # Sentence length class
    word_count       = len(ground_truth.split()) if ground_truth else 7
    length_class_enc = 1 if word_count > 7 else 0

    # Build RF feature vector — cer, not wer, matches train_models.py.
    # chars_per_sec, not zcr — matches the fluency-dimension redefinition.
    # Uses scoring_cer (see above) so a reading of a completely different
    # sentence lands the cluster assignment in a struggling/low-accuracy
    # region instead of wherever raw CER's chance codepoint overlap happens
    # to place it.
    row = {
        "cer":              max(scoring_cer, 0.0),
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

    # Full per-cluster probability vector, keyed by cluster name -- lets the
    # LLM recommender (see llm_recommender.py) describe borderline cases
    # ("close split between Moderate and Accurate") instead of only seeing
    # the single max-confidence number the rest of the API uses.
    cluster_probs = {
        store.cluster_names.get(int(cls), f"Profile {int(cls)}"): round(float(p), 4)
        for cls, p in zip(store.rf.classes_, proba)
    }

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
    raw_dims    = np.array([[max(scoring_cer, 0.0), features["chars_per_sec"], features["mean_pause_s"]]])
    scaled_dims = store.clip_scaler.transform(raw_dims)[0]
    scaled_dims = np.clip(scaled_dims, 0.0, 1.0)  # guard against a clip more extreme than anything in the training set

    # Override the fluency dimension with a version scaled against the
    # clamped ceiling (PACE_SCALING_MAX_CHARS_PER_SEC) instead of the
    # scaler's own outlier-driven max — see that constant's comment.
    pace_min       = float(store.clip_scaler.data_min_[1])
    pace_max       = min(float(store.clip_scaler.data_max_[1]), PACE_SCALING_MAX_CHARS_PER_SEC)
    pace_scaled    = (min(features["chars_per_sec"], pace_max) - pace_min) / (pace_max - pace_min)
    scaled_dims[1] = max(0.0, min(1.0, pace_scaled))

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
        "wer":                         wer,
        "cer":                         cer,
        # scoring_cer, not raw cer, is what resolve_profile_desc_key()
        # below gates on -- it's forced to ~1.0 on a detected sentence
        # mismatch (see above) even when raw cer's chance codepoint
        # overlap would otherwise look better than it should.
        "scoring_cer":                 scoring_cer,
        "fluency_label":               get_fluency_label_cer(cer) if cer >= 0 else "N/A",
        "transcript":                  transcript,
        "features":                    features,
        "cluster":                     cluster,
        "profile_name":                profile,
        "confidence":                  confidence,
        "cluster_probs":               cluster_probs,
        "skill_4d":                    skill_4d,
        "weakest":                     weakest,
        "mismatch_detected":           mismatch_detected,
        "hesitation_low_confidence":   hesitation_low_confidence,
    }


def resolve_profile_desc_key(result: dict) -> str:
    """Key used for the frontend's static per-profile name + blurb
    (PROFILE_NAMES / profile.descs.* in Profilesummary.jsx /
    fluencyTranslations.js). See PROFILE_DESC_CER_THRESHOLD above for why
    this isn't always just result['profile_name']."""
    if result["scoring_cer"] > PROFILE_DESC_CER_THRESHOLD:
        return "Needs Accuracy"
    return result["profile_name"]


def pick_practice_sentence(act_id: str) -> str:
    """Random sentence text for this activity, drawn from its mapped
    sentence IDs (store.act_sentence_map) via store.gt_dict -- a fresh
    pick each call so repeated practice on one activity doesn't always
    surface the same sentence. Empty string if no mapping/data is loaded."""
    candidate_ids = (store.act_sentence_map or {}).get(act_id, [])
    if not candidate_ids:
        return ""
    sentence_id = random.choice(candidate_ids)
    return (store.gt_dict or {}).get(sentence_id, "")


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

    # Difficulty filter based on cluster.
    # "Struggling" = the cluster with the highest mean CER in cluster_centroids.csv
    # (centroids store raw CER under "overall_accuracy", so higher means worse).
    # Derived dynamically so this stays correct if clustering is retrained and
    # cluster IDs shift.
    struggling_cluster = None
    if store.centroids_df is not None and len(store.centroids_df) > 0:
        struggling_cluster = int(
            store.centroids_df.loc[
                store.centroids_df["overall_accuracy"].idxmax(), "cluster"
            ]
        )

    if struggling_cluster is not None and cluster == struggling_cluster:
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
        act_id = str(row.get("ACT_ID", ""))
        results.append({
            "act_id":              act_id,
            "name":                str(row.get("Name", "")),
            "target_skill":        str(row.get("Target_Skill", "")),
            "difficulty":          str(row.get("Difficulty", "")),
            "description":         str(row.get("Description", "")),
            "reading_instruction": str(row.get("reading_instruction", "")),
            "practice_sentence":   pick_practice_sentence(act_id),
            "cosine_similarity":   round(row["sim"], 4),
        })

    return results


def build_generic_feedback_text(result: dict, lang: str = "si") -> str:
    """Plain templated feedback used whenever the LLM recommender isn't
    configured or fails for any reason -- the student always gets a short
    note naming what to work on, never a raw error. Written directly in the
    requested script (not run through the frontend's i18n t()/td() lookups,
    since this text is backend-generated) so it matches the app's language
    toggle instead of always showing English."""
    labels_map = WEAKNESS_LABELS.get(lang, WEAKNESS_LABELS["si"])
    labels      = [labels_map.get(d, d) for d in result["weakest"]]
    if lang == "ta":
        return f"நல்ல முயற்சி! கீழே உள்ள செயல்பாடுகளுடன் {' மற்றும் '.join(labels)} ஆகியவற்றில் கவனம் செலுத்துங்கள்."
    return f"හොඳ උත්සාහයක්! පහත ක්‍රියාකාරකම් සමඟ {' සහ '.join(labels)} කෙරෙහි අවධානය යොමු කරන්න."


# How many of the shortlist's activities to ask the LLM to personalize.
# Kept below `top_n` (the full shown list, 5) on purpose: asking Gemini to
# rewrite all 5 with the fuller gemini-flash-latest model (see
# llm_recommender.py's DEFAULT_MODEL comment) pushed response time past
# FLUENCY_GEMINI_TIMEOUT_MS in testing, causing frequent fallbacks to the
# generic text instead. Activities beyond this count keep their static
# per-skill guidance text (via rationale: "" -> frontend's own fallback).
LLM_PICK_COUNT = 3


def get_feedback_and_recs(result: dict, recs: list, lang: str = "si", top_n: int = 5):
    """
    Tries the Gemini-based recommender (llm_recommender.py) to turn the
    existing cosine-ranked shortlist (`recs`) into a child-friendly feedback
    paragraph plus a reordered pick list. The LLM is asked to personalize
    only the top LLM_PICK_COUNT activities (see its comment); for those,
    `rationale` holds ONE rewritten sentence that merges what the activity
    is + why it helps this student (the frontend shows this INSTEAD of its
    own static per-skill guidance text, not alongside it -- see
    localizedActivity() in fluencyActivities.js, which ignores this
    endpoint's `description` field entirely, so `description` itself is
    left untouched here). Written in the requested `lang` ("si" or "ta").
    The remaining activities (up to `top_n` total, backfilled from the
    plain cosine list) get `rationale: ""`, so the frontend falls back to
    its own static guidance text for those.

    On ANY failure (missing/bad key, timeout, quota, malformed, wrong-script,
    or out-of-shortlist response) this silently falls back to the plain
    cosine-ranked `recs` list and a generic templated feedback_text in the
    same `lang` -- the student never sees an error or a language mismatch.
    Never returns activities outside `recs`.
    """
    context = {
        "skill_4d":          result["skill_4d"],
        "profile_name":      result["profile_name"],
        "weakest":           result["weakest"],
        "cluster_probs":     result.get("cluster_probs", {}),
        "shortlist":         recs,
        "lang":              lang,
        "wer":               result["wer"],
        "cer":               result["cer"],
        "mismatch_detected": result["mismatch_detected"],
        "already_said":      CLUSTER_ALREADY_SAID.get(resolve_profile_desc_key(result), ""),
    }

    try:
        llm_result = llm_recommender.get_llm_recommendations(context, top_n=LLM_PICK_COUNT)
    except llm_recommender.LLMRecommendationError as exc:
        logger.info("LLM recommendation unavailable, using fallback: %s", exc)
        for act in recs:
            act.setdefault("rationale", "")
        return build_generic_feedback_text(result, lang), recs

    rationale_by_id = {p["act_id"]: p["rationale"] for p in llm_result["picks"]}
    picked_order     = [p["act_id"] for p in llm_result["picks"]]
    by_id            = {act["act_id"]: act for act in recs}

    # Reorder by the LLM's picks first (all guaranteed to be in `recs` by
    # llm_recommender's validation), then backfill with any remaining
    # cosine-ranked activities so the list is never shorter than before.
    ordered   = [by_id[aid] for aid in picked_order if aid in by_id]
    remaining = [act for act in recs if act["act_id"] not in picked_order]
    final     = (ordered + remaining)[:top_n]

    for act in final:
        act["rationale"] = rationale_by_id.get(act["act_id"], "")

    return llm_result["feedback_text"], final



# ENDPOINTS


def sanitize_student_id(student_id: str) -> str:
    """
    Strip anything that isn't alphanumeric/underscore/hyphen so student_id
    can never be used to escape PROFILES_DIR (e.g. "../../etc/passwd").
    """
    return re.sub(r"[^A-Za-z0-9_-]", "_", student_id)


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
    lang:        str        = Form("si", description="UI language for LLM feedback text: 'si' or 'ta'"),
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
        contents = await audio.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(413, "Maximum upload size is 10 MB.")
        with open(tmp_path, "wb") as f:
            f.write(contents)

        # Browser recordings are webm/ogg even when named .wav — convert first.
        # ensure_wav()/predict_profile() are CPU-bound (ffmpeg, librosa, Whisper)
        # so run them off the event loop — otherwise one slow request blocks
        # every other request this worker is serving.
        converted_path = await run_in_threadpool(ensure_wav, tmp_path)

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
        result = await run_in_threadpool(predict_profile, converted_path, ground_truth, sid)

        # Get recommendations, then let the LLM recommender (if configured)
        # turn the shortlist into child-friendly feedback + rewrite each
        # picked activity's description -- falls back to the plain cosine
        # list + generic note on any failure.
        recs = get_recommendations(result["weakest"], result["cluster"])
        feedback_text, recs = get_feedback_and_recs(result, recs, lang)

        # Save profile if student_id provided
        if student_id:
            safe_id = sanitize_student_id(student_id)
            profile_data = {
                "student_id":   student_id,
                "sentence_id":  sid,
                **{k: v for k, v in result.items() if k != "features"},
                "recommendations": recs,
                "feedback_text": feedback_text,
            }
            profile_path = os.path.join(
                PROFILES_DIR, f"{safe_id}_profile.json"
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
            "profile_desc_key": resolve_profile_desc_key(result),
            "confidence":      round(result["confidence"], 4),
            "skill_4d":        result["skill_4d"],
            "weakest":         result["weakest"],
            "recommendations": recs,
            "feedback_text":   feedback_text,
            "mismatch_detected":         result["mismatch_detected"],
            "hesitation_low_confidence": result["hesitation_low_confidence"],
            "note": build_assessment_note(
                result,
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
    lang:         str        = Form("si", description="UI language for LLM feedback text: 'si' or 'ta'"),
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
        contents = await audio.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(413, "Maximum upload size is 10 MB.")
        with open(tmp_path, "wb") as f:
            f.write(contents)

        # Browser recordings are webm/ogg even when named .wav — convert first.
        # CPU-bound work runs in a threadpool so it doesn't block the event loop.
        converted_path = await run_in_threadpool(ensure_wav, tmp_path)

        result = await run_in_threadpool(
            predict_profile, converted_path, ground_truth.strip(), "custom"
        )
        recs   = get_recommendations(result["weakest"], result["cluster"])
        feedback_text, recs = get_feedback_and_recs(result, recs, lang)

        if student_id:
            safe_id = sanitize_student_id(student_id)
            profile_data = {
                "student_id":   student_id,
                "sentence_id":  "custom",
                "ground_truth": ground_truth,
                **{k: v for k, v in result.items() if k != "features"},
                "recommendations": recs,
                "feedback_text": feedback_text,
            }
            profile_path = os.path.join(
                PROFILES_DIR, f"{safe_id}_profile.json"
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
            "profile_desc_key": resolve_profile_desc_key(result),
            "confidence":      round(result["confidence"], 4),
            "skill_4d":        result["skill_4d"],
            "weakest":         result["weakest"],
            "recommendations": recs,
            "feedback_text":   feedback_text,
            "mismatch_detected":         result["mismatch_detected"],
            "hesitation_low_confidence": result["hesitation_low_confidence"],
            "note": build_assessment_note(
                result,
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
        act_id = str(row.get("ACT_ID", ""))
        activities.append({
            "act_id":              act_id,
            "name":                str(row.get("Name", "")),
            "target_skill":        str(row.get("Target_Skill", "")),
            "difficulty":          str(row.get("Difficulty", "")),
            "description":         str(row.get("Description", "")),
            "reading_instruction": str(row.get("reading_instruction", "")),
            "sentence_source":     str(row.get("sentence_source", "")),
            "reading_mode":        str(row.get("reading_mode", "")),
            "practice_sentence":   pick_practice_sentence(act_id),
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

    matching_rows = store.centroids_df[store.centroids_df["cluster"] == cluster_id]
    if len(matching_rows) == 0:
        raise HTTPException(404, f"Cluster '{cluster_id}' not found.")
    centroid_row = matching_rows.iloc[0]

    # Derive this cluster's own weakest dimensions from its centroid, the
    # same way predict_profile() does for a live clip -- instead of
    # hardcoding fluency/hesitation for every cluster regardless of its
    # actual profile.
    cluster_skill_4d = {
        "overall_accuracy":    1.0 - float(centroid_row["overall_accuracy"]),  # raw CER -> accuracy
        "fluency":             float(centroid_row["fluency"]),
        "hesitation":          float(centroid_row["hesitation"]),
        "sentence_length_gap": float(centroid_row["sentence_length_gap"]),
    }
    weakness_scores = {
        dim: val if WEAKNESS_DIRECTION[dim] else (1.0 - val)
        for dim, val in cluster_skill_4d.items()
    }
    weakest = sorted(weakness_scores, key=weakness_scores.get, reverse=True)[:2]
    recs    = get_recommendations(weakest, cluster_id, top_n=10)

    return {
        "cluster":      cluster_id,
        "profile_name": profile_name,
        "activities":   recs,
    }


@app.get("/profile/{student_id}")
async def get_student_profile(student_id: str):
    """Return the saved profile for a student (if it exists)."""
    safe_id = sanitize_student_id(student_id)
    profile_path = os.path.join(PROFILES_DIR, f"{safe_id}_profile.json")

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

    sentences = sentences[:68]

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
                # cluster_centroids.csv stores raw mean CER under
                # "overall_accuracy" (higher = more errors). Invert here so
                # this field means "higher = more accurate" everywhere in
                # the API, matching /assess's skill_4d.overall_accuracy.
                "overall_accuracy":    round(1.0 - float(centroid_row["overall_accuracy"]), 4),
                "fluency":             round(float(centroid_row["fluency"]), 4),
                "hesitation":          round(float(centroid_row["hesitation"]), 4),
                "sentence_length_gap": round(float(centroid_row["sentence_length_gap"]), 4),
            },
        })

    return {"count": len(clusters), "clusters": clusters}
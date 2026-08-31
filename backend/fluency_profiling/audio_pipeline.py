# Audio Pipeline 

import os
import warnings
import unicodedata
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import librosa
import soundfile as sf
import matplotlib.pyplot as plt
import torch
import joblib

from pathlib          import Path
from pydub            import AudioSegment
from scipy            import signal
from scipy.ndimage    import uniform_filter1d
from sklearn.preprocessing import MinMaxScaler
from transformers     import pipeline
import noisereduce as nr



# CONFIGURATION


RAW_FOLDER       = "raw_audio"           # input  — original .m4a / .mp3 files
WAV_FOLDER       = "processed/wavs"      # step 1 — converted .wav files
CLEAN_AUDIO_DIR  = "dataset_clean"       # step 2 — noise-cleaned .wav files
MEL_OUTPUT_DIR   = "processed/mels"     # phase 4 — mel spectrogram .npy files
GROUND_TRUTH_CSV = "ground_truth.csv"   # 68 sentences with length_class column
PIPELINE_OUT_DIR = "pipeline_output"    # all CSV and PNG outputs
MODELS_DIR       = "models"             # saved scaler/model artifacts

LABELS_CSV        = os.path.join(PIPELINE_OUT_DIR, "labels.csv")
SKILL_VEC_CSV      = os.path.join(PIPELINE_OUT_DIR, "skill_vectors.csv")
SENT_DIFF_CSV      = os.path.join(PIPELINE_OUT_DIR, "sentence_difficulty.csv")
SKILL_SCALER_PATH  = os.path.join(MODELS_DIR, "skill_scaler.pkl")
CLIP_SCALER_PATH   = os.path.join(MODELS_DIR, "clip_scaler.pkl")
SENT_DIFF_PNG = os.path.join(PIPELINE_OUT_DIR, "sentence_difficulty.png")

SUPPORTED_FORMATS = [".m4a", ".mp3"]

SAMPLE_RATE       = 16000
MEL_SHAPE         = (128, 128)

# Noise reduction parameters
NOISE_REDUCE_PROP = 0.60
VOICE_LOW_HZ      = 80
VOICE_HIGH_HZ     = 7000
VAD_FRAME_MS      = 30
NOISE_SAMPLE_SEC  = 0.5

# WER thresholds — kept for comparison/reporting only (see CER note below)
WER_FLUENT        = 0.0
WER_MODERATE      = 0.4

# CER thresholds — PRIMARY fluency-labeling metric.
# Word-level WER on short Sinhala sentences is highly sensitive to
# word-boundary/segmentation differences between Whisper output and
# ground truth (a single split/merge can swing WER by 0.2-0.5 on a
# 3-6 word sentence), which was found to inflate the "Struggling"
# class without reflecting real reading errors. CER is space-insensitive
# so it isn't affected by this, while still counting genuine
# letter-level misreads as errors. Thresholds below are derived from
# the CER distribution across the full ~4200-clip dataset.
CER_FLUENT        = 0.10
CER_MODERATE      = 0.35



# 1 - WAV CONVERSION 


def convert_to_wav():
    """
    Convert all .m4a and .mp3 files in raw_audio/
    to .wav format and save to processed/wavs/
    """
    print("=" * 60)
    print("STEP 1 — Converting audio files to WAV")
    print("=" * 60)

    raw_path  = Path(RAW_FOLDER)
    wav_path  = Path(WAV_FOLDER)
    wav_path.mkdir(parents=True, exist_ok=True)

    if not raw_path.exists():
        print(f"ERROR: Folder '{RAW_FOLDER}' not found.")
        print("Create the folder and place your .m4a or .mp3 files inside.")
        return False

    audio_files = [
        f for f in raw_path.iterdir()
        if f.suffix.lower() in SUPPORTED_FORMATS
    ]

    # Both lists gathered upfront — .wav files must be handled whether
    # or not .m4a/.mp3 files are ALSO present in the same folder.
    # Previously, .wav files were only checked for when audio_files
    # (.m4a/.mp3) was completely empty, so any .wav sitting alongside
    # .m4a/.mp3 files in the same raw_audio/ folder was silently
    # skipped — never copied, never converted, never seen again by
    # any later step, with no error printed.
    wav_in_raw = [f for f in raw_path.iterdir() if f.suffix.lower() == ".wav"]

    if not audio_files and not wav_in_raw:
        print(f"ERROR: No .m4a, .mp3 or .wav files found in '{RAW_FOLDER}'.")
        return False

    ok, failed = 0, []

    # Copy any .wav files as-is
    if wav_in_raw:
        print(f"Found {len(wav_in_raw)} .wav file(s) directly in '{RAW_FOLDER}'.")
        print("Copying to processed/wavs/ ...")
        import shutil
        for f in sorted(wav_in_raw):
            try:
                shutil.copy(f, wav_path / f.name)
                print(f"  Copied: {f.name}")
                ok += 1
            except Exception as e:
                print(f"  ERROR copying {f.name} — {e}")
                failed.append(f.name)
        print()

    # Convert any .m4a/.mp3 files
    if audio_files:
        print(f"Found {len(audio_files)} .m4a/.mp3 file(s) to convert.\n")
        for audio_file in sorted(audio_files):
            try:
                print(f"  Converting: {audio_file.name}", end="  →  ", flush=True)
                audio       = AudioSegment.from_file(audio_file)
                output_file = wav_path / f"{audio_file.stem}.wav"
                audio.export(str(output_file), format="wav")
                print(f"saved as {output_file.name}")
                ok += 1
            except Exception as e:
                print(f"ERROR — {e}")
                failed.append(audio_file.name)

    print(f"\nStep 1 complete — {ok} processed, {len(failed)} failed.")
    if failed:
        print(f"  Failed: {', '.join(failed)}")
    print()
    return True



# 2 — NOISE REDUCTION (remove_noise)

def bandpass_filter(audio, sr, low=VOICE_LOW_HZ, high=VOICE_HIGH_HZ):
    """Keep only frequencies in the human voice range (80Hz–7000Hz)."""
    nyq  = sr / 2
    b, a = signal.butter(5, [low / nyq, high / nyq], btype="band")
    return signal.filtfilt(b, a, audio)


def estimate_noise_profile(audio, sr, duration_sec=NOISE_SAMPLE_SEC):
    """
    Find the quietest 0.5-second window in the first 2 seconds
    and use it as the noise reference for spectral subtraction.
    """
    search_end = min(int(2 * sr), len(audio))
    frame_len  = int(duration_sec * sr)
    best_start, best_rms = 0, float("inf")

    step = max(1, frame_len // 4)
    for start in range(0, search_end - frame_len, step):
        rms = np.sqrt(np.mean(audio[start:start + frame_len] ** 2))
        if rms < best_rms:
            best_rms, best_start = rms, start

    return audio[best_start: best_start + frame_len]


def adaptive_vad_mask(audio, sr, frame_ms=VAD_FRAME_MS):
    """
    Adaptive energy-based Voice Activity Detection.
    Threshold derived from each file's own noise floor.
    80ms smooth prevents clicks at speech boundaries.
    """
    frame_len = int(sr * frame_ms / 1000)
    n_frames  = len(audio) // frame_len

    rms_vals = np.array([
        np.sqrt(np.mean(audio[i * frame_len:(i + 1) * frame_len] ** 2))
        for i in range(n_frames)
    ])

    noise_floor = np.percentile(rms_vals, 10)
    threshold   = max(noise_floor * 1.5, 0.005)

    mask = np.zeros(len(audio))
    for i, rms in enumerate(rms_vals):
        if rms > threshold:
            mask[i * frame_len:(i + 1) * frame_len] = 1.0

    mask = uniform_filter1d(mask, size=int(sr * 0.08))
    return np.clip(mask, 0, 1)


def clean_one_file(input_path, output_path):
    """
    Full noise cleaning pipeline for one wav file:
    1. Load at 16kHz
    2. Non-stationary noise reduction
    3. Light stationary pass (hiss/hum removal)
    4. Bandpass filter (80Hz–7000Hz)
    5. Adaptive VAD masking
    6. Normalise to -1 dBFS
    7. Save as 16-bit PCM
    """
    audio, sr = librosa.load(input_path, sr=SAMPLE_RATE)

    noise_sample = estimate_noise_profile(audio, sr)

    cleaned = nr.reduce_noise(
        y=audio,
        sr=sr,
        y_noise=noise_sample,
        stationary=False,
        prop_decrease=NOISE_REDUCE_PROP,
        n_fft=1024,
        hop_length=256,
        freq_mask_smooth_hz=500,
        time_mask_smooth_ms=50,
    )

    cleaned = nr.reduce_noise(
        y=cleaned,
        sr=sr,
        stationary=True,
        prop_decrease=0.50,
    )

    cleaned = bandpass_filter(cleaned, sr)

    vad_mask = adaptive_vad_mask(cleaned, sr)
    cleaned  = cleaned * vad_mask

    peak = np.max(np.abs(cleaned))
    if peak > 0:
        cleaned = cleaned / peak * 0.891

    sf.write(output_path, cleaned, sr, subtype="PCM_16")
    return True


def remove_noise():
    """
    Apply noise reduction to all wav files in processed/wavs/
    and save cleaned files to dataset_clean/
    """
    print("=" * 60)
    print("STEP 2 — Noise reduction and cleaning")
    print("=" * 60)

    os.makedirs(CLEAN_AUDIO_DIR, exist_ok=True)

    wav_files = sorted([
        f for f in os.listdir(WAV_FOLDER)
        if f.lower().endswith(".wav")
    ])

    if not wav_files:
        print(f"ERROR: No .wav files found in '{WAV_FOLDER}'.")
        print("Make sure Step 1 (conversion) completed successfully.")
        return False

    print(f"Found {len(wav_files)} wav file(s) to clean.\n")
    ok, failed = 0, []

    for filename in wav_files:
        input_path  = os.path.join(WAV_FOLDER,      filename)
        output_path = os.path.join(CLEAN_AUDIO_DIR, filename)
        try:
            clean_one_file(input_path, output_path)
            print(f"  ✓  {filename}")
            ok += 1
        except Exception as e:
            print(f"  ✗  {filename}  →  {e}")
            failed.append(filename)

    print(f"\nStep 2 complete — {ok} cleaned, {len(failed)} failed.")
    if failed:
        print(f"  Failed: {', '.join(failed)}")
    print()
    return True


# 2 - WHISPER TRANSCRIPTION


def load_sinhala_whisper_model():
    """
    Load Sinhala fine-tuned Whisper model from Hugging Face.
    Uses GPU automatically if available.
    """
    print("Loading Sinhala fine-tuned Whisper model...")

    if torch.cuda.is_available():
        device      = 0
        torch_dtype = torch.float16
        print("  GPU detected — using CUDA")
    else:
        device      = -1
        torch_dtype = torch.float32
        print("  No GPU detected — using CPU")

    model = pipeline(
        task       = "automatic-speech-recognition",
        model      = "Lingalingeswaran/whisper-small-sinhala",
        device     = device,
        torch_dtype= torch_dtype,
    )

    print("  Sinhala Whisper model ready.\n")
    return model


def transcribe(wav_path, model):
    """Transcribe Sinhala audio using fine-tuned Whisper."""
    try:
        result = model(
            wav_path,
            generate_kwargs={
                "language": "sinhala",
                "task":     "transcribe",
            }
        )
    except Exception:
        result = model(wav_path)

    return result["text"].strip()


def is_sinhala_text(text):
    """Check if text contains actual Sinhala Unicode characters."""
    sinhala_chars = sum(1 for c in text if '\u0d80' <= c <= '\u0dff')
    return sinhala_chars > 0


# Groups of Sinhala letters that are acoustically indistinguishable
# (or near-indistinguishable) in modern spoken Sinhala, even though they
# are written differently. Each group is mapped to a single canonical
# character before WER comparison, so swaps within a group are NOT
# counted as transcription errors.
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

# Build a str.translate table mapping every letter in a group to the
# group's first letter (the canonical form).
_CONFUSABLE_TRANSLATION_TABLE = str.maketrans({
    ch: group[0]
    for group in CONFUSABLE_LETTER_GROUPS
    for ch in group[1:]
})


def normalize_confusables(text):
    """Map acoustically-confusable Sinhala letters to a canonical form
    so that WER doesn't penalize swaps between them."""
    return text.translate(_CONFUSABLE_TRANSLATION_TABLE)


def strip_punctuation(text):
    """
    Remove all punctuation characters so that Whisper's punctuation
    choices (question marks, periods, commas, quotes, dashes, etc. —
    stylistic artifacts of transcription, not part of what a child
    actually read aloud) are never scored as reading errors.

    Uses Unicode category rather than a hand-picked character list:
    every punctuation character in Unicode falls under a category
    starting with 'P' (Pc/Pd/Pe/Pf/Pi/Po/Ps — connectors, dashes,
    brackets, quotes, everything else), so this catches all of it
    without needing to be extended for characters not thought of in
    advance. Sinhala combining marks (vowel signs, virama/hal kirima,
    anusvara) are category 'M', not 'P', so they are correctly left
    untouched — they're part of the letters themselves.
    """
    return "".join(ch for ch in text if not unicodedata.category(ch).startswith("P"))


def calculate_wer(reference, hypothesis):
    """
    Word Error Rate using dynamic programming.
    WER = (substitutions + deletions + insertions) / total reference words
    Returns value between 0.0 and 1.0

    Punctuation is stripped and acoustically-confusable Sinhala letters
    are normalized to a canonical form first (see strip_punctuation and
    CONFUSABLE_LETTER_GROUPS), so neither contributes to the error count.
    """
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


def calculate_cer(reference, hypothesis):
    """
    Character Error Rate — same edit-distance approach as calculate_wer,
    but at the character level with spaces stripped from both strings
    first. Stripping spaces means word-boundary/segmentation differences
    (e.g. Whisper splitting one ground-truth word into two, or merging
    two into one) are NOT counted as errors, while genuine letter-level
    substitutions/insertions/deletions still are.

    Same punctuation-stripping and confusable-letter normalization as
    calculate_wer is applied first, for consistency.

    Returns value between 0.0 and 1.0
    """
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



# 3 — AUTO LABEL GENERATION


def get_fluency_label(wer):
    """
    WER-based label — kept for comparison/reporting only.
    0 = Fluent      (WER = 0.0)
    1 = Moderate    (WER 0.01 to 0.40)
    2 = Struggling  (WER > 0.40)
    """
    if wer <= WER_FLUENT:
        return 0
    elif wer <= WER_MODERATE:
        return 1
    else:
        return 2


def get_fluency_label_cer(cer):
    """
    CER-based label — PRIMARY fluency label used downstream
    (skill vectors, clustering, classification, CNN training).
    0 = Fluent      (CER <= 0.10)
    1 = Moderate    (CER 0.10 to 0.35)
    2 = Struggling  (CER > 0.35)
    """
    if cer <= CER_FLUENT:
        return 0
    elif cer <= CER_MODERATE:
        return 1
    else:
        return 2



# 4 — MEL SPECTROGRAM CONVERSION


def extract_mel(y, sr, output_path):
    """
    Convert audio to mel spectrogram.
    Shape: 128×128, normalised 0–1.
    Saved as .npy file for CNN training.
    """
    mel    = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=MEL_SHAPE[0])
    mel_db = librosa.power_to_db(mel, ref=np.max)

    if mel_db.shape[1] < MEL_SHAPE[1]:
        pad    = MEL_SHAPE[1] - mel_db.shape[1]
        mel_db = np.pad(mel_db, ((0, 0), (0, pad)), constant_values=mel_db.min())
    else:
        mel_db = mel_db[:, :MEL_SHAPE[1]]

    mn, mx = mel_db.min(), mel_db.max()
    if mx > mn:
        mel_db = (mel_db - mn) / (mx - mn)

    np.save(output_path, mel_db)
    return mel_db



# 7 - LIBROSA FEATURE EXTRACTION


def extract_features(y, sr, ground_truth=""):
    """
    Extract handcrafted audio features for 4D skill vector.

    Returns:
        duration_s          total clip length
        speech_duration_s   speech-only duration
        hesitation_count    pauses longer than 150ms
        mean_pause_s        average pause duration
        zcr                 zero crossing rate, SPEECH-ONLY (kept for
                             reference/comparison — no longer feeds the
                             fluency dimension or the RF, see chars_per_sec)
        energy_variance     RMS energy variance, speech-only
        chars_per_sec       PRIMARY fluency signal: ground-truth characters
                             (space-stripped, matching CER's methodology)
                             read per second of actual speech. Standard
                             WCPM-style reading-rate metric. Uses
                             speech_duration_s (not total clip duration) so
                             this doesn't double-count pausing, which is
                             already captured separately by hesitation/
                             mean_pause_s — pace and pausing are kept as
                             two distinct signals rather than conflated.

    zcr/energy_variance were previously computed over the ENTIRE raw clip
    including silence/background noise between words, which could dilute
    or inflate them depending on how much dead air a recording had. They
    are now computed on the concatenated speech-only segments instead,
    consistent with how speech_duration_s already worked.

    zcr alone was also found to be a poor fluency proxy on its own: it's a
    spectral/timbral characteristic of the sound during speech, not a
    measure of pace, so it can't detect a reading that took far longer
    than it should while still sounding acoustically ordinary moment-to-
    moment. A recording that was 4x longer than a clean read of the same
    sentence, with hesitation correctly maxed out, still scored a
    near-perfect ZCR-based fluency score — chars_per_sec fixes this by
    measuring duration directly rather than inferring it indirectly.
    """
    duration   = len(y) / sr
    intervals  = librosa.effects.split(y, top_db=30)

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
        speech_signal = y  # no speech detected at all — fall back to whole clip

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



# 8 — 4D SKILL VECTOR PER STUDENT


def build_skill_vectors(df):
    """
    Aggregate clip-level features into one 4D row per student.

    Dimensions (PRIMARY, CER-based — this is what feeds K-Means/RF):
        overall_accuracy      mean CER across all sentences
        fluency               mean chars_per_sec across all clips —
                               ground-truth characters read per second
                               of actual speech (a WCPM-style reading
                               rate). Replaces mean ZCR: ZCR is a
                               spectral/timbral characteristic that
                               stays roughly the same whether a word is
                               said instantly or after a long pause, so
                               it cannot detect a reading that took far
                               longer than it should while still sounding
                               acoustically ordinary moment-to-moment —
                               observed directly on a live recording that
                               was 4x longer than a clean read of the
                               same sentence yet scored a near-perfect
                               ZCR-based fluency. chars_per_sec measures
                               duration directly instead of inferring it.
        hesitation             mean pause duration across all clips
        sentence_length_gap   long CER minus short CER

    overall_accuracy_wer and sentence_length_gap_wer are kept as extra
    UNSCALED reference columns (not part of the 4D vector that gets
    MinMax-scaled and handed to clustering/classification) so the old
    WER-based numbers stay available for comparison. The WER-based
    length gap was found to be dominated by a dilution artifact — a
    single segmentation glitch swings WER much harder on a short
    reference sentence than the same glitch does on a long one, which
    made ~89% of students falsely look like "long sentences are
    easier." CER doesn't have this problem, hence CER is primary here.
    """
    # Per-CLIP scaler — fit on every individual clip's raw cer/
    # chars_per_sec/mean_pause_s BEFORE aggregation, distinct from the
    # per-STUDENT scaler fit further down. A per-student average
    # compresses variance heavily (each is a mean over ~68 sentences),
    # so its min/max is far narrower than what any single clip shows —
    # e.g. per-student mean CER might only range ~9%-68% across the
    # cohort, while individual clips span the full 0%-100%. Using the
    # per-student scaler on a single live clip (main.py's /assess)
    # causes near-constant clipping to 0 or 1, since most individual
    # sentences fall outside the narrow student-average band. This
    # scaler is what main.py should use for scaling one live clip —
    # clip compared to clip, not clip compared to a 68-sentence average.
    clip_dims = ["cer", "chars_per_sec", "mean_pause_s"]
    if len(df) > 0:
        clip_scaler = MinMaxScaler()
        clip_scaler.fit(df[clip_dims])
        os.makedirs(MODELS_DIR, exist_ok=True)
        joblib.dump(clip_scaler, CLIP_SCALER_PATH)
        print(f"  Saved     : {CLIP_SCALER_PATH}")

    records = []

    for student_id, group in df.groupby("student_id"):
        overall_wer  = group["wer"].mean()
        overall_cer  = group["cer"].mean()
        mean_cps     = group["chars_per_sec"].mean()
        mean_pause   = group["mean_pause_s"].mean()

        long_wer  = group[group["length_class"] == "long" ]["wer"].mean()
        short_wer = group[group["length_class"] == "short"]["wer"].mean()
        long_wer  = long_wer  if not np.isnan(long_wer)  else overall_wer
        short_wer = short_wer if not np.isnan(short_wer) else overall_wer

        long_cer  = group[group["length_class"] == "long" ]["cer"].mean()
        short_cer = group[group["length_class"] == "short"]["cer"].mean()
        long_cer  = long_cer  if not np.isnan(long_cer)  else overall_cer
        short_cer = short_cer if not np.isnan(short_cer) else overall_cer

        length_gap_wer = long_wer - short_wer
        length_gap_cer = long_cer - short_cer

        records.append({
            "student_id":              student_id,
            "overall_accuracy":        round(overall_cer, 4),
            "fluency":                 round(mean_cps,    4),
            "hesitation":              round(mean_pause,  4),
            "sentence_length_gap":     round(length_gap_cer, 4),
            "overall_accuracy_wer":    round(overall_wer, 4),
            "sentence_length_gap_wer": round(length_gap_wer, 4),
        })

    sv_df = pd.DataFrame(records)

    # Only the 4 PRIMARY (CER-based) dimensions get scaled and used
    # downstream — the _wer reference columns stay unscaled/untouched.
    dims = ["overall_accuracy", "fluency", "hesitation", "sentence_length_gap"]
    if len(sv_df) > 0:
        scaler     = MinMaxScaler()
        sv_df[dims] = scaler.fit_transform(sv_df[dims])
        sv_df[dims] = sv_df[dims].round(4)

        # Persist this scaler so main.py's live /assess endpoint can put
        # a single clip's raw CER/ZCR/pause on the SAME 0-1 scale as the
        # training cohort (and therefore the cluster centroids). Without
        # this, live assessments show raw, naturally-narrow-range values
        # (e.g. raw ZCR rarely exceeds ~0.2-0.3) next to centroids that
        # were scaled relative to the 62-student cohort's min/max — two
        # different scales that look like one, which is why fluency in
        # single-clip results always reads low regardless of how fluent
        # the reading actually was.
        os.makedirs(MODELS_DIR, exist_ok=True)
        joblib.dump(scaler, SKILL_SCALER_PATH)
        print(f"  Saved     : {SKILL_SCALER_PATH}")

    return sv_df



# 9 — SENTENCE DIFFICULTY ANALYSIS


def sentence_difficulty_analysis(df, output_csv):
    """
    Average CER per sentence across all students (PRIMARY ranking metric).
    Rank all 68 sentences hardest to easiest.
    avg_wer is kept as a reference column alongside avg_cer.
    Save CSV and bar chart.
    """
    sent_df = (
        df.groupby(["sentence_id", "length_class"])[["wer", "cer"]]
        .mean()
        .reset_index()
        .rename(columns={"wer": "avg_wer", "cer": "avg_cer"})
        .sort_values("avg_cer", ascending=False)
        .reset_index(drop=True)
    )
    sent_df["difficulty_rank"] = range(1, len(sent_df) + 1)
    sent_df["avg_wer"]         = sent_df["avg_wer"].round(4)
    sent_df["avg_cer"]         = sent_df["avg_cer"].round(4)
    sent_df.to_csv(output_csv, index=False)

    colours = [
        "#E24B4A" if lc == "long" else "#378ADD"
        for lc in sent_df["length_class"]
    ]

    fig, ax = plt.subplots(figsize=(18, 5))
    ax.bar(sent_df["sentence_id"].astype(str), sent_df["avg_cer"], color=colours)
    ax.set_xlabel("Sentence ID")
    ax.set_ylabel("Average CER")
    ax.set_title("Sentence Difficulty Ranking (CER) — Red = Long | Blue = Short")
    ax.tick_params(axis="x", rotation=90)

    from matplotlib.patches import Patch
    ax.legend(handles=[
        Patch(color="#E24B4A", label="Long sentences"),
        Patch(color="#378ADD", label="Short sentences"),
    ])

    plt.tight_layout()
    plt.savefig(SENT_DIFF_PNG, dpi=150)
    plt.close()

    print("  Top 5 hardest sentences:")
    for _, row in sent_df.head(5).iterrows():
        print(f"    Sentence {row['sentence_id']}  |  CER {row['avg_cer']:.3f}  (WER {row['avg_wer']:.3f})  |  {row['length_class']}")

    return sent_df



# MAIN PIPELINE


def run_transcribe_stage():
    """
    STAGE 1 — the slow part (dominated by Whisper ASR across every clip;
    this is the ~10 hour stage). Converts raw audio -> cleaned wav ->
    mel spectrograms + librosa features + Whisper transcription + WER/CER
    -> saves labels.csv.

    Once labels.csv exists, you do NOT need to re-run this to test changes
    to build_skill_vectors(), the scalers, or sentence_difficulty_analysis()
    — run only run_postprocess_stage() (or `python audio_pipeline.py
    --stage postprocess`), which reads labels.csv from disk and finishes
    in seconds, with no GPU, no Whisper model, and no audio files needed.

    Returns the labels DataFrame (or None on failure) so run_pipeline()
    can chain straight into postprocessing without a disk round-trip.
    """
    os.makedirs(WAV_FOLDER,       exist_ok=True)
    os.makedirs(CLEAN_AUDIO_DIR,  exist_ok=True)
    os.makedirs(MEL_OUTPUT_DIR,   exist_ok=True)
    os.makedirs(PIPELINE_OUT_DIR, exist_ok=True)

    # ── Step 1: Convert m4a/mp3 → wav ──────────────────────────
    success = convert_to_wav()
    if not success:
        return None

    # ── Step 2: Noise reduction ─────────────────────────────────
    success = remove_noise()
    if not success:
        return None

    # ── Validate inputs ─────────────────────────────────────────
    if not os.path.exists(GROUND_TRUTH_CSV):
        print(f"ERROR: '{GROUND_TRUTH_CSV}' not found.")
        return None

    gt_df = pd.read_csv(GROUND_TRUTH_CSV)
    gt_df["sentence_id"] = gt_df["sentence_id"].astype(str).str.zfill(3)
    gt_dict  = dict(zip(gt_df["sentence_id"], gt_df["text"]))
    len_dict = dict(zip(gt_df["sentence_id"], gt_df["length_class"]))
    print(f"Ground truth loaded — {len(gt_df)} sentences.\n")

    # ── Load Whisper ────────────────────────────────────────────
    print("=" * 60)
    print("PHASE 2 — Whisper Transcription + Feature Extraction")
    print("=" * 60)
    whisper_model = load_sinhala_whisper_model()

    # ── Find cleaned wav files ──────────────────────────────────
    wav_files = sorted([
        f for f in os.listdir(CLEAN_AUDIO_DIR)
        if f.lower().endswith(".wav")
    ])

    if not wav_files:
        print(f"ERROR: No .wav files found in '{CLEAN_AUDIO_DIR}'.")
        return None

    print(f"Found {len(wav_files)} cleaned files in '{CLEAN_AUDIO_DIR}'.")
    print(f"Mel spectrograms → '{MEL_OUTPUT_DIR}'\n")
    print("-" * 60)

    # ── Process each clip ───────────────────────────────────────
    records = []
    errors  = []

    for idx, filename in enumerate(wav_files):
        name  = filename.replace(".wav", "")
        parts = name.split("_")

        if len(parts) < 2:
            print(f"  [SKIP] {filename} — expected format: S001_001.wav")
            continue

        student_id  = parts[0].upper()
        sentence_id = parts[1].zfill(3)

        wav_path = os.path.join(CLEAN_AUDIO_DIR, filename)
        mel_path = os.path.join(MEL_OUTPUT_DIR,  f"{name}_mel.npy")

        print(f"[{idx+1:04d}/{len(wav_files)}] {filename}", end="  →  ", flush=True)

        try:
            # Look up ground truth first — extract_features needs it now
            # for chars_per_sec (reading rate = ground-truth chars / speech time)
            ground_truth = gt_dict.get(sentence_id, "")

            # Load cleaned audio
            y, sr = librosa.load(wav_path, sr=SAMPLE_RATE, mono=True)

            # Phase 4: Mel spectrogram
            extract_mel(y, sr, mel_path)

            # Phase 7: librosa features
            features = extract_features(y, sr, ground_truth)

            # Phase 2: Whisper transcription
            transcript = transcribe(wav_path, whisper_model)

            # Warn if transcript is not Sinhala script
            if transcript and not is_sinhala_text(transcript):
                print(f"\n  [WARNING] Non-Sinhala transcript for {filename}")
                print(f"  Transcript: {transcript[:80]}\n")

            # Phase 2: WER + CER calculation
            wer          = calculate_wer(ground_truth, transcript) if ground_truth else -1.0
            cer          = calculate_cer(ground_truth, transcript) if ground_truth else -1.0

            # Phase 3: Fluency labels.
            # fluency_label is the PRIMARY label (CER-based) — this is
            # the column train_models.py / train_cnn.py already read,
            # so no changes needed downstream for them to pick up CER.
            # fluency_label_wer is kept for comparison/reporting only.
            fluency_label     = get_fluency_label_cer(cer) if cer >= 0 else -1
            fluency_label_wer = get_fluency_label(wer)     if wer >= 0 else -1
            length_class      = len_dict.get(sentence_id, "unknown")

            record = {
                "student_id":        student_id,
                "sentence_id":       sentence_id,
                "audio_file":        filename,
                "mel_file":          f"{name}_mel.npy",
                "ground_truth":      ground_truth,
                "transcript":        transcript,
                "wer":               wer,
                "cer":               cer,
                "fluency_label":     fluency_label,
                "fluency_label_wer": fluency_label_wer,
                "length_class":      length_class,
                **features,
            }
            records.append(record)

            label_map = {0: "Fluent", 1: "Moderate", 2: "Struggling", -1: "N/A"}
            print(f"CER={cer:.3f}  [{label_map[fluency_label]}]  (WER={wer:.3f})  pause={features['mean_pause_s']}s")

        except Exception as e:
            print(f"ERROR — {e}")
            errors.append(filename)
            continue

    # ── Save labels.csv ─────────────────────────────────────────
    print("\n" + "=" * 60)
    df = pd.DataFrame(records)

    if len(df) == 0:
        print("ERROR: No records were processed successfully.")
        return None

    df.to_csv(LABELS_CSV, index=False)
    print("Phases 2, 3, 4, 7 complete.")
    print(f"  Processed : {len(df)} clips")
    print(f"  Errors    : {len(errors)} clips")
    print(f"  Saved     : {LABELS_CSV}")
    if errors:
        print(f"  Failed    : {', '.join(errors)}")

    return df


def run_recompute_features_stage():
    """
    STAGE 1.5 — fast (librosa + string comparison only, no Whisper, no
    GPU needed). Reloads each already-cleaned wav from dataset_clean/
    (via labels.csv's audio_file column) and recomputes duration_s,
    speech_duration_s, hesitation_count, mean_pause_s, zcr,
    energy_variance, chars_per_sec — AND wer, cer, fluency_label,
    fluency_label_wer, using the ALREADY-KNOWN transcript column
    against calculate_wer/calculate_cer. Whisper is never re-run;
    transcript/ground_truth are read, not regenerated.

    Use this after changing extract_features() OR calculate_wer/
    calculate_cer (e.g. the chars_per_sec redefinition, the speech-only
    zcr fix, or the punctuation-stripping fix) so those changes apply
    to your existing 4206-clip dataset without repeating the ~10hr
    transcription stage.

    Run this, then run_postprocess_stage() (or `--stage postprocess`) to
    rebuild skill_vectors.csv and the scalers from the corrected features.
    """
    if not os.path.exists(LABELS_CSV):
        print(f"ERROR: '{LABELS_CSV}' not found.")
        print("Run the transcribe stage first:")
        print("  python audio_pipeline.py --stage transcribe")
        return None

    print(f"Loading existing labels from '{LABELS_CSV}'...")
    df = pd.read_csv(LABELS_CSV, dtype={"sentence_id": str})
    print(f"  Loaded {len(df)} clips.\n")

    feature_cols = [
        "duration_s", "speech_duration_s", "hesitation_count",
        "mean_pause_s", "zcr", "energy_variance", "chars_per_sec",
    ]
    for col in feature_cols:
        if col not in df.columns:
            df[col] = np.nan

    print("=" * 60)
    print("RECOMPUTING FEATURES + WER/CER (no Whisper, no re-transcription)")
    print("=" * 60)

    errors = []
    for idx, row in df.iterrows():
        wav_path     = os.path.join(CLEAN_AUDIO_DIR, row["audio_file"])
        ground_truth = row["ground_truth"] if pd.notna(row["ground_truth"]) else ""
        transcript   = row["transcript"]   if pd.notna(row["transcript"])   else ""
        print(f"[{idx+1:04d}/{len(df)}] {row['audio_file']}", end="  →  ", flush=True)

        try:
            y, sr = librosa.load(wav_path, sr=SAMPLE_RATE, mono=True)
            features = extract_features(y, sr, ground_truth)
            for col in feature_cols:
                df.at[idx, col] = features[col]

            # Re-run WER/CER against the SAME transcript already on
            # disk — this is what picks up calculate_wer/calculate_cer
            # changes (confusable-letter groups, punctuation stripping,
            # etc.) without needing Whisper to run again.
            wer = calculate_wer(ground_truth, transcript) if ground_truth else -1.0
            cer = calculate_cer(ground_truth, transcript) if ground_truth else -1.0
            df.at[idx, "wer"] = wer
            df.at[idx, "cer"] = cer
            df.at[idx, "fluency_label"]     = get_fluency_label_cer(cer) if cer >= 0 else -1
            df.at[idx, "fluency_label_wer"] = get_fluency_label(wer)     if wer >= 0 else -1

            print(f"chars_per_sec={features['chars_per_sec']}  zcr={features['zcr']}  cer={cer}  wer={wer}")
        except Exception as e:
            print(f"ERROR — {e}")
            errors.append(row["audio_file"])
            continue

    df.to_csv(LABELS_CSV, index=False)
    print(f"\nFeature recompute complete.")
    print(f"  Updated   : {len(df) - len(errors)} clips")
    print(f"  Errors    : {len(errors)} clips")
    print(f"  Saved     : {LABELS_CSV}")
    if errors:
        print(f"  Failed    : {', '.join(errors)}")

    return df


def run_postprocess_stage(df=None):
    """
    STAGE 2 — the fast part (pure pandas aggregation on labels.csv; no
    audio files, no GPU, no Whisper model needed — finishes in seconds).
    Builds skill_vectors.csv + clip_scaler.pkl + skill_scaler.pkl (Phase
    8) and sentence_difficulty.csv/.png (Phase 9), then prints the same
    summary stats the full pipeline always has.

    Pass an in-memory df to chain straight from run_transcribe_stage()
    without a disk round-trip, or call with no arguments to load
    labels.csv from disk — the normal way to iterate on downstream
    logic (scalers, aggregation, thresholds) without re-transcribing.
    """
    if df is None:
        if not os.path.exists(LABELS_CSV):
            print(f"ERROR: '{LABELS_CSV}' not found.")
            print("Run the transcribe stage first:")
            print("  python audio_pipeline.py --stage transcribe")
            return
        print(f"Loading existing labels from '{LABELS_CSV}'...")
        # sentence_id must be read back as a zero-padded string (e.g.
        # "001") — without this, pandas' CSV parser infers it as an
        # int and strips the leading zeros, which would silently change
        # sentence_difficulty.csv's sentence_id formatting versus a
        # single full run.
        df = pd.read_csv(LABELS_CSV, dtype={"sentence_id": str})
        print(f"  Loaded {len(df)} clips.\n")

    os.makedirs(PIPELINE_OUT_DIR, exist_ok=True)
    os.makedirs(MODELS_DIR,       exist_ok=True)

    # ── 8: 4D Skill Vectors ───────────────────────────────
    print("\nPhase 8 — Building 4D skill vectors per student...")
    sv_df = build_skill_vectors(df)
    sv_df.to_csv(SKILL_VEC_CSV, index=False)
    print(f"  Students  : {len(sv_df)}")
    print(f"  Saved     : {SKILL_VEC_CSV}")
    print()
    print(sv_df.to_string(index=False))

    # ── 9: Sentence Difficulty ─────────────────────────────
    print("\nPhase 9 — Sentence difficulty analysis...")
    sentence_difficulty_analysis(df, SENT_DIFF_CSV)
    print(f"  Saved     : {SENT_DIFF_CSV}")
    print(f"  Chart     : {SENT_DIFF_PNG}")

    # ── Final Summary ─────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("POSTPROCESSING COMPLETE — Output files generated:")
    print(f"  {SKILL_VEC_CSV}")
    print(f"  {SENT_DIFF_CSV}")
    print(f"  {SENT_DIFF_PNG}")
    print(f"  {SKILL_SCALER_PATH}")
    print(f"  {CLIP_SCALER_PATH}")
    print()

    lmap = {0: "Fluent", 1: "Moderate", 2: "Struggling", -1: "N/A"}

    print("Fluency label distribution — PRIMARY (CER-based, fluency_label):")
    for lbl, count in df["fluency_label"].value_counts().sort_index().items():
        print(f"  {lmap.get(lbl, 'N/A'):12s} (label {lbl}) : {count} clips")

    print()
    print("Fluency label distribution — reference (WER-based, fluency_label_wer):")
    for lbl, count in df["fluency_label_wer"].value_counts().sort_index().items():
        print(f"  {lmap.get(lbl, 'N/A'):12s} (label {lbl}) : {count} clips")

    print()
    print("CER statistics across all clips:")
    print(df["cer"].describe().round(4).to_string())

    print()
    print("WER statistics across all clips:")
    print(df["wer"].describe().round(4).to_string())

    print("\n" + "=" * 60)
    print("Next steps:")
    print("  python train_models.py   — Phase 10 K-Means + Phase 11 Random Forest")
    print("  python train_cnn.py      — Phase 5 CNN fluency + Phase 6 CNN difficulty")
    print("=" * 60)


def run_pipeline():
    """Full pipeline, unchanged behavior: transcribe stage followed
    immediately by postprocess stage, chained in-memory."""
    print("=" * 60)
    print("Audio Pipeline — Complete Version")
    print("IT22169426 | AMARADASA V N N | R26-DS-009")
    print("=" * 60)
    print()

    df = run_transcribe_stage()
    if df is None or len(df) == 0:
        return

    run_postprocess_stage(df)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Sinhala reading fluency audio pipeline"
    )
    parser.add_argument(
        "--stage",
        choices=["all", "transcribe", "features", "postprocess"],
        default="all",
        help=(
            "'all' (default): full pipeline, same as before. "
            "'transcribe': wav conversion + noise reduction + Whisper "
            "transcription only -> labels.csv (the slow ~10hr part). "
            "'features': recompute zcr/energy_variance/chars_per_sec/wer/cer "
            "from the existing cleaned wavs in dataset_clean/, WITHOUT "
            "re-transcribing — fast, no GPU/Whisper needed. Use this after "
            "changing extract_features() to apply the fix to your existing "
            "dataset without repeating the ~10hr transcription stage. "
            "'postprocess': skill vectors + scalers + sentence difficulty "
            "only, reading labels.csv from disk (fast, no GPU/Whisper "
            "needed) — use this to iterate on downstream logic."
        ),
    )
    args = parser.parse_args()

    if args.stage == "all":
        run_pipeline()
    elif args.stage == "transcribe":
        run_transcribe_stage()
    elif args.stage == "features":
        run_recompute_features_stage()
    elif args.stage == "postprocess":
        run_postprocess_stage()
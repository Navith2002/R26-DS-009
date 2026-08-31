import os, sys, re, json, base64, shutil

# Windows consoles default to a legacy codepage (cp1252) that can't encode
# the emoji used in this module's prints (download_model(), CLI messages
# below) -- reconfigure stdout/stderr to UTF-8 so running this module
# directly (or importing it from main.py) doesn't crash on those prints.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

import cv2
import numpy as np
from pathlib import Path
from PIL import Image, ImageEnhance
import torch

from grammar_module import build_sentences

# Integrated into the WriteBright backend: this file now lives in
# backend/grammar_check/, and the TrOCR model weights were moved out to
# the shared backend/models/ folder (alongside the quality-analysis
# component's own models/Sinhala, models/Tamil) instead of being
# duplicated here. Resolved from __file__ (not the process's cwd) so
# `python main.py` finds the models regardless of the directory it was
# launched from.
_BACKEND_MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")
LOCAL_MODEL_DIR = os.path.join(_BACKEND_MODELS_DIR, "trocr_sinhala_model")

# Bilingual support: language-keyed model dirs + per-language script
# filter, added alongside LOCAL_MODEL_DIR rather than replacing it, so
# every existing single-language call site (LOCAL_MODEL_DIR,
# _check_model_exists(), download_model(), /health) keeps behaving
# exactly as before for Sinhala. Every function below defaults its new
# `language` parameter to "si", so an unmodified caller (e.g.
# low_confidence_retry.py's `pipeline.recognize_line(variant_bgr,
# num_beams=beams)`) is unaffected.
MODEL_DIRS = {
    "si": LOCAL_MODEL_DIR,
    "ta": os.path.join(_BACKEND_MODELS_DIR, "trocr_Tamil_model"),
}
# Sinhala/Tamil Unicode block filters, used by recognize_page() to drop
# lines OCR produced no real script content for.
SCRIPT_FILTERS = {
    "si": r'[඀-෿]{2,}',
    "ta": r'[஀-௿]{2,}',
}

# Falls back to the original hardcoded folder if DRIVE_FOLDER_ID isn't
# set in the environment/.env, so this keeps working unchanged for anyone
# who hasn't added it yet.
DRIVE_FOLDER_ID = os.environ.get("DRIVE_FOLDER_ID", "1XOkmHxjaReJovRZcXhUgreyrQ7fprjmS")

GEMINI_KEY    = os.environ.get("GEMINI_API_KEY", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Preprocessing params
BLUE_DIFF_THRESH = 15
BG_KERNEL_SIZE   = 51
CONTRAST_FACTOR  = 1.15
MIN_INK_PCT      = 1.0
MAX_INK_PCT      = 80.0
LINE_MERGE_GAP   = 8

MAX_MERGED_LINE_HEIGHT = 220
BG_CLEAN_THRESH  = 225
BG_GREY_THRESH   = 170

# EECF ERROR TAXONOMY
ZWJ        = '\u200d'
DIAC_RANGE = range(0x0DCF, 0x0DE0)
RETROFLEX_PAIRS = [('ළ','ල'),('ල','ළ'),('ණ','න'),('න','ණ'),
                   ('ට','ත'),('ත','ට'),('ඩ','ද'),('ද','ඩ'),('ශ','ෂ'),('ෂ','ශ'), ('ත','ථ'), ('ල','ළු'), ('ළු','ල')]

ERROR_LABELS = {
    'correct':     'Correct',
    'retroflex':   'Retroflex confusion',
    'vowel':       'Vowel / diacritic error',
    'zwj':         'ZWJ conjunct missing',
    'boundary':    'Word boundary error',
    'punctuation': 'Punctuation error',
    'other':       'Other error',
}

FEEDBACK = {
    'correct':     {'si': 'මෙම පේළියේ අක්ෂර වින්‍යාස දෝෂ නැමැත! හරිම හොඳයි !',
                    'en': 'You wrote this correctly! Great work!'},
    'retroflex':   {'si': 'ළ සහ ල, ණ සහ න — අකුරු හැඩය හොඳින් බලන්න.',
                    'en': 'Check similar letters: ළ vs ල, ණ vs න. Look at their shapes carefully.'},
    'vowel':       {'si': 'කෙටි ස්වරය (ි) සහ දිගු ස්වරය (ී) — දිග නිවැරදිව ලියන්න.',
                    'en': 'Check short vs long vowel: ි (short) vs ී (long). Is the sound long or short?'},
    'zwj':         {'si': 'ක්‍ර, ශ්‍ර වැනි සංයෝග අකුරු ශූන්‍ය-පළල සංයෝජකය සමඟ ලියන්න.',
                    'en': 'Conjunct letters (ක්‍ර, ශ්‍ර) need a special invisible joining mark between them.'},
    'boundary':    {'si': 'වචන අතරේ හිස් තැනක් දැමිය යුතුය.',
                    'en': 'Put a space between each word. Words should be written separately.'},
    'punctuation': {'si': 'විරාම ලකුණු (., ?, !) වාක්‍ය අවසානයේ දමන්න.',
                    'en': 'Punctuation marks (., ?, !) go at the END of a sentence.'},
    'other':       {'si': 'ලිවීමේ සමහර වැරදි ඇත. ගුරුතුමිය/ගුරුතුමා සමඟ කතා කරන්න.',
                    'en': 'Some writing errors detected. Please check with your teacher.'},
}

SKILL_MAP = {
    'retroflex':   'Phonological Awareness',
    'vowel':       'Orthographic Knowledge',
    'zwj':         'Morphological Knowledge',
    'boundary':    'Word Segmentation',
    'punctuation': 'Punctuation Mechanics',
    'other':       'General Writing',
    'correct':     'correct',   # handled separately; Fluency = overall accuracy
}

# Skills that can have errors (used to assign "correct" lines to their domain)
ERROR_SKILLS = {
    'Phonological Awareness', 'Orthographic Knowledge', 'Morphological Knowledge',
    'Word Segmentation', 'Punctuation Mechanics', 'General Writing',
}

# MODEL DOWNLOAD  (run once)

def download_model():
   
    try:
        import gdown
    except ImportError:
        print("Installing gdown...")
        os.system("pip install gdown -q")
        import gdown

    target = Path(LOCAL_MODEL_DIR)

    # Already downloaded?
    if target.exists() and (target / "config.json").exists():
        print(f"✅ Model already exists at {LOCAL_MODEL_DIR}")
        return

    # Your NEW Google Drive folder ID
    FOLDER_ID = DRIVE_FOLDER_ID

    print("\nDownloading Sinhala TrOCR model...")
    print(f"Saving to: {LOCAL_MODEL_DIR}")

    target.mkdir(parents=True, exist_ok=True)

    # Download ONLY this folder
    gdown.download_folder(
        id=FOLDER_ID,
        output=str(target),
        quiet=False,
        use_cookies=False
    )

    print("\n✅ Model downloaded successfully")

# PHASE 1: PAGE / LINE PREPROCESSING

def detect_bg_type(gray: np.ndarray) -> str:
    """
    Detect background type from the 90th percentile brightness.
    clean -> white/clean paper
    grey  -> mild shadow/show-through
    dark  -> heavy shadow
    """
    bg_brightness = np.percentile(gray, 90)

    if bg_brightness >= BG_CLEAN_THRESH:
        return "clean"
    elif bg_brightness >= BG_GREY_THRESH:
        return "grey"
    else:
        return "dark"

def normalize_background(gray: np.ndarray) -> np.ndarray:
    """
    Flatten uneven background using morphological background estimation.
    """
    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (BG_KERNEL_SIZE, BG_KERNEL_SIZE)
    )

    bg = cv2.dilate(gray, kernel)

    normalized = (
        gray.astype(np.float32) /
        np.maximum(bg.astype(np.float32), 1) *
        255
    )

    return np.clip(normalized, 0, 255).astype(np.uint8)


def apply_clahe(gray: np.ndarray) -> np.ndarray:
    """
    Improve local contrast for dark/heavily shadowed pages.
    """
    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    return clahe.apply(gray)


def remove_blue_lines(
    img_bgr: np.ndarray,
    gray: np.ndarray
) -> np.ndarray:
    """
    Remove blue ruled-paper lines.

    Pass 1:
        B-R channel difference.

    Pass 2:
        Morphological horizontal-line detection.

    Returns grayscale image.
    """

    h, w = img_bgr.shape[:2]

    b, g, r = cv2.split(img_bgr)
   
    # Pass 1: blue-line suppression
    
    blue_diff = b.astype(np.int16) - r.astype(np.int16)

    clean = gray.copy()

    clean[blue_diff > BLUE_DIFF_THRESH] = 245

    # Pass 2: morphological horizontal-line removal
    
    _, mask = cv2.threshold(
        clean,
        0,
        255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    h_kern_len = max(w // 5, 60)

    h_kern = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (h_kern_len, 1)
    )

    ruled = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        h_kern
    )

    ruled = cv2.dilate(
        ruled,
        cv2.getStructuringElement(
            cv2.MORPH_RECT,
            (1, 3)
        )
    )

    clean[ruled > 0] = 245

    return clean

def preprocess(img_bgr: np.ndarray) -> tuple[Image.Image, str]:
    """
    Adaptive preprocessing.

    IMPORTANT:
    This function does NOT deskew.

    Returns:
        PIL RGB image
        background type
    """
    if img_bgr is None:
        raise ValueError("preprocess() received None image")

    # Accept grayscale input too
    if len(img_bgr.shape) == 2 or img_bgr.shape[2] == 1:
        img_bgr = cv2.cvtColor(
            img_bgr,
            cv2.COLOR_GRAY2BGR
        )

    gray = cv2.cvtColor(
        img_bgr,
        cv2.COLOR_BGR2GRAY
    )

    bg_type = detect_bg_type(gray)

    # Type A: clean background
    
    if bg_type == "clean":

        clean = remove_blue_lines(
            img_bgr,
            gray
        )

    # Type B: grey / show-through
    
    elif bg_type == "grey":

        normalized = normalize_background(gray)

        clean = remove_blue_lines(
            img_bgr,
            normalized
        )

    # Type C: dark / heavy shadow
  
    else:

        normalized = normalize_background(gray)

        enhanced = apply_clahe(
            normalized
        )

        clean = remove_blue_lines(
            img_bgr,
            enhanced
        )

    # Mild noise reduction
    clean = cv2.medianBlur(
        clean,
        3
    )

    # TrOCR expects 3 channels
    gray_3ch = np.stack(
        [clean, clean, clean],
        axis=2
    )

    pil_img = Image.fromarray(
        gray_3ch,
        mode="RGB"
    )

    # Mild contrast enhancement
    pil_img = ImageEnhance.Contrast(
        pil_img
    ).enhance(CONTRAST_FACTOR)

    return pil_img, bg_type


def segment_lines(img: np.ndarray) -> list:
    
    padding = 4
    min_line_height = 25
    min_dark_pixels = 15
    merge_gap = LINE_MERGE_GAP

    if img is None:
        raise ValueError("segment_lines() received no image")

    # img is ALREADY PREPROCESSED.

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    h, w = gray.shape

    # Resize if very large
    if w > 2000:
        scale = 2000 / w
        gray = cv2.resize(gray, (2000, int(h * scale)))
        img = cv2.resize(img, (2000, int(h * scale)))
        h, w = gray.shape

    #  Adaptive threshold
    
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=31,
        C=12
    )

    # Light morphological connection
    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (3, 2)
    )

    binary = cv2.morphologyEx(
        binary,
        cv2.MORPH_CLOSE,
        kernel
    )
    
    row_sums = np.sum(binary // 255, axis=1)
    min_dark_pixels_eff = max(min_dark_pixels, int(w * 0.01))

    in_text = False
    start_row = 0
    bands = []

    for r, s in enumerate(row_sums):
        if not in_text and s >= min_dark_pixels_eff:
            in_text = True
            start_row = r

        elif in_text and s < min_dark_pixels_eff:
            in_text = False
            bands.append((start_row, r))

    if in_text:
        bands.append((start_row, h))

    # Merge nearby bands
    merged = []

    for top, bot in bands:
        would_be_height = bot - merged[-1][0] if merged else 0
        if (merged
                and (top - merged[-1][1]) <= merge_gap
                and would_be_height <= MAX_MERGED_LINE_HEIGHT):
            merged[-1] = (merged[-1][0], bot)
        else:
            merged.append([top, bot])

    # Split unusually tall bands
    final_bands = []

    def _split_band(top: int, bot: int, depth: int = 0):
        height = bot - top
        if height <= MAX_MERGED_LINE_HEIGHT or depth >= 2:
            final_bands.append([top, bot])
            return

        # Search the middle 70% for the weakest row — avoid the edges so a
        # split can't land right next to the band boundary and produce a
        # sliver.
        margin = max(1, int(height * 0.15))
        lo = top + margin
        hi = bot - margin

        if hi <= lo:
            final_bands.append([top, bot])
            return

        zone = row_sums[lo:hi]
        valley_offset = int(np.argmin(zone))
        valley_row = lo + valley_offset
        valley_val = row_sums[valley_row]
        band_avg = row_sums[top:bot].mean() if bot > top else 0

        if band_avg > 0 and valley_val <= 0.35 * band_avg:
            _split_band(top, valley_row, depth + 1)
            _split_band(valley_row, bot, depth + 1)
        else:
            # No convincing gap found — leave it as one (possibly just a
            # genuinely tall single line) rather than force a bad split.
            final_bands.append([top, bot])

    for top, bot in merged:
        _split_band(top, bot)

    # Return crops instead of saving
    line_crops = []

    for top, bot in final_bands:
        line_h = bot - top

        if line_h < min_line_height:
            continue

        t = max(0, top - padding)
        b = min(h, bot + padding)

        # Crop vertical band first
        band_img = img[t:b, 0:w]
        band_bin = binary[t:b, 0:w]

        # Find columns that contain ink
        col_sums = np.sum(band_bin // 255, axis=0)
        ink_cols = np.where(col_sums > 2)[0]

        if len(ink_cols) == 0:
            continue

        # Reject sparse fragments: a real handwritten line has ink spread
        # fairly continuously across its width. A stray leftover band
        # (e.g. the tail of a line that got split off by band detection)
        # tends to be a few isolated marks spread across a WIDE span with
        # very little actual ink between them. Ratio of ink-containing
        # columns to the span they cover catches this without penalizing
        # genuinely short words (which have a small span to begin with).
        col_span = ink_cols[-1] - ink_cols[0] + 1
        ink_col_ratio = len(ink_cols) / col_span
        if col_span > 100 and ink_col_ratio < 0.15:
            continue

        # Horizontal padding
        x1 = max(0, ink_cols[0] - 12)
        x2 = min(w, ink_cols[-1] + 12)

        # Crop comes directly from the PREPROCESSED page.
        crop = img[t:b, x1:x2]

        if crop is None or crop.size == 0:
            continue

        # Skip extremely thin/noisy crops
        ch, cw = crop.shape[:2]
        if ch < 20 or cw < 40:
            continue

        line_crops.append(crop)

    return line_crops

# PHASE 3: HTR — TEXT RECOGNITION
# Per-language caches (dict keyed by "si"/"ta"), not single globals, so
# both models can be loaded in the same running server without one
# evicting the other. Old single-language behaviour is unaffected --
# language defaults to "si" everywhere below, which reads/writes the
# exact same MODEL_DIRS["si"] == LOCAL_MODEL_DIR path as before.
_processors: dict[str, object] = {}
_models: dict[str, object]     = {}

def _check_model_exists(language: str = "si"):
    model_dir = MODEL_DIRS.get(language, LOCAL_MODEL_DIR)
    model_path = Path(model_dir)
    if not model_path.exists() or not (model_path / "config.json").exists():
        raise RuntimeError(
            f"\n❌ Model not found at: {model_dir}\n"
            f"   ({language} model)\n"
            f"   Run first: python pipeline.py download\n"
            f"   This downloads your model from Google Drive (~1.3GB)."
        )

def load_htr_model(language: str = "si"):
    if _processors.get(language) is not None:
        return
    _check_model_exists(language)
    model_dir = MODEL_DIRS.get(language, LOCAL_MODEL_DIR)
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel
    print(f"Loading HTR model ({language}) from {model_dir} ...")
    print(f"Device: {DEVICE}")
    _processors[language] = TrOCRProcessor.from_pretrained(model_dir)
    model = VisionEncoderDecoderModel.from_pretrained(model_dir).to(DEVICE)
    model.eval()
    _models[language] = model
    print(f"HTR model ({language}) loaded ✅")

# Below this sequence-probability threshold, treat the recognition as
# unreliable rather than fact — see recognize_line()'s docstring. This is
# an unvalidated starting point, not a calibrated cutoff: log a batch of
# (confidence, correct/incorrect) pairs against your test set and pick a
# threshold that actually separates them before trusting this for anything
# high-stakes (e.g. auto-generated feedback shown to a child).
LOW_CONFIDENCE_THRESHOLD = 0.9

def recognize_line(line_bgr: np.ndarray, num_beams: int = 4, language: str = "si") -> tuple[str, float]:
    """
    Returns (text, confidence). `confidence` is the beam's sequence
    probability — exp() of the average log-prob per generated token,
    i.e. the model's own estimate of how likely this exact output
    sequence was, normalised to length so it's comparable across
    short and long lines. It is NOT independently calibrated: a model
    can be systematically over- or under-confident. Use it as a
    relative "which lines are shakiest" signal, not an absolute
    probability of correctness, until you've checked it against labelled
    data (confidence vs. actual CER on your test set).

    num_beams defaults to 4 (unchanged first-pass behaviour). A wider
    beam explores more candidate sequences before picking the best one --
    useful when retrying a line the default beam width already got
    wrong, since the correct reading may exist further down the beam
    that a narrower search never reached. It costs roughly linear extra
    compute per call, so it's only worth raising for retries, not every
    line.
    """
    load_htr_model(language)
    processor = _processors[language]
    model     = _models[language]

    pil_img = Image.fromarray(
        cv2.cvtColor(line_bgr, cv2.COLOR_BGR2RGB)
    ).convert("RGB")

    pixel_vals = processor(
        images=pil_img,
        return_tensors="pt"
    ).pixel_values.to(DEVICE)

    with torch.no_grad():
        outputs = model.generate(
            pixel_vals,
            num_beams=num_beams,
            output_scores=True,
            return_dict_in_generate=True,
        )

    text = processor.batch_decode(
        outputs.sequences,
        skip_special_tokens=True
    )[0].strip()

    # sequences_scores is the beam's length-normalised cumulative log-prob
    # (transformers applies length_penalty internally). exp() turns it back
    # into a 0-1 probability-like number.
    if getattr(outputs, "sequences_scores", None) is not None:
        confidence = float(torch.exp(outputs.sequences_scores[0]).item())
    else:
        confidence = None  # generation config didn't return beam scores

    return text, confidence

def recognize_page(image_path, language: str = "si"):
    """
    Full-page recognition pipeline.

    Flow:

        Raw page
            ↓
        Page preprocessing
            ↓
        Line segmentation
            ↓
        Preprocessed line crops
            ↓
        HTR recognition
    """
    raw_img = cv2.imread(image_path)

    if raw_img is None:
        raise ValueError(
            f"Cannot read image: {image_path}"
        )

    print(
        f"  [recognize_page] input image: "
        f"{raw_img.shape[1]}x{raw_img.shape[0]}"
    )

    # STEP 1 — PREPROCESS FULL PAGE
    page_pil, page_bg_type = preprocess(
        raw_img
    )

    preprocessed_page = cv2.cvtColor(
        np.array(page_pil),
        cv2.COLOR_RGB2BGR
    )

    print(
        f"  [recognize_page] page preprocessing: "
        f"bg={page_bg_type}"
    )

    # OPTIONAL DEBUG SAVE
    debug_dir = Path("segmentation_debug") / Path(image_path).stem 
    debug_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    cv2.imwrite(
        str(debug_dir / "page_preprocessed.png"),
        preprocessed_page
    )

    # STEP 2 — SEGMENT PREPROCESSED PAGE
   
    line_crops = segment_lines(
        preprocessed_page
    )

    print(
        f"  [recognize_page] "
        f"segment_lines() found "
        f"{len(line_crops)} line(s)"
    )

    # STEP 3 — RECOGNIZE EACH LINE
    
    results = []

    for i, crop in enumerate(line_crops):
        # Save the ACTUAL segmented preprocessed image
        
        segmented_path = (
            debug_dir /
            f"line_{i:03d}_segmented_preprocessed.png"
        )

        cv2.imwrite(
            str(segmented_path),
            crop
        )

        # HTR
        text, confidence = recognize_line(
            crop, language=language
        )

        # Script-content filter (Sinhala/Tamil depending on `language`)
        if not re.search(
            SCRIPT_FILTERS.get(language, SCRIPT_FILTERS["si"]),
            text
        ):
            continue

        # Encode image for dashboard
        _, buf = cv2.imencode(
            ".png",
            crop
        )

        needs_review = (
            confidence is not None
            and confidence < LOW_CONFIDENCE_THRESHOLD
        )

        conf_str = f"{confidence:.3f}" if confidence is not None else "n/a"
        flag = "⚠️ NEEDS REVIEW" if needs_review else "ok"
        print(
            f"  [recognize_page] line_idx={i}  confidence={conf_str}  "
            f"(threshold={LOW_CONFIDENCE_THRESHOLD})  {flag}  text={text!r}"
        )

        results.append({
            "line_idx": i,
            "raw_text": text,
            "confidence": confidence,
            "needs_review": needs_review,
            "line_img": base64.b64encode(
                buf
            ).decode()
        })

    return results

# PHASE 4: LLM CORRECTION  — Gemini (free)
def correct_with_llm(lines: list) -> list:
   
    if not GEMINI_KEY:
        print("  ⚠️  No GEMINI_API_KEY — skipping LLM correction")
        print("     Get free key: https://aistudio.google.com")
        print("     Then: set GEMINI_API_KEY=AIza...")
        for line in lines:
            line['corrected_text']  = line['raw_text']
            line['correction_note'] = 'LLM skipped (no API key)'
        return lines

    try:
        from google import genai
    except ImportError:
        os.system("pip install google-genai -q")
        from google import genai

    client   = genai.Client(api_key=GEMINI_KEY)
    combined = '\n'.join(
        f"Line {l['line_idx']}: {l['raw_text']}" for l in lines
    )

    prompt = f"""You are a Sinhala language teacher helping grade 3-5 students.

These lines were recognized from handwritten Sinhala using OCR.
The OCR may have errors AND the student may have spelling/grammar errors too.

For EACH line:
1. Correct OCR errors AND student spelling/grammar mistakes
2. Fix: wrong retroflex letters (ල→ළ), wrong vowel length (ි→ී),
   missing ZWJ in conjuncts (ක්රීඩා→ක්‍රීඩා), word boundaries, punctuation
3. Note what changed briefly in English

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation:
{{
  "lines": [
    {{
      "line_idx": 0,
      "corrected": "corrected Sinhala text",
      "changes": "brief note or 'no changes'"
    }}
  ]
}}

Lines to correct:
{combined}"""

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[prompt],
        )
        raw  = response.text.strip()
        raw  = re.sub(r'^```json\s*', '', raw)
        raw  = re.sub(r'\s*```$',     '', raw)
        data = json.loads(raw)

        correction_map = {item['line_idx']: item for item in data['lines']}
        for line in lines:
            c = correction_map.get(line['line_idx'], {})
            line['corrected_text']  = c.get('corrected', line['raw_text'])
            line['correction_note'] = c.get('changes',   'no changes')

        print(f"  ✅ LLM correction done ({len(lines)} lines)")

    except json.JSONDecodeError:
        # Gemini sometimes adds extra text — try to extract a JSON block
        try:
            json_match = re.search(r'\{.*\}', raw, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                correction_map = {item['line_idx']: item for item in data['lines']}
                for line in lines:
                    c = correction_map.get(line['line_idx'], {})
                    line['corrected_text']  = c.get('corrected', line['raw_text'])
                    line['correction_note'] = c.get('changes',   'no changes')
            else:
                raise ValueError("No JSON found in response")
        except Exception as e2:
            print(f"  ⚠️  JSON parse failed: {e2}")
            for line in lines:
                line['corrected_text']  = line['raw_text']
                line['correction_note'] = 'parse error'

    except Exception as e:
        print(f"  ⚠️  Gemini correction failed: {e}")
        for line in lines:
            line['corrected_text']  = line['raw_text']
            line['correction_note'] = f'error: {str(e)[:60]}'

    return lines

# PHASE 5: ERROR CLASSIFICATION (EECF)
def classify_line_error(raw_text: str, corrected_text: str) -> dict:
    raw = str(raw_text).strip()
    cor = str(corrected_text).strip()

    if raw == cor:
        return {
            'error_type':  'correct',
            'error_label': ERROR_LABELS['correct'],
            'details':     '',
            'all_errors':  [],
            'skill':       'Fluency',  # correct lines don't penalise any specific skill
            'feedback_si': FEEDBACK['correct']['si'],
            'feedback_en': FEEDBACK['correct']['en'],
        }

    errors = []

    # ZWJ conjunct missing
    if cor.count(ZWJ) > raw.count(ZWJ):
        errors.append(('zwj', f'Missing {cor.count(ZWJ) - raw.count(ZWJ)} ZWJ conjunct(s)'))

    # Retroflex confusion
    for wrong, right in RETROFLEX_PAIRS:
        if raw.count(wrong) != cor.count(wrong):
            errors.append(('retroflex', f'{wrong}↔{right} confusion'))
            break

    # Vowel/diacritic
    vowel_pairs = [('\u0DD2','\u0DD3'), ('\u0DD4','\u0DD6'),
                   ('\u0DD0','\u0DD1'), ('\u0DCF',''), ('\u0DD9','')]
    for a, b in vowel_pairs:
        if b == '':
            if a in cor and a not in raw:
                errors.append(('vowel', f'Diacritic {a} missing'))
                break
        elif raw.count(a) != cor.count(a) or raw.count(b) != cor.count(b):
            errors.append(('vowel', f'Vowel {a}/{b} mismatch'))
            break

    # Word boundary
    raw_wc = len(raw.split())
    cor_wc = len(cor.split())
    if abs(raw_wc - cor_wc) >= 1 and 'zwj' not in [e[0] for e in errors]:
        errors.append(('boundary', f'Word count raw={raw_wc} vs correct={cor_wc}'))

    # Punctuation
    if re.match(r'^[.,!?;]', raw) and not re.match(r'^[.,!?;]', cor):
        errors.append(('punctuation', 'Punctuation at line start'))

    if not errors:
        errors.append(('other', 'Character substitution'))

    primary = errors[0][0]
    return {
        'error_type':  primary,
        'error_label': ERROR_LABELS[primary],
        'details':     ' | '.join(e[1] for e in errors),
        'all_errors':  [e[0] for e in errors],
        'skill':       SKILL_MAP[primary],
        'feedback_si': FEEDBACK[primary]['si'],
        'feedback_en': FEEDBACK[primary]['en'],
    }

# PHASE 6: SKILL DASHBOARD

def build_dashboard(classified_lines: list) -> dict:
    from collections import Counter

    total   = len(classified_lines)
    correct = sum(1 for l in classified_lines if l['error_type'] == 'correct')
    error_counts = Counter(
        l['error_type'] for l in classified_lines if l['error_type'] != 'correct'
    )
    accuracy = round(correct / max(total, 1) * 100, 1)

    # Fluency = overall accuracy across all lines
    skill_scores = {'Fluency': round(accuracy)}
    # Each error-type skill: 100 minus its error rate across all lines
    error_skill_map = {k: v for k, v in SKILL_MAP.items() if k != 'correct'}
    for skill in set(error_skill_map.values()):
        skill_errors = sum(1 for l in classified_lines if l.get('skill') == skill and l['error_type'] != 'correct')
        skill_scores[skill] = round((1 - skill_errors / max(total, 1)) * 100)

    dominant_error = error_counts.most_common(1)[0][0] if error_counts else 'correct'
    repeated       = [err for err, cnt in error_counts.items() if cnt >= 2]

    return {
        'total_lines':      total,
        'correct_lines':    correct,
        'accuracy_score':   accuracy,
        'error_counts':     dict(error_counts),
        'skill_scores':     skill_scores,
        'dominant_error':   dominant_error,
        'repeated_errors':  repeated,
        'primary_feedback': FEEDBACK[dominant_error],
        'lines':            classified_lines,
    }

# MAIN PIPELINE ENTRY POINT

def analyze_page(image_path: str, language: str = "si") -> dict:
    """
    `language`: "si" (default, unchanged behaviour) or "ta". Selects which
    HTR model dir and which correction/grammar modules run -- the Sinhala
    and Tamil code paths are separate modules (hybrid_corrector.py /
    hybrid_corrector_ta.py, grammar_module.py / grammar_module_ta.py), so
    picking "ta" here cannot touch the Sinhala modules or their state.
    """
    if language not in MODEL_DIRS:
        print(f"  ⚠️  Unknown language {language!r}, falling back to 'si'")
        language = "si"

    print(f"\nAnalyzing: {image_path}  (language={language})")

    print("  Step 1: Segmenting + recognizing lines...")
    lines = recognize_page(image_path, language=language)
    print(f"  Found {len(lines)} text lines")

    if not lines:
        return {'error': 'No text lines found in image'}

    print("  Step 1b: Retrying low-confidence lines (alternate preprocessing)...")
    # low_confidence_retry.py is a separate module (not part of this file)
    # so this pipeline's own preprocess()/segment_lines() stay untouched --
    # see low_confidence_retry.py's module docstring for why.
    from low_confidence_retry import enrich_low_confidence_lines

    if language == "ta":
        from hybrid_corrector_ta import _get_corrector, process_htr_lines
    else:
        from hybrid_corrector import _get_corrector, process_htr_lines

    # Reuse the same cached HybridCorrector/TrustedLexicon singleton
    # spelling correction already builds, instead of constructing a second
    # large candidate index just for retry ranking.
    lines = enrich_low_confidence_lines(
        image_path, lines, lexicon=_get_corrector().lexicon, language=language
    )

    print("  Step 2: Hybrid spelling correction + error classification...")
    # process_htr_lines handles token/line-level correction, EECF error
    # classification, AND sentence assembly + LLM grammar correction
    # (via build_sentences) — its output already includes a 'sentences'
    # key that dashboard.html renders, using the same field names
    # (feedback_si/feedback_en/grammar_note) for both languages so the
    # dashboard's rendering code needs no per-language branching.
    dashboard = process_htr_lines(lines)

    print(f"  Done. Accuracy: {dashboard['accuracy_score']}%  "
          f"Sentences: {len(dashboard.get('sentences', []))}")
    return dashboard

# NOTE: The HTTP API server used to live here as a Flask app
# (run_server()). It has moved to main.py as a FastAPI app -- see that
# file for the /analyze and /health routes. This module now only exposes
# the pipeline functions (download_model, analyze_page) plus a small CLI
# for offline/manual use.

# ENTRY POINT

if __name__ == '__main__':
    import sys

    if len(sys.argv) >= 2 and sys.argv[1] == 'download':
        download_model()

    elif len(sys.argv) == 3 and sys.argv[1] == 'test':
        result = analyze_page(sys.argv[2])
        print(json.dumps(result, ensure_ascii=False, indent=2))

    else:
        print("Usage:")
        print("   python pipeline.py download          # download TrOCR model(s)")
        print("   python pipeline.py test <image_path>  # run the pipeline once, print JSON")
        print("   uvicorn main:app --reload --port 6060 # start the FastAPI server (main.py)")
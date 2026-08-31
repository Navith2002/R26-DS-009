from __future__ import annotations

import cv2
import numpy as np
from PIL import Image, ImageEnhance
from typing import Optional

import pipeline 
RETRY_NUM_BEAMS = 8

def find_line_boxes_raw(raw_img: np.ndarray, preprocessed_page: np.ndarray) -> list[tuple[int, int, int, int]]:
    """
    Returns a list of (top, bottom, x1, x2) boxes, ONE PER LINE, in the
    coordinate space of `raw_img` (the untouched original page) -- so
    raw_img[top:bottom, x1:x2] reproduces (up to the resize pipeline.
    segment_lines() applies internally to wide pages) the same region
    pipeline.segment_lines() cropped its line images from.
    """
    padding          = 8
    min_line_height  = 25
    min_dark_pixels  = 15
    merge_gap        = pipeline.LINE_MERGE_GAP

    gray = cv2.cvtColor(preprocessed_page, cv2.COLOR_BGR2GRAY)
    h0, w0 = gray.shape

    # Mirror segment_lines()'s internal resize-if-wide step, tracking the
    # scale factor so boxes can be mapped back to raw-page coordinates.
    scale = 1.0
    if w0 > 2000:
        scale = 2000 / w0
        gray = cv2.resize(gray, (2000, int(h0 * scale)))
    h, w = gray.shape

    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, blockSize=31, C=12,
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 2))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    row_sums = np.sum(binary // 255, axis=1)
    min_dark_pixels_eff = max(min_dark_pixels, int(w * 0.01))

    in_text, start_row, bands = False, 0, []
    for r, s in enumerate(row_sums):
        if not in_text and s >= min_dark_pixels_eff:
            in_text, start_row = True, r
        elif in_text and s < min_dark_pixels_eff:
            in_text = False
            bands.append((start_row, r))
    if in_text:
        bands.append((start_row, h))

    merged = []
    for top, bot in bands:
        would_be_height = bot - merged[-1][0] if merged else 0
        if (merged and (top - merged[-1][1]) <= merge_gap
                and would_be_height <= pipeline.MAX_MERGED_LINE_HEIGHT):
            merged[-1] = (merged[-1][0], bot)
        else:
            merged.append([top, bot])

    final_bands = []

    def _split_band(top: int, bot: int, depth: int = 0):
        height = bot - top
        if height <= pipeline.MAX_MERGED_LINE_HEIGHT or depth >= 2:
            final_bands.append([top, bot])
            return
        margin = max(1, int(height * 0.15))
        lo, hi = top + margin, bot - margin
        if hi <= lo:
            final_bands.append([top, bot])
            return
        zone = row_sums[lo:hi]
        valley_row = lo + int(np.argmin(zone))
        valley_val = row_sums[valley_row]
        band_avg = row_sums[top:bot].mean() if bot > top else 0
        if band_avg > 0 and valley_val <= 0.35 * band_avg:
            _split_band(top, valley_row, depth + 1)
            _split_band(valley_row, bot, depth + 1)
        else:
            final_bands.append([top, bot])

    for top, bot in merged:
        _split_band(top, bot)

    boxes_working_space = []
    for top, bot in final_bands:
        if bot - top < min_line_height:
            continue

        t = max(0, top - padding)
        b = min(h, bot + padding)
        band_bin = binary[t:b, 0:w]
        col_sums = np.sum(band_bin // 255, axis=0)
        ink_cols = np.where(col_sums > 2)[0]
        if len(ink_cols) == 0:
            continue

        col_span = ink_cols[-1] - ink_cols[0] + 1
        if col_span > 100 and (len(ink_cols) / col_span) < 0.15:
            continue

        x1 = max(0, ink_cols[0] - 12)
        x2 = min(w, ink_cols[-1] + 12)
        if (b - t) < 20 or (x2 - x1) < 40:
            continue

        boxes_working_space.append((t, b, x1, x2))

    # Map back from (possibly resized) working space to raw_img coordinates.
    raw_h, raw_w = raw_img.shape[:2]
    boxes_raw = []
    for t, b, x1, x2 in boxes_working_space:
        rt = max(0, min(raw_h, int(round(t / scale))))
        rb = max(0, min(raw_h, int(round(b / scale))))
        rx1 = max(0, min(raw_w, int(round(x1 / scale))))
        rx2 = max(0, min(raw_w, int(round(x2 / scale))))
        boxes_raw.append((rt, rb, rx1, rx2))

    return boxes_raw


def _normalize_background(gray: np.ndarray, kernel_size: int, pre_blur: bool) -> np.ndarray:
    smoothed = cv2.medianBlur(gray, 9) if pre_blur else gray
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    bg = cv2.dilate(smoothed, kernel)
    normalized = gray.astype(np.float32) / np.maximum(bg.astype(np.float32), 1) * 255
    return np.clip(normalized, 0, 255).astype(np.uint8)


def _apply_clahe(gray: np.ndarray) -> np.ndarray:
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _remove_blue_lines(img_bgr: np.ndarray, gray: np.ndarray, blue_diff_thresh: int) -> np.ndarray:
    h, w = img_bgr.shape[:2]
    b, g, r = cv2.split(img_bgr)
    blue_diff = b.astype(np.int16) - r.astype(np.int16)
    clean = gray.copy()
    clean[blue_diff > blue_diff_thresh] = 245

    _, mask = cv2.threshold(clean, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    h_kern_len = max(w // 5, 60)
    h_kern = cv2.getStructuringElement(cv2.MORPH_RECT, (h_kern_len, 1))
    ruled = cv2.morphologyEx(mask, cv2.MORPH_OPEN, h_kern)
    ruled = cv2.dilate(ruled, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 3)))
    clean[ruled > 0] = 245
    return clean


def _preprocess_variant(crop_bgr: np.ndarray, recipe: dict) -> np.ndarray:
    """
    Runs one alternate preprocessing recipe over a raw line crop.
    Returns a BGR np.ndarray (same shape convention pipeline.recognize_line()
    expects -- it does its own BGR->RGB conversion).
    """
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)

    if recipe.get("plain"):
        # No background normalization, no blue-line removal, no CLAHE, no
        # smoothing -- just the raw grayscale conversion. Every other
        # recipe assumes the first pass was hurt by a preprocessing
        # ARTIFACT and tries to correct it; this one tests the opposite
        # hypothesis -- that the cleanup steps themselves (background
        # division, blue-line suppression) are the thing erasing/
        # distorting genuine ink on a line that's wrong for some other
        # reason. If this wins, the fix isn't "a better recipe", it's
        # "less processing".
        clean = gray
    else:
        bg_type = recipe.get("force_bg_type") or pipeline.detect_bg_type(gray)

        if bg_type == "clean":
            clean = gray
        else:
            clean = _normalize_background(gray, kernel_size=51, pre_blur=recipe["pre_blur"])
            if bg_type == "dark" or recipe.get("force_clahe"):
                clean = _apply_clahe(clean)

        clean = _remove_blue_lines(crop_bgr, clean, blue_diff_thresh=recipe["blue_diff_thresh"])

        if recipe.get("median_blur", True):
            clean = cv2.medianBlur(clean, 3)

    gray_3ch = np.stack([clean, clean, clean], axis=2)
    pil_img = Image.fromarray(gray_3ch, mode="RGB")
    pil_img = ImageEnhance.Contrast(pil_img).enhance(recipe.get("contrast_factor", 1.0))

    return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)


# Each recipe targets a specific plausible cause of the first pass being
# wrong (see the conversation: wrong background-type branch chosen,
# JPEG/photo noise amplified into the background estimate, ruled-line
# removal too aggressive/too lenient). Kept short deliberately -- more
# recipes = more model calls per low-confidence line.
DEFAULT_RECIPES = [
    {
        "name": "preblur_autobg",
        # Same branch pipeline.preprocess() would pick, but WITH the
        # median-pre-blur fix (already applied in phase1_preprocess.py,
        # never backported into pipeline.py's own copy of these
        # functions) -- catches lines hurt by block-noise amplification.
        "force_bg_type": None, "pre_blur": True, "force_clahe": False,
        "blue_diff_thresh": 15, "contrast_factor": 1.15, "median_blur": True,
    },
    {
        "name": "force_dark_clahe",
        # For lines near the clean/grey boundary that were actually
        # under-lit -- forces the heavier shadow-recovery branch.
        "force_bg_type": "dark", "pre_blur": True, "force_clahe": True,
        "blue_diff_thresh": 15, "contrast_factor": 1.15, "median_blur": True,
    },
    {
        "name": "gentle_line_removal",
        # Higher blue-diff threshold = less aggressive ruled-line
        # suppression, for cases where real ink strokes crossing a
        # ruled line got eaten.
        "force_bg_type": None, "pre_blur": True, "force_clahe": False,
        "blue_diff_thresh": 28, "contrast_factor": 1.2, "median_blur": True,
    },
    {
        "name": "no_smoothing_high_contrast",
        # Skips the median-blur smoothing step and pushes contrast
        # harder -- for faint/thin handwriting the smoothing step can
        # blur away rather than clean up.
        "force_bg_type": None, "pre_blur": True, "force_clahe": False,
        "blue_diff_thresh": 15, "contrast_factor": 1.35, "median_blur": False,
    },
    {
        "name": "plain_grayscale",
        # No background normalization, no blue-line removal, no CLAHE, no
        # smoothing, no contrast change -- just plain grayscale. See the
        # comment in _preprocess_variant(): this is the "less is more"
        # control for lines that are wrong for reasons other than a
        # preprocessing artifact.
        "plain": True,
    },
    {
        "name": "same_pixels_wider_beam",
        # Mirrors pipeline.py's OWN preprocess() defaults as closely as
        # possible (same branch auto-detection, same blue-diff threshold
        # and contrast factor, pre_blur=False to match pipeline.py's
        # actual un-fixed normalize_background rather than the fixed
        # phase1_preprocess.py version) -- i.e. deliberately NOT a
        # different preprocessing recipe. The only thing that changes vs.
        # the first pass is the beam width (RETRY_NUM_BEAMS). Isolates
        # "does a wider beam alone find the right answer" from "does
        # different preprocessing find the right answer" -- for a line
        # that's wrong because the model's top beam hypothesis was wrong
        # (not because the pixels were bad), this is the one most likely
        # to help.
        "force_bg_type": None, "pre_blur": False, "force_clahe": False,
        "blue_diff_thresh": pipeline.BLUE_DIFF_THRESH,
        "contrast_factor": pipeline.CONTRAST_FACTOR, "median_blur": True,
    },
]

def _lexicon_score(text: str, lexicon) -> Optional[float]:
    """
    Average TrustedLexicon self-score across the line's tokens -- how
    well each recognized word matches real lexical evidence (dictionary
    / morphology / corpus / frequency). Same scoring hybrid_corrector.py
    already uses for spelling candidates (score_candidate(token, token)
    as the "how plausible is this exact token" baseline), reused here so
    OCR-candidate selection and spelling correction trust the same
    evidence rather than two disagreeing signals.
    """
    if lexicon is None:
        return None
    tokens = text.split()
    if not tokens:
        return 0.0
    scores = [lexicon.score_candidate(tok, tok) for tok in tokens]
    return sum(scores) / len(scores)


def retry_low_confidence_line(
    raw_img: np.ndarray,
    bbox: tuple[int, int, int, int],
    first_text: str,
    first_confidence: Optional[float],
    lexicon=None,
    recipes: Optional[list[dict]] = None,
    language: str = "si",
) -> Optional[dict]:
    """
    Tries every recipe on the RAW crop at `bbox`, re-runs pipeline.
    recognize_line() (unmodified) on each, and returns
    {"winner": {...}, "candidates": [...]}  -- or None if the crop is
    empty. The first-pass result is included as a candidate too, so a
    second pass can never make things worse: if nothing beats it, it
    wins by construction.
    """
    t, b, x1, x2 = bbox
    raw_crop = raw_img[t:b, x1:x2]
    if raw_crop.size == 0:
        return None

    conf_str = f"{first_confidence:.3f}" if first_confidence is not None else "n/a"
    print(f"[retry] line bbox=({t},{b},{x1},{x2})  first_pass conf={conf_str}  text={first_text!r}")

    candidates = [{"recipe": "first_pass", "text": first_text, "confidence": first_confidence}]

    for recipe in (recipes or DEFAULT_RECIPES):
        variant_bgr = _preprocess_variant(raw_crop, recipe)
        beams = recipe.get("num_beams", RETRY_NUM_BEAMS)
        text, confidence = pipeline.recognize_line(variant_bgr, num_beams=beams, language=language)
        candidates.append({"recipe": recipe["name"], "text": text, "confidence": confidence})
        conf_str = f"{confidence:.3f}" if confidence is not None else "n/a"
        print(f"[retry]   recipe={recipe['name']:<26} beams={beams}  conf={conf_str}  text={text!r}")

    for c in candidates:
        c["lexicon_score"] = _lexicon_score(c["text"], lexicon)
        score_str = f"{c['lexicon_score']:.3f}" if c["lexicon_score"] is not None else "n/a"
        print(f"[retry]     ranking: recipe={c['recipe']:<26} lexicon_score={score_str}")

    if lexicon is not None:
        winner = max(candidates, key=lambda c: c["lexicon_score"] if c["lexicon_score"] is not None else -1.0)
        by = "lexicon_score"
    else:
        winner = max(candidates, key=lambda c: c["confidence"] if c["confidence"] is not None else -1.0)
        by = "confidence"

    if winner["recipe"] == "first_pass":
        print(f"[retry]   -> kept first_pass (no recipe beat it, ranked by {by})")
    else:
        print(f"[retry]   -> switched to recipe={winner['recipe']!r}  text={winner['text']!r}  (ranked by {by})")

    return {"winner": winner, "candidates": candidates}


# ─────────────────────────────────────────────────────────────────────────
# STEP 4 — orchestration entry points
# ─────────────────────────────────────────────────────────────────────────

def enrich_low_confidence_lines(
    image_path: str,
    lines: list[dict],
    lexicon=None,
    recipes: Optional[list[dict]] = None,
    language: str = "si",
) -> list[dict]:
    """
    Takes the `lines` list pipeline.recognize_page(image_path) already
    produced (each with 'needs_review' from LOW_CONFIDENCE_THRESHOLD) and
    retries only the flagged ones. Mutates and returns the same list.

    For a retried line: 'retry_attempted'=True, 'retry_candidates' holds
    every attempt for inspection/debugging, and IF a recipe beat the
    first pass, 'raw_text'/'confidence'/'needs_review' are updated to the
    winner (with the original values kept under
    'raw_text_before_retry'/'confidence_before_retry' so nothing is lost).

    Pass `lexicon` (a TrustedLexicon, e.g. an existing
    SinhalaHybridCorrector instance's `.lexicon`) to rank candidates by
    lexical plausibility rather than raw HTR confidence alone -- strongly
    recommended, since two OCR misreads can easily have similar
    confidence while only one is a real word.
    """
    raw_img = cv2.imread(image_path)
    if raw_img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    preprocessed_pil, _ = pipeline.preprocess(raw_img)
    preprocessed_page = cv2.cvtColor(np.array(preprocessed_pil), cv2.COLOR_RGB2BGR)
    boxes = find_line_boxes_raw(raw_img, preprocessed_page)

    flagged = [l for l in lines if l.get("needs_review")]
    print(f"[retry] {len(lines)} line(s) total, {len(flagged)} flagged needs_review "
          f"(confidence < {pipeline.LOW_CONFIDENCE_THRESHOLD}), lexicon={'on' if lexicon is not None else 'off (using raw confidence)'}")

    switched, kept, skipped = 0, 0, 0

    for line in lines:
        if not line.get("needs_review"):
            continue

        idx = line["line_idx"]
        if idx >= len(boxes):
            # Segmentation of this bbox-finding pass didn't line up with
            # pipeline.segment_lines()'s own count for this page -- skip
            # rather than guess at the wrong box.
            line["retry_attempted"] = False
            line["retry_error"] = "bbox/line-count mismatch with segment_lines()"
            print(f"[retry] line_idx={idx}: SKIPPED (bbox/line-count mismatch)")
            skipped += 1
            continue

        result = retry_low_confidence_line(
            raw_img, boxes[idx], line["raw_text"], line["confidence"],
            lexicon=lexicon, recipes=recipes, language=language,
        )
        if result is None:
            line["retry_attempted"] = False
            print(f"[retry] line_idx={idx}: SKIPPED (empty crop)")
            skipped += 1
            continue

        line["retry_attempted"]  = True
        line["retry_candidates"] = result["candidates"]
        winner = result["winner"]

        if winner["recipe"] != "first_pass":
            line["raw_text_before_retry"]   = line["raw_text"]
            line["confidence_before_retry"] = line["confidence"]
            line["raw_text"]         = winner["text"]
            line["confidence"]       = winner["confidence"]
            line["retry_recipe_used"] = winner["recipe"]
            line["needs_review"] = (
                winner["confidence"] is not None
                and winner["confidence"] < pipeline.LOW_CONFIDENCE_THRESHOLD
            )
            switched += 1
        else:
            line["retry_recipe_used"] = "first_pass (no recipe beat it)"
            kept += 1

    if flagged:
        print(f"[retry] summary: {switched} switched to a retry result, "
              f"{kept} kept first-pass, {skipped} skipped")

    return lines


def analyze_page_with_retry(image_path: str, lexicon=None, recipes: Optional[list[dict]] = None) -> dict:
    """
    Drop-in alternative to pipeline.analyze_page() that adds the
    low-confidence retry step in between recognition and correction.
    pipeline.py itself is untouched -- this just composes its unmodified
    pieces plus the retry step defined above.
    """
    lines = pipeline.recognize_page(image_path)
    if not lines:
        return {"error": "No text lines found in image"}

    lines = enrich_low_confidence_lines(image_path, lines, lexicon=lexicon, recipes=recipes)

    from hybrid_corrector import process_htr_lines
    dashboard = process_htr_lines(lines)
    return dashboard


if __name__ == "__main__":
    import sys, json
    if len(sys.argv) != 2:
        print("Usage: python low_confidence_retry.py <image_path>")
        sys.exit(1)

    # Reuse the same cached SinhalaHybridCorrector/TrustedLexicon
    # singleton process_htr_lines() uses (hybrid_corrector._get_corrector),
    # so this CLI path and the live app build the ~320k-word candidate
    # index exactly once, not twice.
    from hybrid_corrector import _get_corrector
    lexicon = _get_corrector().lexicon

    result = analyze_page_with_retry(sys.argv[1], lexicon=lexicon)
    print(json.dumps(result, ensure_ascii=False, indent=2))

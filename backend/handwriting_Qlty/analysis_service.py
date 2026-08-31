"""
analysis_service.py
===================

Final audited orchestration for Sinhala/Tamil Handwriting Quality Analysis.

Flow
----
Image
 -> preprocessing
 -> line/word/character-region segmentation
 -> Stage 1A input-image quality gate
 -> Stage 1B segmentation reliability gate
 -> Stage 2 language-specific structural features
 -> calibrated ML model
 -> model label + confidence + teacher-review advisory
 -> teacher-calibrated issue explanations
 -> top-3 child-friendly recommendations

The calibrated ML model is the single source of truth for the final quality
class. Low confidence no longer hides the model label; it adds a teacher-review
advisory while preserving the predicted class and confidence percentage.
"""

import json
import os
import warnings

import cv2
import joblib
import numpy as np
import pandas as pd
import sklearn

# Package-safe imports. This supports both:
#   from handwriting_Qlty.analysis_service import ...
# and direct module execution during local debugging.
try:
    from .image_utils import ensure_gray, ensure_ink_white
    from .preprocessing import (
        correct_skew,
        remove_shadow,
        binarize,
        remove_ruled_lines,
    )
    from .segmentation import (
        segment_lines,
        segment_words,
        segment_character_regions,
    )
    from .segmentation_quality import (
        evaluate_segmentation_reliability,
    )
    from .feature_extraction import (
        calculate_readability_features,
        extract_quality_features,
        validate_feature_vector,
    )
    from .character_quality import (
        analyze_character_records,
    )
    from .issue_detection import (
        detect_issues,
        load_issue_thresholds,
    )
    from .recommendations import (
        generate_recommendations,
    )
except ImportError:
    from image_utils import ensure_gray, ensure_ink_white
    from preprocessing import (
        correct_skew,
        remove_shadow,
        binarize,
        remove_ruled_lines,
    )
    from segmentation import (
        segment_lines,
        segment_words,
        segment_character_regions,
    )
    from segmentation_quality import (
        evaluate_segmentation_reliability,
    )
    from feature_extraction import (
        calculate_readability_features,
        extract_quality_features,
        validate_feature_vector,
    )
    from character_quality import (
        analyze_character_records,
    )
    from issue_detection import (
        detect_issues,
        load_issue_thresholds,
    )
    from recommendations import (
        generate_recommendations,
    )


# ============================================================
# PATHS
# ============================================================

# This file is expected at:
#   backend/handwriting_Qlty/analysis_service.py
#
# HANDWRITING_DIR -> backend/handwriting_Qlty
# BASE_DIR        -> backend
#
# Shared model artifacts intentionally live OUTSIDE handwriting_Qlty:
#   backend/models/Sinhala/...
#   backend/models/Tamil/...

HANDWRITING_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

BASE_DIR = os.path.dirname(
    HANDWRITING_DIR
)

UPLOAD_DIR = os.path.join(
    BASE_DIR,
    "uploads",
)

OUTPUT_DIR = os.path.join(
    BASE_DIR,
    "outputs",
)

PREPROCESS_DIR = os.path.join(
    OUTPUT_DIR,
    "preprocessed",
)

DEBUG_DIR = os.path.join(
    OUTPUT_DIR,
    "debug",
)

LINES_DIR = os.path.join(
    OUTPUT_DIR,
    "lines",
)

WORDS_DIR = os.path.join(
    OUTPUT_DIR,
    "words",
)

CHARACTERS_DIR = os.path.join(
    OUTPUT_DIR,
    "characters",
)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models",
)

# MODEL_DIR may already exist with trained artifacts. Creating it is safe,
# but nothing in this service writes or overwrites the trained model files.
for directory in [
    UPLOAD_DIR,
    OUTPUT_DIR,
    PREPROCESS_DIR,
    DEBUG_DIR,
    LINES_DIR,
    WORDS_DIR,
    CHARACTERS_DIR,
    MODEL_DIR,
]:
    os.makedirs(
        directory,
        exist_ok=True,
    )


# ============================================================
# MODEL REGISTRY
# ============================================================

def _model_folder(language):
    preferred = (
        "Sinhala"
        if language == "sinhala"
        else "Tamil"
    )

    candidates = [
        os.path.join(
            MODEL_DIR,
            preferred,
        ),
        os.path.join(
            MODEL_DIR,
            preferred.lower(),
        ),
    ]

    for folder in candidates:
        if os.path.isdir(folder):
            return folder

    return candidates[0]


MODEL_CONFIGS = {
    "sinhala": {
        "model_path": os.path.join(
            _model_folder("sinhala"),
            "sinhala_quality_calibrated_pipeline.joblib",
        ),
        "features_path": os.path.join(
            _model_folder("sinhala"),
            "sinhala_feature_columns.json",
        ),
        "metadata_path": os.path.join(
            _model_folder("sinhala"),
            "sinhala_model_metadata.json",
        ),
    },
    "tamil": {
        "model_path": os.path.join(
            _model_folder("tamil"),
            "tamil_quality_calibrated_pipeline.joblib",
        ),
        "features_path": os.path.join(
            _model_folder("tamil"),
            "tamil_feature_columns.json",
        ),
        "metadata_path": os.path.join(
            _model_folder("tamil"),
            "tamil_model_metadata.json",
        ),
    },
}


MODEL_REGISTRY = {
    "sinhala": {
        "model": None,
        "feature_config": None,
        "metadata": None,
        "warning": None,
        "error": None,
    },
    "tamil": {
        "model": None,
        "feature_config": None,
        "metadata": None,
        "warning": None,
        "error": None,
    },
}


def _load_json(path):
    with open(
        path,
        "r",
        encoding="utf-8",
    ) as file:
        return json.load(file)


def load_language_artifacts(language):
    """
    Load model, feature configuration and metadata for one language.

    A scikit-learn version mismatch is reported as a warning instead of
    automatically disabling the model. If joblib loading is genuinely
    incompatible, the load itself will fail and the model will correctly
    become unavailable.
    """

    registry = MODEL_REGISTRY[language]
    config = MODEL_CONFIGS[language]

    registry["model"] = None
    registry["feature_config"] = None
    registry["metadata"] = None
    registry["warning"] = None
    registry["error"] = None

    try:
        required = [
            config["model_path"],
            config["features_path"],
            config["metadata_path"],
        ]

        missing = [
            path
            for path in required
            if not os.path.exists(path)
        ]

        if missing:
            raise FileNotFoundError(
                "Missing artifacts: "
                + ", ".join(missing)
            )

        registry["feature_config"] = _load_json(
            config["features_path"]
        )

        registry["metadata"] = _load_json(
            config["metadata_path"]
        )

        expected_sklearn = registry["metadata"].get(
            "sklearn_version"
        )

        warning_messages = []

        if (
            expected_sklearn
            and str(sklearn.__version__) != str(expected_sklearn)
        ):
            warning_messages.append(
                "scikit-learn version mismatch: "
                f"model was created with {expected_sklearn}, "
                f"runtime is {sklearn.__version__}. "
                "Use the training version for the final research deployment."
            )

        # Capture sklearn/joblib warnings instead of printing noisy stack traces.
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            registry["model"] = joblib.load(
                config["model_path"]
            )

        warning_messages.extend(
            str(item.message)
            for item in caught
            if str(item.message).strip()
        )

        registry["warning"] = (
            " | ".join(dict.fromkeys(warning_messages))
            if warning_messages
            else None
        )
        registry["error"] = None

        print(
            f"[MODEL] {language.title()} model loaded successfully."
        )

        if registry["warning"]:
            print(
                f"[MODEL WARNING] {language.title()}: "
                f"{registry['warning']}"
            )

    except Exception as error:
        registry["model"] = None
        registry["error"] = str(error)

        print(
            f"[MODEL ERROR] {language.title()}: {error}"
        )


def load_artifacts():
    load_language_artifacts("sinhala")
    load_language_artifacts("tamil")


load_artifacts()


def get_model_status():
    """
    Return both ML-model readiness and explanation-threshold readiness.

    ML readiness and feedback readiness are deliberately separate:
    a model can still classify handwriting even if issue-threshold JSON is
    missing, but the frontend must then show detailed feedback as unavailable.
    """

    output = {}

    for language, registry in MODEL_REGISTRY.items():
        config = MODEL_CONFIGS[language]

        ready = (
            registry["model"] is not None
            and registry["feature_config"] is not None
            and registry["metadata"] is not None
        )

        metadata = registry.get("metadata") or {}

        threshold_config, threshold_file, threshold_error = (
            load_issue_thresholds(language)
        )

        threshold_features = (
            threshold_config.get("features", {})
            if isinstance(threshold_config, dict)
            else {}
        )

        feedback_ready = bool(
            threshold_config is not None
            and isinstance(threshold_features, dict)
            and len(threshold_features) > 0
        )

        expected_feature_count = None
        calibrated_feature_count = len(threshold_features)
        calibration_coverage = None

        if isinstance(threshold_config, dict):
            expected_feature_count = threshold_config.get(
                "expected_feature_count"
            )
            calibration_coverage = threshold_config.get(
                "calibration_coverage"
            )

        output[language] = {
            "ready": bool(ready),
            "model_loaded": registry["model"] is not None,
            "feature_config_loaded":
                registry["feature_config"] is not None,
            "metadata_loaded":
                registry["metadata"] is not None,

            "feedback_ready": feedback_ready,
            "issue_thresholds_loaded": feedback_ready,
            "issue_threshold_path": threshold_file,
            "issue_threshold_error": threshold_error,
            "expected_issue_feature_count": expected_feature_count,
            "calibrated_issue_feature_count": calibrated_feature_count,
            "issue_calibration_coverage": calibration_coverage,

            "selected_classifier": metadata.get(
                "selected_classifier"
            ),
            "classes": metadata.get("classes"),
            "low_confidence_threshold": metadata.get(
                "low_confidence_threshold"
            ),
            "expected_sklearn_version": metadata.get(
                "sklearn_version"
            ),
            "runtime_sklearn_version": sklearn.__version__,
            "model_warning": registry.get("warning"),
            "paths": {
                **config,
                "issue_threshold_path": threshold_file,
            },
            "error": registry["error"],
        }

    return output


# ============================================================
# GENERIC HELPERS
# ============================================================

def _save_image(path, image):
    if (
        image is None
        or not isinstance(image, np.ndarray)
        or image.size == 0
    ):
        return False

    try:
        return bool(
            cv2.imwrite(
                path,
                image,
            )
        )
    except Exception:
        return False


def _json_number(value):
    try:
        number = float(value)
        return number if np.isfinite(number) else None
    except Exception:
        return None


def _json_features(features):
    if not isinstance(features, dict):
        return {}

    return {
        name: _json_number(value)
        for name, value in features.items()
    }


def _flatten_recommendations(recommendations):
    """
    Produce a simple string list for older frontend/API consumers.

    The structured recommendation objects remain the canonical response.
    """

    if not isinstance(recommendations, list):
        return []

    texts = []

    for item in recommendations:
        if not isinstance(item, dict):
            continue

        for key in ("primary", "secondary"):
            text = str(item.get(key) or "").strip()
            if text and text not in texts:
                texts.append(text)

    return texts


def normalize_language(language):
    value = str(language).strip().lower()

    aliases = {
        "sinhala": "sinhala",
        "sin": "sinhala",
        "si": "sinhala",
        "tamil": "tamil",
        "tam": "tamil",
        "ta": "tamil",
    }

    if value not in aliases:
        raise ValueError(
            "Unsupported language. Expected 'sinhala' or 'tamil'."
        )

    return aliases[value]


# ============================================================
# PREPROCESSING
# ============================================================

def preprocess_image(image, image_id):
    """
    Final preprocessing boundary before segmentation.

    Debug outputs intentionally preserve both the binary image before notebook
    ruling removal and the final cleaned binary so segmentation failures can be
    audited visually instead of being mistaken for ML uncertainty.
    """
    skew_corrected = correct_skew(
        image
    )

    if skew_corrected is None:
        raise ValueError(
            "Skew correction failed."
        )

    shadow_removed = remove_shadow(
        skew_corrected
    )

    if shadow_removed is None:
        raise ValueError(
            "Shadow removal failed."
        )

    binary_before_rules = binarize(
        shadow_removed
    )

    if binary_before_rules is None:
        raise ValueError(
            "Binarization failed."
        )

    (
        binary,
        ruled_line_mask,
        ruled_line_diagnostics,
    ) = remove_ruled_lines(
        binary_before_rules,
        reference_image=shadow_removed,
        return_mask=True,
    )

    if binary is None:
        raise ValueError(
            "Ruled-line removal failed."
        )

    # Explicit boundary contract before segmentation.
    binary = ensure_ink_white(
        binary
    )

    if binary is None:
        raise ValueError(
            "Canonical binary normalization failed."
        )

    filenames = {
        "skew_corrected":
            f"{image_id}_01_skew_corrected.jpg",
        "shadow_removed":
            f"{image_id}_02_shadow_removed.jpg",
        "binary_before_rules":
            f"{image_id}_03_binary_before_rules.png",
        "ruled_line_mask":
            f"{image_id}_04_ruled_line_mask.png",
        "binary":
            f"{image_id}_05_binary_cleaned.png",
    }

    _save_image(
        os.path.join(
            PREPROCESS_DIR,
            filenames["skew_corrected"],
        ),
        skew_corrected,
    )

    _save_image(
        os.path.join(
            PREPROCESS_DIR,
            filenames["shadow_removed"],
        ),
        shadow_removed,
    )

    _save_image(
        os.path.join(
            PREPROCESS_DIR,
            filenames["binary_before_rules"],
        ),
        binary_before_rules,
    )

    if ruled_line_mask is not None:
        _save_image(
            os.path.join(
                PREPROCESS_DIR,
                filenames["ruled_line_mask"],
            ),
            ruled_line_mask,
        )

    _save_image(
        os.path.join(
            PREPROCESS_DIR,
            filenames["binary"],
        ),
        binary,
    )

    return {
        "skew_corrected": skew_corrected,
        "shadow_removed": shadow_removed,
        "binary_before_rules": binary_before_rules,
        "ruled_line_mask": ruled_line_mask,
        "binary": binary,
        "ruled_line_diagnostics": ruled_line_diagnostics,
        "filenames": filenames,
    }


# ============================================================
# SEGMENTATION
# ============================================================

def segment_handwriting(
    binary,
    image_id,
    language,
):
    """
    Build hierarchical page -> line -> word -> character-region records.
    """
    binary = ensure_ink_white(binary)

    if binary is None:
        raise ValueError(
            "Segmentation received an invalid binary image."
        )

    lines, line_boxes = segment_lines(
        binary
    )

    line_records = []
    all_words = []
    all_word_boxes = []
    all_character_boxes = []
    total_character_regions = 0

    line_image_filenames = []
    word_image_filenames = []
    character_image_filenames = []
    word_debug_filenames = []
    character_debug_filenames = []

    line_debug = cv2.cvtColor(
        binary,
        cv2.COLOR_GRAY2BGR,
    )
    word_page_debug = cv2.cvtColor(
        binary,
        cv2.COLOR_GRAY2BGR,
    )
    character_page_debug = cv2.cvtColor(
        binary,
        cv2.COLOR_GRAY2BGR,
    )
    combined_page_debug = cv2.cvtColor(
        binary,
        cv2.COLOR_GRAY2BGR,
    )

    for line_index, line_box in enumerate(
        line_boxes
    ):
        x, y, w, h = line_box

        cv2.rectangle(
            line_debug,
            (x, y),
            (x + w, y + h),
            (0, 255, 0),
            2,
        )
        cv2.rectangle(
            combined_page_debug,
            (x, y),
            (x + w, y + h),
            (0, 255, 0),
            2,
        )

        cv2.putText(
            line_debug,
            f"L{line_index + 1}",
            (
                x,
                max(10, y - 5),
            ),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 255, 0),
            1,
            cv2.LINE_AA,
        )

    line_debug_filename = (
        f"{image_id}_lines_debug.jpg"
    )

    _save_image(
        os.path.join(
            DEBUG_DIR,
            line_debug_filename,
        ),
        line_debug,
    )

    for line_index, line in enumerate(lines):
        line_box = line_boxes[line_index]
        line_x, line_y, _, _ = line_box

        line_image_filename = (
            f"{image_id}_line_{line_index + 1}.png"
        )
        line_image_filenames.append(
            line_image_filename
        )

        _save_image(
            os.path.join(
                LINES_DIR,
                line_image_filename,
            ),
            line,
        )

        words, local_word_boxes = segment_words(
            line
        )

        word_records = []
        global_word_boxes = []

        word_debug = cv2.cvtColor(
            line,
            cv2.COLOR_GRAY2BGR,
        )

        for word_index, (
            word,
            local_box,
        ) in enumerate(
            zip(
                words,
                local_word_boxes,
            )
        ):
            wx, wy, ww, wh = local_box

            global_box = (
                int(line_x + wx),
                int(line_y + wy),
                int(ww),
                int(wh),
            )

            global_word_boxes.append(
                global_box
            )

            word_image_filename = (
                f"{image_id}_line_{line_index + 1}"
                f"_word_{word_index + 1}.png"
            )
            word_image_filenames.append(
                word_image_filename
            )

            _save_image(
                os.path.join(
                    WORDS_DIR,
                    word_image_filename,
                ),
                word,
            )

            cv2.rectangle(
                word_debug,
                (wx, wy),
                (wx + ww, wy + wh),
                (255, 0, 0),
                2,
            )
            cv2.rectangle(
                word_page_debug,
                (global_box[0], global_box[1]),
                (
                    global_box[0] + global_box[2],
                    global_box[1] + global_box[3],
                ),
                (255, 0, 0),
                2,
            )
            cv2.rectangle(
                combined_page_debug,
                (global_box[0], global_box[1]),
                (
                    global_box[0] + global_box[2],
                    global_box[1] + global_box[3],
                ),
                (255, 0, 0),
                1,
            )

            character_regions, character_boxes = (
                segment_character_regions(
                    word,
                    language=language,
                )
            )

            total_character_regions += len(
                character_regions
            )

            character_debug = cv2.cvtColor(
                word,
                cv2.COLOR_GRAY2BGR,
            )

            for region_index, (
                region,
                region_box,
            ) in enumerate(
                zip(
                    character_regions,
                    character_boxes,
                )
            ):
                rx, ry, rw, rh = region_box

                cv2.rectangle(
                    character_debug,
                    (rx, ry),
                    (rx + rw, ry + rh),
                    (0, 0, 255),
                    1,
                )

                global_region_box = (
                    int(line_x + wx + rx),
                    int(line_y + wy + ry),
                    int(rw),
                    int(rh),
                )
                all_character_boxes.append(
                    global_region_box
                )

                cv2.rectangle(
                    character_page_debug,
                    (
                        global_region_box[0],
                        global_region_box[1],
                    ),
                    (
                        global_region_box[0] + global_region_box[2],
                        global_region_box[1] + global_region_box[3],
                    ),
                    (0, 0, 255),
                    1,
                )
                cv2.rectangle(
                    combined_page_debug,
                    (
                        global_region_box[0],
                        global_region_box[1],
                    ),
                    (
                        global_region_box[0] + global_region_box[2],
                        global_region_box[1] + global_region_box[3],
                    ),
                    (0, 0, 255),
                    1,
                )

                character_image_filename = (
                    f"{image_id}_line_{line_index + 1}"
                    f"_word_{word_index + 1}"
                    f"_region_{region_index + 1}.png"
                )
                character_image_filenames.append(
                    character_image_filename
                )

                _save_image(
                    os.path.join(
                        CHARACTERS_DIR,
                        character_image_filename,
                    ),
                    region,
                )

            character_debug_filename = (
                f"{image_id}_line_{line_index + 1}"
                f"_word_{word_index + 1}"
                "_characters_debug.jpg"
            )

            _save_image(
                os.path.join(
                    DEBUG_DIR,
                    character_debug_filename,
                ),
                character_debug,
            )
            character_debug_filenames.append(
                character_debug_filename
            )

            word_records.append(
                {
                    "word": word,
                    "local_box": local_box,
                    "global_box": global_box,
                    "character_regions":
                        character_regions,
                    "character_boxes":
                        character_boxes,
                    "character_debug_filename":
                        character_debug_filename,
                }
            )

        word_debug_filename = (
            f"{image_id}_line_{line_index + 1}"
            "_words_debug.jpg"
        )

        _save_image(
            os.path.join(
                DEBUG_DIR,
                word_debug_filename,
            ),
            word_debug,
        )
        word_debug_filenames.append(
            word_debug_filename
        )

        line_records.append(
            {
                "line_index": int(line_index),
                "line": line,
                "line_box": line_box,
                "words": words,
                "local_word_boxes": local_word_boxes,
                "global_word_boxes": global_word_boxes,
                "word_records": word_records,
                "word_debug_filename": word_debug_filename,
            }
        )

        all_words.extend(words)
        all_word_boxes.extend(
            global_word_boxes
        )

    word_page_debug_filename = (
        f"{image_id}_words_page_debug.jpg"
    )
    character_page_debug_filename = (
        f"{image_id}_characters_page_debug.jpg"
    )
    combined_page_debug_filename = (
        f"{image_id}_segmentation_combined_debug.jpg"
    )

    _save_image(
        os.path.join(
            DEBUG_DIR,
            word_page_debug_filename,
        ),
        word_page_debug,
    )
    _save_image(
        os.path.join(
            DEBUG_DIR,
            character_page_debug_filename,
        ),
        character_page_debug,
    )
    _save_image(
        os.path.join(
            DEBUG_DIR,
            combined_page_debug_filename,
        ),
        combined_page_debug,
    )

    return {
        "page_binary": binary,
        "lines": lines,
        "line_boxes": line_boxes,
        "line_records": line_records,
        "all_words": all_words,
        "all_word_boxes": all_word_boxes,
        "character_region_count": int(
            total_character_regions
        ),
        "all_character_boxes":
            all_character_boxes,
        "line_debug_filename":
            line_debug_filename,
        "word_page_debug_filename":
            word_page_debug_filename,
        "character_page_debug_filename":
            character_page_debug_filename,
        "combined_page_debug_filename":
            combined_page_debug_filename,
        "line_image_filenames":
            line_image_filenames,
        "word_image_filenames":
            word_image_filenames,
        "character_image_filenames":
            character_image_filenames,
        "word_debug_filenames":
            word_debug_filenames,
        "character_debug_filenames":
            character_debug_filenames,
    }


# ============================================================
# STAGE 1A INPUT QUALITY  —  RELAXED THRESHOLDS
# ============================================================
#
# CHANGES vs previous version:
#   - word_detection_hard_min:  0.10  ->  0.02   (accept pages with less writing)
#   - hard  contrast_min:       6.0   ->  3.0    (only reject truly black images)
#   - hard  blur_min:           8.0   ->  2.0    (only reject extreme blur)
#   - hard  ink_density_min:    0.12  ->  0.03   (accept faint writing)
#   - hard  visibility_min:     8.0   ->  3.0    (much more lenient)
#   - warning contrast_min:    12.0   ->  6.0
#   - warning blur_min:        20.0   ->  8.0
#   - warning ink_density_min:  0.40  ->  0.12
#   - warning visibility_min:  18.0   ->  8.0
# ============================================================

STAGE1_THRESHOLDS = {
    "word_detection_hard_min": 0.02,

    "hard": {
        "contrast_min": 3.0,
        "blur_min": 2.0,
        "ink_density_min": 0.03,
        "visibility_min": 3.0,
    },

    "warning": {
        "contrast_min": 6.0,
        "blur_min": 8.0,
        "ink_density_min": 0.12,
        "visibility_min": 8.0,
    },
}


def _resolution_normalized_blur_score(
    image,
    max_dimension=1000,
):
    """
    Resolution-normalized variance-of-Laplacian sharpness score.

    Higher = sharper. Lower = blurrier.
    """
    gray = ensure_gray(image)

    if gray is None:
        return np.nan

    try:
        height, width = gray.shape[:2]
        current_max = max(height, width)

        if current_max > max_dimension:
            scale = (
                float(max_dimension)
                / float(current_max)
            )

            new_width = max(
                1,
                int(round(width * scale)),
            )
            new_height = max(
                1,
                int(round(height * scale)),
            )

            gray = cv2.resize(
                gray,
                (new_width, new_height),
                interpolation=cv2.INTER_AREA,
            )

        return float(
            cv2.Laplacian(
                gray,
                cv2.CV_64F,
            ).var()
        )

    except Exception:
        return np.nan


def evaluate_input_quality(
    image,
    binary,
    word_boxes,
    line_count,
    word_count,
):
    """
    Stage 1A input-quality gate  —  RELAXED.

    Policy
    ------
    * Only truly unusable captures (completely black, extreme motion blur,
      no ink at all) trigger a retake.
    * Everything else passes through to Stage 2 so the ML model can produce
      a result. Borderline captures get a warning but are NOT blocked.
    """
    features = calculate_readability_features(
        image,
        binary,
        word_boxes,
    )

    raw_blur = features.get(
        "blur_score",
        np.nan,
    )

    normalized_blur = _resolution_normalized_blur_score(
        image
    )

    if np.isfinite(normalized_blur):
        features["blur_score_raw"] = raw_blur
        features["blur_score"] = normalized_blur

    json_features = _json_features(features)

    # No usable structural content at all.
    if line_count <= 0 and word_count <= 0:
        return {
            "status": "Insufficient Handwriting",
            "valid_for_stage2": False,
            "quality_warning": False,
            "threshold_source": "relaxed_stage1_v2",
            "features": json_features,
            "warnings": [],
            "reasons": [
                "No usable handwriting lines or words were detected."
            ],
        }

    detection_ratio = features.get(
        "word_detection_ratio",
        np.nan,
    )

    if (
        np.isfinite(detection_ratio)
        and detection_ratio < STAGE1_THRESHOLDS["word_detection_hard_min"]
    ):
        return {
            "status": "Insufficient Handwriting",
            "valid_for_stage2": False,
            "quality_warning": False,
            "threshold_source": "relaxed_stage1_v2",
            "features": json_features,
            "warnings": [],
            "reasons": [
                "Too little handwriting was detected for reliable analysis."
            ],
        }

    contrast = features.get("contrast_score", np.nan)
    blur = features.get("blur_score", np.nan)
    ink_density = features.get("ink_density", np.nan)
    visibility = features.get("text_visibility_score", np.nan)

    hard = STAGE1_THRESHOLDS["hard"]
    warning = STAGE1_THRESHOLDS["warning"]

    reasons = []
    warnings = []

    # Hard failures: only truly unusable captures.
    if np.isfinite(contrast) and contrast < hard["contrast_min"]:
        reasons.append(
            "The handwriting contrast is extremely low. Please retake the photo in better lighting."
        )

    if np.isfinite(blur) and blur < hard["blur_min"]:
        reasons.append(
            "The image is severely blurred. Please keep the camera steady and focus before taking the photo."
        )

    if np.isfinite(ink_density) and ink_density < hard["ink_density_min"]:
        reasons.append(
            "Almost no usable handwriting ink is visible. Please retake the full writing area clearly."
        )

    if np.isfinite(visibility) and visibility < hard["visibility_min"]:
        reasons.append(
            "The handwriting is not visible enough for structural analysis. Please retake the photo."
        )

    if reasons:
        return {
            "status": "Low Image Quality",
            "valid_for_stage2": False,
            "quality_warning": False,
            "threshold_source": "relaxed_stage1_v2",
            "features": json_features,
            "warnings": [],
            "reasons": reasons,
        }

    # Soft warnings: always continue to Stage 2.
    if np.isfinite(contrast) and contrast < warning["contrast_min"]:
        warnings.append(
            "Contrast is a little low, but the handwriting is still analysable."
        )

    if np.isfinite(blur) and blur < warning["blur_min"]:
        warnings.append(
            "The photo is slightly soft/blurred, but the handwriting is still analysable."
        )

    if np.isfinite(ink_density) and ink_density < warning["ink_density_min"]:
        warnings.append(
            "The writing is faint, but enough handwriting is visible to continue."
        )

    if np.isfinite(visibility) and visibility < warning["visibility_min"]:
        warnings.append(
            "Text visibility is borderline, so interpret the result with a little extra care."
        )

    return {
        "status": "Valid With Warning" if warnings else "Valid",
        "valid_for_stage2": True,
        "quality_warning": bool(warnings),
        "threshold_source": "relaxed_stage1_v2",
        "features": json_features,
        "warnings": warnings,
        "reasons": [],
    }


# ============================================================
# MODEL PREDICTION
# ============================================================

def predict_quality(
    language,
    raw_features,
):
    registry = MODEL_REGISTRY[
        language
    ]

    if (
        registry["model"] is None
        or registry["feature_config"] is None
        or registry["metadata"] is None
    ):
        return {
            "available": False,
            "status": "MODEL_UNAVAILABLE",
            "accepted": False,
            "accepted_for_automatic_decision": False,
            "review_recommended": False,
            "review_note": None,
            "predicted_label": None,
            "most_likely_label": None,
            "final_label": None,
            "reported_label": None,
            "confidence": None,
            "low_confidence": None,
            "probabilities": None,
            "error": registry["error"]
                or "Model artifacts are not ready.",
        }

    model = registry["model"]
    feature_config = registry[
        "feature_config"
    ]
    metadata = registry["metadata"]

    expected_features = (
        feature_config.get(
            "handwriting_quality_features"
        )
        or feature_config.get(
            "features"
        )
    )

    if not expected_features:
        return {
            "available": False,
            "status": "MODEL_CONFIG_ERROR",
            "accepted": False,
            "accepted_for_automatic_decision": False,
            "review_recommended": False,
            "review_note": None,
            "predicted_label": None,
            "most_likely_label": None,
            "final_label": None,
            "reported_label": None,
            "confidence": None,
            "low_confidence": None,
            "probabilities": None,
            "error":
                "Feature configuration is missing the expected feature list.",
        }

    try:
        ordered = validate_feature_vector(
            raw_features,
            expected_features,
        )

        sample = pd.DataFrame(
            [ordered],
            columns=expected_features,
        )

        if not hasattr(
            model,
            "predict_proba",
        ):
            raise ValueError(
                "Saved model does not support predict_proba()."
            )

        probabilities = model.predict_proba(
            sample
        )[0]

        classes = np.asarray(
            model.classes_
        )

        best_index = int(
            np.argmax(probabilities)
        )

        predicted_label = str(
            classes[best_index]
        )

        confidence_raw = float(
            probabilities[best_index]
        )

        threshold = float(
            metadata.get(
                "low_confidence_threshold",
                0.0,
            )
        )

        low_confidence = bool(
            confidence_raw < threshold
        )

        probability_percentages = {
            str(label): round(
                float(probability) * 100.0,
                2,
            )
            for label, probability
            in zip(
                classes,
                probabilities,
            )
        }

        ranked = sorted(
            probability_percentages.items(),
            key=lambda item: item[1],
            reverse=True,
        )

        automatic_acceptance = not low_confidence

        return {
            "available": True,
            "status": (
                "ACCEPTED"
                if automatic_acceptance
                else "LOW_CONFIDENCE_REVIEW_RECOMMENDED"
            ),
            "accepted": True,
            "accepted_for_automatic_decision": bool(
                automatic_acceptance
            ),
            "predicted_label": predicted_label,
            "most_likely_label": predicted_label,
            "final_label": predicted_label,
            "reported_label": predicted_label,
            "review_recommended": bool(low_confidence),
            "review_note": (
                "Needs Teacher Review"
                if low_confidence
                else None
            ),
            "confidence": round(
                confidence_raw * 100.0,
                2,
            ),
            "confidence_raw":
                confidence_raw,
            "low_confidence":
                low_confidence,
            "low_confidence_threshold":
                threshold,
            "low_confidence_threshold_percent":
                round(threshold * 100.0, 2),
            "probabilities":
                probability_percentages,
            "top_candidates": [
                {
                    "label": label,
                    "probability": probability,
                }
                for label, probability
                in ranked[:2]
            ],
            "features_used":
                list(expected_features),
            "selected_classifier":
                metadata.get(
                    "selected_classifier"
                ),
            "score_source":
                "calibrated_ml_class_probabilities",
            "error": None,
        }

    except Exception as error:
        return {
            "available": False,
            "status": "MODEL_ERROR",
            "accepted": False,
            "accepted_for_automatic_decision": False,
            "review_recommended": False,
            "review_note": None,
            "predicted_label": None,
            "most_likely_label": None,
            "final_label": None,
            "reported_label": None,
            "confidence": None,
            "low_confidence": None,
            "probabilities": None,
            "error": str(error),
        }


# ============================================================
# USER-FACING STAGE 1 / 1B HELPERS
# ============================================================

def _stage1_recommendations(status):
    if status == "Low Image Quality":
        return [
            "Retake the handwriting image in better lighting.",
            "Keep the camera steady and make sure the writing is in focus.",
            "Capture the full handwriting area clearly without strong shadows.",
        ]

    return [
        "Upload a handwriting sample containing enough clearly visible words.",
        "Make sure the complete writing area is inside the image.",
    ]


def _segmentation_retake_recommendations():
    return [
        "Retake the photo directly above the page so notebook lines and page edges are easier to separate.",
        "Keep the full handwriting area visible and avoid including another page beside it.",
        "If the problem continues, send the sample for teacher review instead of assigning a handwriting level.",
    ]


def _output_files(
    preprocessing,
    segmentation,
):
    filenames = preprocessing[
        "filenames"
    ]

    preprocessing_files = {
        "skew_corrected":
            "/outputs/preprocessed/"
            + filenames["skew_corrected"],
        "shadow_removed":
            "/outputs/preprocessed/"
            + filenames["shadow_removed"],
        "binary_before_rules":
            "/outputs/preprocessed/"
            + filenames["binary_before_rules"],
        "ruled_line_mask":
            "/outputs/preprocessed/"
            + filenames["ruled_line_mask"],
        "binary":
            "/outputs/preprocessed/"
            + filenames["binary"],
    }

    def _urls(folder, names):
        return [
            f"/outputs/{folder}/{name}"
            for name in (names or [])
        ]

    segmentation_files = {
        "line_overlay": (
            "/outputs/debug/"
            + segmentation["line_debug_filename"]
        ),
        "word_overlay": (
            "/outputs/debug/"
            + segmentation["word_page_debug_filename"]
        ),
        "character_overlay": (
            "/outputs/debug/"
            + segmentation["character_page_debug_filename"]
        ),
        "combined_overlay": (
            "/outputs/debug/"
            + segmentation["combined_page_debug_filename"]
        ),
        "line_crops": _urls(
            "lines",
            segmentation.get("line_image_filenames"),
        ),
        "word_crops": _urls(
            "words",
            segmentation.get("word_image_filenames"),
        ),
        "character_region_crops": _urls(
            "characters",
            segmentation.get("character_image_filenames"),
        ),
        "word_overlays_by_line": _urls(
            "debug",
            segmentation.get("word_debug_filenames"),
        ),
        "character_overlays_by_word": _urls(
            "debug",
            segmentation.get("character_debug_filenames"),
        ),
    }

    return {
        "preprocessing": preprocessing_files,
        "line_debug": segmentation_files["line_overlay"],
        "segmentation": segmentation_files,
    }


# ============================================================
# MAIN ANALYSIS
# ============================================================

def analyze_handwriting(
    image,
    image_id,
    language,
):
    if (
        image is None
        or not isinstance(image, np.ndarray)
        or image.size == 0
    ):
        raise ValueError(
            "Input image is invalid."
        )

    language = normalize_language(
        language
    )

    preprocessing = preprocess_image(
        image,
        image_id,
    )

    segmentation = segment_handwriting(
        preprocessing["binary"],
        image_id,
        language,
    )

    stage1 = evaluate_input_quality(
        preprocessing[
            "skew_corrected"
        ],
        preprocessing[
            "binary"
        ],
        segmentation[
            "all_word_boxes"
        ],
        len(segmentation["lines"]),
        len(segmentation["all_words"]),
    )

    output_files = _output_files(
        preprocessing,
        segmentation,
    )

    base_debug = {
        "line_count": int(
            len(segmentation["lines"])
        ),
        "word_count": int(
            len(segmentation["all_words"])
        ),
        "word_box_count": int(
            len(
                segmentation[
                    "all_word_boxes"
                ]
            )
        ),
        "character_region_count": int(
            segmentation[
                "character_region_count"
            ]
        ),
        "model_status":
            get_model_status(),
        "ruled_line_diagnostics":
            preprocessing.get(
                "ruled_line_diagnostics",
                {},
            ),
    }

    # --------------------------------------------------------
    # Stage 1A rejection: image/handwriting capture issue.
    # --------------------------------------------------------
    if not stage1[
        "valid_for_stage2"
    ]:
        return {
            "language": language,
            "analysis_status":
                "INPUT_RETAKE_REQUIRED",
            "feedback_status": "NOT_RUN",
            "input_validation": stage1,
            "segmentation_reliability": {
                "status": "Not Evaluated",
                "reliable_for_stage2": False,
                "threshold_source": None,
                "metrics": {},
                "warnings": [],
                "reasons": [
                    "Stage 1B was skipped because Stage 1A rejected the input."
                ],
            },
            "quality_prediction": {
                "available": False,
                "status": "NOT_RUN",
                "accepted": False,
                "predicted_label": None,
                "most_likely_label": None,
                "final_label": None,
                "reported_label": None,
                "confidence": None,
                "low_confidence": None,
                "probabilities": None,
                "error":
                    "Stage 2 was not run because the input must be retaken.",
            },
            "ml_prediction": {
                "available": False,
                "label": None,
                "most_likely_label": None,
                "reported_label": None,
                "confidence": None,
                "probabilities": None,
                "low_confidence": None,
            },
            "overall_score": None,
            "score_source": None,
            "raw_features": {},
            "character_level_analysis": {
                "available": False,
                "affects_final_prediction": False,
                "reason": "Not run because Stage 1A rejected the input.",
            },
            "explainability": {
                "available": False,
                "source": "not_run",
                "issues": [],
                "recommendations": [],
            },
            "issues": [],
            "recommendations":
                _stage1_recommendations(
                    stage1["status"]
                ),
            "recommendation_texts":
                _stage1_recommendations(
                    stage1["status"]
                ),
            "output_files": output_files,
            "architecture_notes": {
                "final_quality_source":
                    "calibrated_language_specific_ml_model",
                "zero_to_100_quality_score_enabled": False,
                "stage2_ran": False,
            },
            "debug": base_debug,
        }

    # --------------------------------------------------------
    # Stage 1B: segmentation sanity/reliability.
    # --------------------------------------------------------
    segmentation_reliability = (
        evaluate_segmentation_reliability(
            segmentation
        )
    )

    if not segmentation_reliability[
        "reliable_for_stage2"
    ]:
        return {
            "language": language,
            "analysis_status":
                "SEGMENTATION_UNRELIABLE",
            "feedback_status": "NOT_RUN",
            "input_validation": stage1,
            "segmentation_reliability":
                segmentation_reliability,
            "message": (
                "The handwriting was visible, but the system could not "
                "reliably separate the writing regions. No handwriting "
                "quality level has been assigned."
            ),
            "quality_prediction": {
                "available": False,
                "status": "NOT_RUN",
                "accepted": False,
                "predicted_label": None,
                "most_likely_label": None,
                "final_label": None,
                "reported_label": None,
                "confidence": None,
                "low_confidence": None,
                "probabilities": None,
                "error":
                    "Stage 2 was stopped by the segmentation reliability gate.",
            },
            "ml_prediction": {
                "available": False,
                "label": None,
                "most_likely_label": None,
                "reported_label": None,
                "confidence": None,
                "probabilities": None,
                "low_confidence": None,
            },
            "overall_score": None,
            "score_source": None,
            "raw_features": {},
            "character_level_analysis": {
                "available": False,
                "affects_final_prediction": False,
                "reason":
                    "Not exposed because segmentation was unreliable.",
            },
            "explainability": {
                "available": False,
                "source": "not_run",
                "issues": [],
                "recommendations": [],
            },
            "issues": [],
            "recommendations":
                _segmentation_retake_recommendations(),
            "recommendation_texts":
                _segmentation_retake_recommendations(),
            "output_files": output_files,
            "architecture_notes": {
                "final_quality_source":
                    "calibrated_language_specific_ml_model",
                "zero_to_100_quality_score_enabled": False,
                "segmentation_gate_prevents_bad_features": True,
                "stage2_ran": False,
            },
            "debug": {
                **base_debug,
                "segmentation_metrics":
                    segmentation_reliability[
                        "metrics"
                    ],
            },
        }

    # --------------------------------------------------------
    # Stage 2: only after Stage 1A and Stage 1B pass.
    # --------------------------------------------------------
    raw_features = extract_quality_features(
        language,
        segmentation[
            "line_records"
        ],
    )

    prediction = predict_quality(
        language,
        raw_features,
    )

    character_analysis = (
        analyze_character_records(
            segmentation[
                "line_records"
            ]
        )
    )

    explanation = detect_issues(
        language,
        raw_features,
    )

    issues = explanation.get(
        "issues",
        [],
    )

    structured_recommendations = (
        generate_recommendations(
            issues,
            language=language,
            max_priorities=3,
        )
    )

    recommendation_texts = (
        _flatten_recommendations(
            structured_recommendations
        )
    )

    if not prediction.get(
        "available",
        False,
    ):
        analysis_status = "MODEL_ERROR"
    else:
        analysis_status = "COMPLETED"

    feedback_available = bool(
        explanation.get(
            "available",
            False,
        )
    )

    partial_feedback = bool(
        explanation.get(
            "partial_feedback",
            False,
        )
    )

    if not feedback_available:
        feedback_status = "UNAVAILABLE"
    elif partial_feedback:
        feedback_status = "PARTIAL"
    else:
        feedback_status = "AVAILABLE"

    explainability = {
        "available": feedback_available,
        "status": feedback_status,
        "source": explanation.get(
            "source"
        ),
        "threshold_file": explanation.get(
            "threshold_file"
        ),
        "error": explanation.get(
            "error"
        ),
        "partial_feedback": partial_feedback,
        "expected_feature_count": explanation.get(
            "expected_feature_count"
        ),
        "calibrated_feature_count": explanation.get(
            "calibrated_feature_count"
        ),
        "usable_feature_count": explanation.get(
            "usable_feature_count"
        ),
        "evaluated_feature_count": explanation.get(
            "evaluated_feature_count"
        ),
        "calibration_coverage": explanation.get(
            "calibration_coverage"
        ),
        "suppressed_features": explanation.get(
            "suppressed_features",
            [],
        ),
        "soft_warning_features": explanation.get(
            "soft_warning_features",
            [],
        ),
        "missing_features": explanation.get(
            "missing_features",
            [],
        ),
        "preliminary_due_to_low_confidence": bool(
            prediction.get(
                "low_confidence",
                False,
            )
        ),
        "issues": issues,
        "recommendations": structured_recommendations,
    }

    final_label = prediction.get(
        "final_label"
    )

    return {
        "language": language,
        "analysis_status": analysis_status,
        "feedback_status": feedback_status,
        "input_validation": stage1,
        "segmentation_reliability":
            segmentation_reliability,
        "quality_prediction": prediction,
        "ml_prediction": {
            "available": prediction.get(
                "available",
                False,
            ),
            "label": final_label,
            "most_likely_label":
                prediction.get(
                    "most_likely_label"
                ),
            "reported_label":
                prediction.get(
                    "reported_label"
                ),
            "confidence":
                prediction.get(
                    "confidence"
                ),
            "probabilities":
                prediction.get(
                    "probabilities"
                ),
            "low_confidence":
                prediction.get(
                    "low_confidence"
                ),
            "review_recommended":
                prediction.get(
                    "review_recommended",
                    False,
                ),
            "review_note":
                prediction.get(
                    "review_note"
                ),
            "accepted_for_automatic_decision":
                prediction.get(
                    "accepted_for_automatic_decision",
                    False,
                ),
            "error":
                prediction.get(
                    "error"
                ),
        },
        "overall_score": None,
        "score_source": None,
        "raw_features": _json_features(
            raw_features
        ),
        "character_level_analysis":
            character_analysis,
        "explainability": explainability,
        "issues": issues,
        "recommendations":
            structured_recommendations,
        "recommendation_texts":
            recommendation_texts,
        "output_files": output_files,
        "architecture_notes": {
            "final_quality_source":
                "calibrated_language_specific_ml_model",
            "stage1_image_quality_separate_from_stage2": True,
            "segmentation_reliability_gate_enabled": True,
            "low_confidence_policy":
                "show_model_label_plus_teacher_review_advisory",
            "zero_to_100_quality_score_enabled": False,
            "issue_rules_affect_final_prediction": False,
            "character_analysis_affects_final_prediction": False,
            "child_recommendation_priority_limit": 3,
        },
        "debug": {
            **base_debug,
            "segmentation_metrics":
                segmentation_reliability[
                    "metrics"
                ],
            "model_feature_count": int(
                len(raw_features)
            ),
        },
    }
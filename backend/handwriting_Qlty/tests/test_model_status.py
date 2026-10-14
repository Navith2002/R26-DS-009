import json
import os
import sys

import sklearn


ROOT = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from analysis_service import MODEL_CONFIGS, get_model_status


def test_sinhala_artifacts_and_version_guard():
    # Use the same metadata path as the application loader.
    metadata_path = MODEL_CONFIGS["sinhala"]["metadata_path"]

    assert os.path.exists(metadata_path), (
        f"Sinhala model metadata not found: {metadata_path}"
    )

    with open(
        metadata_path,
        "r",
        encoding="utf-8",
    ) as file:
        metadata = json.load(file)

    status = get_model_status()
    sinhala = status["sinhala"]

    expected = str(
        metadata.get("sklearn_version")
    )

    if str(sklearn.__version__) == expected:
        assert sinhala["ready"] is True, (
            sinhala["error"]
            or "Sinhala model artifacts are not ready."
        )
    else:
        assert sinhala["ready"] is False
        assert "version mismatch" in (
            sinhala["error"] or ""
        )
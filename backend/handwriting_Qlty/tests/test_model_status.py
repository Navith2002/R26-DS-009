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

from analysis_service import get_model_status


def test_sinhala_artifacts_and_version_guard():
    metadata_path = os.path.join(
        ROOT,
        "models",
        "Sinhala",
        "sinhala_model_metadata.json",
    )

    assert os.path.exists(metadata_path)

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
        assert sinhala["ready"] is True
    else:
        assert sinhala["ready"] is False
        assert "version mismatch" in (
            sinhala["error"] or ""
        )

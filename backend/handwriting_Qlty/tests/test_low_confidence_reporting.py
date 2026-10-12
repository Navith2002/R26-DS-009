import os
import sys

import numpy as np

ROOT = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import analysis_service as service


class _FakeLowConfidenceModel:
    classes_ = np.asarray(["Average", "Good"])

    def predict_proba(self, sample):
        return np.asarray([[0.58, 0.42]], dtype=float)


def test_low_confidence_keeps_model_label_visible():
    original = dict(service.MODEL_REGISTRY["sinhala"])

    try:
        service.MODEL_REGISTRY["sinhala"] = {
            "model": _FakeLowConfidenceModel(),
            "feature_config": {
                "handwriting_quality_features": ["spacing_std"]
            },
            "metadata": {
                "low_confidence_threshold": 0.70,
                "selected_classifier": "Fake",
            },
            "error": None,
        }

        result = service.predict_quality(
            "sinhala",
            {"spacing_std": 0.25},
        )

        assert result["available"] is True
        assert result["low_confidence"] is True
        assert result["final_label"] == "Average"
        assert result["reported_label"] == "Average"
        assert result["review_recommended"] is True
        assert result["review_note"] == "Needs Teacher Review"
        assert result["accepted_for_automatic_decision"] is False

    finally:
        service.MODEL_REGISTRY["sinhala"] = original

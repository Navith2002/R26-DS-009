"""Quick local smoke test for the backend bundle."""

from analysis_service import get_model_status
from feature_extraction import (
    TAMIL_QUALITY_FEATURES,
    SINHALA_QUALITY_FEATURES,
)


def main():
    status = get_model_status()

    print("Model status:")
    for language, info in status.items():
        print(
            f"- {language}: ready={info['ready']} error={info['error']}"
        )

    print(
        "Tamil feature count:",
        len(TAMIL_QUALITY_FEATURES),
    )
    print(
        "Sinhala feature count:",
        len(SINHALA_QUALITY_FEATURES),
    )

    if not status["sinhala"]["ready"]:
        raise SystemExit(
            "Sinhala model failed to load. Check scikit-learn version and artifact paths."
        )

    print("Bundle smoke test passed.")


if __name__ == "__main__":
    main()

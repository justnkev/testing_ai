from __future__ import annotations

from datetime import datetime, timezone

import app.routes as routes


def test_progress_timeline_includes_calories_and_macros() -> None:
    log = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "meals_log": [
            {
                "text": "Lunch bowl",
                "calories": 420,
                "protein_g": 30,
                "carbs_g": 50,
                "fat_g": 12,
            },
            {
                "text": "Protein shake",
                "calories": 180,
                "protein_g": 25,
                "carbs_g": 10,
                "fat_g": 2,
            },
        ],
    }

    compatible = routes._create_template_compatible_logs([log])[0]

    assert compatible["calories"] == 600
    assert compatible["macros"] == "P55/C60/F14"
    assert "Lunch bowl" in compatible["meals"]
    assert "Protein shake" in compatible["meals"]

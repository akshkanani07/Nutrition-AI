"""Mock provider — returns fixed demo data. Always flagged as provider='mock'."""

from __future__ import annotations

from PIL import Image

from app.nutrition import (
    calculate_nutrition,
    compute_meal_score,
    generate_advice,
    round_grams,
    sum_nutrition,
)


# Hardcoded demo food entry (never presented as real ML output)
_DEMO_FOOD = {
    "food_key": "demo_salad",
    "food_name": "Garden Salad",
    "calories_per_100g": 20,
    "protein_g_per_100g": 1.5,
    "carbs_g_per_100g": 3.6,
    "fat_g_per_100g": 0.2,
    "fiber_g_per_100g": 1.8,
    "sugar_g_per_100g": 1.3,
    "sodium_mg_per_100g": 10,
    "default_serving_g": 150,
}


class MockProvider:
    """Development / demo provider. Does not run any model."""

    name = "mock"
    model_version = "mock-v0"

    def __init__(self) -> None:
        self.ready = True

    def analyze(self, img: Image.Image) -> dict:
        """Return a fixed demo response regardless of the image."""
        grams = round_grams(_DEMO_FOOD["default_serving_g"])
        nutrition = calculate_nutrition(_DEMO_FOOD, grams)
        totals = sum_nutrition([nutrition])
        score = compute_meal_score(totals)
        advice = generate_advice(totals)

        item = {
            "food_key": _DEMO_FOOD["food_key"],
            "name": _DEMO_FOOD["food_name"],
            "confidence": 0.95,
            "grams": grams,
            "estimate": True,
            "match": "curated",
            "nutrition": nutrition,
            "candidates": [],
        }

        return {
            "status": "ok",
            "items": [item],
            "totals": totals,
            "score": score,
            "advice": advice,
        }


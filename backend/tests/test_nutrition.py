"""Tests for nutrition calculation, scoring, and advice."""

from __future__ import annotations

from app.nutrition import (
    calculate_nutrition,
    compute_meal_score,
    generate_advice,
    round_grams,
    sum_nutrition,
)


class TestNutritionArithmetic:
    """nutrition = per_100g × grams ÷ 100, deterministic."""

    def test_basic_calculation(self):
        per_100g = {
            "calories_per_100g": 250,
            "protein_g_per_100g": 20,
            "carbs_g_per_100g": 30,
            "fat_g_per_100g": 10,
            "fiber_g_per_100g": 5,
            "sugar_g_per_100g": 8,
            "sodium_mg_per_100g": 400,
        }
        result = calculate_nutrition(per_100g, 200)
        assert result["calories"] == 500.0
        assert result["protein_g"] == 40.0
        assert result["carbs_g"] == 60.0
        assert result["fat_g"] == 20.0
        assert result["fiber_g"] == 10.0
        assert result["sugar_g"] == 16.0
        assert result["sodium_mg"] == 800.0

    def test_zero_grams(self):
        per_100g = {"calories_per_100g": 100, "protein_g_per_100g": 10}
        result = calculate_nutrition(per_100g, 0)
        assert result["calories"] == 0.0

    def test_fractional_grams(self):
        per_100g = {"calories_per_100g": 100}
        result = calculate_nutrition(per_100g, 150)
        assert result["calories"] == 150.0

    def test_sum_nutrition(self):
        a = {"calories": 100, "protein_g": 10, "carbs_g": 20, "fat_g": 5,
             "fiber_g": 3, "sugar_g": 4, "sodium_mg": 200}
        b = {"calories": 200, "protein_g": 15, "carbs_g": 25, "fat_g": 8,
             "fiber_g": 2, "sugar_g": 6, "sodium_mg": 300}
        totals = sum_nutrition([a, b])
        assert totals["calories"] == 300.0
        assert totals["protein_g"] == 25.0


class TestGramsRounding:
    """Grams rounded to nearest 5, clamped 5–2000."""

    def test_round_to_nearest_5(self):
        assert round_grams(152) == 150
        assert round_grams(153) == 155
        assert round_grams(150) == 150

    def test_clamp_min(self):
        assert round_grams(1) == 5
        assert round_grams(0) == 5

    def test_clamp_max(self):
        assert round_grams(3000) == 2000


class TestScoreBands:
    """Score bands: excellent ≥ 80, good ≥ 65, fair ≥ 45, poor < 45."""

    def test_excellent_band(self):
        # High protein, high fiber, low sugar/fat/sodium
        totals = {"protein_g": 30, "fiber_g": 10, "sugar_g": 5,
                  "fat_g": 10, "sodium_mg": 200, "calories": 400}
        result = compute_meal_score(totals)
        assert result["value"] >= 80
        assert result["band"] == "excellent"

    def test_poor_band(self):
        # Low protein, no fiber, high sugar/fat/sodium
        totals = {"protein_g": 2, "fiber_g": 0, "sugar_g": 70,
                  "fat_g": 90, "sodium_mg": 2500, "calories": 1200}
        result = compute_meal_score(totals)
        assert result["value"] < 45
        assert result["band"] == "poor"

    def test_breakdown_has_five_items(self):
        totals = {"protein_g": 15, "fiber_g": 5, "sugar_g": 20,
                  "fat_g": 25, "sodium_mg": 800, "calories": 600}
        result = compute_meal_score(totals)
        assert len(result["breakdown"]) == 5

    def test_score_between_0_and_100(self):
        totals = {"protein_g": 15, "fiber_g": 5, "sugar_g": 20,
                  "fat_g": 25, "sodium_mg": 800, "calories": 600}
        result = compute_meal_score(totals)
        assert 0 <= result["value"] <= 100


class TestAdvice:
    """Rule-based advice generation."""

    def test_high_calories_advice(self):
        totals = {"calories": 1000, "protein_g": 30, "fiber_g": 10,
                  "sugar_g": 10, "fat_g": 15, "sodium_mg": 300}
        advice = generate_advice(totals)
        assert any("calorie" in a.lower() for a in advice)

    def test_low_protein_advice(self):
        totals = {"calories": 300, "protein_g": 5, "fiber_g": 10,
                  "sugar_g": 10, "fat_g": 15, "sodium_mg": 300}
        advice = generate_advice(totals)
        assert any("protein" in a.lower() for a in advice)

    def test_good_meal_no_warnings(self):
        totals = {"calories": 400, "protein_g": 25, "fiber_g": 8,
                  "sugar_g": 10, "fat_g": 15, "sodium_mg": 300}
        advice = generate_advice(totals)
        assert any("great" in a.lower() or "good" in a.lower() for a in advice)


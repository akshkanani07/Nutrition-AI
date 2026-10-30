"""Nutrition calculation and meal scoring — deterministic, no LLM."""

from __future__ import annotations


def calculate_nutrition(
    per_100g: dict[str, float], grams: float
) -> dict[str, float]:
    """Scale per-100 g values to the given portion size.

    Returns a dict with keys: calories, protein_g, carbs_g, fat_g,
    fiber_g, sugar_g, sodium_mg.
    """
    factor = grams / 100.0
    return {
        "calories": round(per_100g.get("calories_per_100g", 0) * factor, 1),
        "protein_g": round(per_100g.get("protein_g_per_100g", 0) * factor, 1),
        "carbs_g": round(per_100g.get("carbs_g_per_100g", 0) * factor, 1),
        "fat_g": round(per_100g.get("fat_g_per_100g", 0) * factor, 1),
        "fiber_g": round(per_100g.get("fiber_g_per_100g", 0) * factor, 1),
        "sugar_g": round(per_100g.get("sugar_g_per_100g", 0) * factor, 1),
        "sodium_mg": round(per_100g.get("sodium_mg_per_100g", 0) * factor, 1),
    }


def round_grams(grams: float) -> float:
    """Round grams to the nearest 5 and clamp to a plausible range (5–2000)."""
    rounded = round(grams / 5) * 5
    return float(max(5, min(2000, rounded)))


def sum_nutrition(items: list[dict[str, float]]) -> dict[str, float]:
    """Sum nutrition dicts from multiple food items."""
    keys = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg"]
    totals = {k: 0.0 for k in keys}
    for item in items:
        for k in keys:
            totals[k] += item.get(k, 0)
    return {k: round(v, 1) for k, v in totals.items()}


# ---------------------------------------------------------------------------
# Meal scoring
# ---------------------------------------------------------------------------

def compute_meal_score(totals: dict[str, float]) -> dict:
    """Compute a deterministic meal quality score out of 100.

    Breakdown categories (max points):
      - Protein adequacy (25)
      - Fiber adequacy (20)
      - Sugar moderation (20)
      - Fat moderation (20)
      - Sodium moderation (15)

    Returns dict with value, band, breakdown.
    """
    breakdown = []

    # --- Protein (target: ≥20 g per meal → 25 pts) ---
    protein = totals.get("protein_g", 0)
    protein_pts = min(25, round(protein / 20 * 25))
    breakdown.append({"label": "Protein adequacy", "points": protein_pts, "max": 25})

    # --- Fiber (target: ≥8 g per meal → 20 pts) ---
    fiber = totals.get("fiber_g", 0)
    fiber_pts = min(20, round(fiber / 8 * 20))
    breakdown.append({"label": "Fiber adequacy", "points": fiber_pts, "max": 20})

    # --- Sugar moderation (≤15 g → 20 pts, linearly down to 0 at 60 g) ---
    sugar = totals.get("sugar_g", 0)
    if sugar <= 15:
        sugar_pts = 20
    elif sugar >= 60:
        sugar_pts = 0
    else:
        sugar_pts = round(20 * (1 - (sugar - 15) / 45))
    breakdown.append({"label": "Sugar moderation", "points": sugar_pts, "max": 20})

    # --- Fat moderation (≤20 g → 20 pts, linearly down to 0 at 80 g) ---
    fat = totals.get("fat_g", 0)
    if fat <= 20:
        fat_pts = 20
    elif fat >= 80:
        fat_pts = 0
    else:
        fat_pts = round(20 * (1 - (fat - 20) / 60))
    breakdown.append({"label": "Fat moderation", "points": fat_pts, "max": 20})

    # --- Sodium moderation (≤600 mg → 15 pts, linearly down to 0 at 2000 mg) ---
    sodium = totals.get("sodium_mg", 0)
    if sodium <= 600:
        sodium_pts = 15
    elif sodium >= 2000:
        sodium_pts = 0
    else:
        sodium_pts = round(15 * (1 - (sodium - 600) / 1400))
    breakdown.append({"label": "Sodium moderation", "points": sodium_pts, "max": 15})

    value = sum(item["points"] for item in breakdown)
    value = max(0, min(100, value))

    if value >= 80:
        band = "excellent"
    elif value >= 65:
        band = "good"
    elif value >= 45:
        band = "fair"
    else:
        band = "poor"

    return {"value": value, "band": band, "breakdown": breakdown}


# ---------------------------------------------------------------------------
# Rule-based advice
# ---------------------------------------------------------------------------

def generate_advice(totals: dict[str, float]) -> list[str]:
    """Generate deterministic health recommendations based on totals."""
    advice: list[str] = []

    if totals.get("calories", 0) > 800:
        advice.append("This meal is high in calories. Consider reducing your portion size.")
    if totals.get("protein_g", 0) < 10:
        advice.append(
            "Low protein detected. Add lean meats, legumes, or dairy for better satiety."
        )
    if totals.get("fiber_g", 0) < 3:
        advice.append(
            "Low fiber content. Include more vegetables, whole grains, or fruits."
        )
    if totals.get("sugar_g", 0) > 30:
        advice.append(
            "High sugar intake. Reduce sugary foods and choose whole-food alternatives."
        )
    if totals.get("fat_g", 0) > 40:
        advice.append(
            "High fat content. Opt for grilled or steamed preparations instead of fried."
        )
    if totals.get("sodium_mg", 0) > 1000:
        advice.append(
            "High sodium. Reduce salt and processed foods to support heart health."
        )

    if not advice:
        advice.append("Great balance! This meal has a good nutritional profile.")

    return advice


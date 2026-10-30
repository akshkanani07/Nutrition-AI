"""Pydantic models for API request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Error envelope
# ---------------------------------------------------------------------------
class ErrorDetail(BaseModel):
    code: str
    message: str
    hint: str | None = None
    retryable: bool = False


class ErrorResponse(BaseModel):
    success: bool = False
    request_id: str
    error: ErrorDetail


# ---------------------------------------------------------------------------
# Nutrition
# ---------------------------------------------------------------------------
class NutritionInfo(BaseModel):
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float
    sugar_g: float
    sodium_mg: float


# ---------------------------------------------------------------------------
# Food item
# ---------------------------------------------------------------------------
class CandidateItem(BaseModel):
    food_key: str
    name: str
    score: float


class FoodItem(BaseModel):
    food_key: str
    name: str
    confidence: float = Field(ge=0, le=1)
    grams: float
    estimate: bool = True
    match: str  # "curated" | "category_average"
    nutrition: NutritionInfo
    candidates: list[CandidateItem] = []


# ---------------------------------------------------------------------------
# Score
# ---------------------------------------------------------------------------
class ScoreBreakdownItem(BaseModel):
    label: str
    points: float
    max: float


class MealScore(BaseModel):
    value: int = Field(ge=0, le=100)
    band: str  # "excellent" | "good" | "fair" | "poor"
    breakdown: list[ScoreBreakdownItem]


# ---------------------------------------------------------------------------
# Success response
# ---------------------------------------------------------------------------
class AnalysisResponse(BaseModel):
    success: bool = True
    request_id: str
    provider: str
    model_version: str | None = None
    status: str  # "ok" | "unsure" | "no_food"
    items: list[FoodItem] = []
    totals: NutritionInfo | None = None
    score: MealScore | None = None
    advice: list[str] = []


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
class HealthResponse(BaseModel):
    status: str
    version: str
    provider: str
    provider_ready: bool
    model_version: str | None = None


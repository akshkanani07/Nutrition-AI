"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIN_SHORT_SIDE = 64;

interface Nutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

interface Candidate {
  food_key: string;
  name: string;
  score: number;
}

interface Item {
  food_key: string;
  name: string;
  confidence: number;
  grams: number;
  estimate: boolean;
  match: string;
  nutrition: Nutrition;
  candidates?: Candidate[];
}

interface ScoreBreakdown {
  label: string;
  points: number;
  max: number;
}

interface MealScore {
  value: number;
  band: "excellent" | "good" | "fair" | "poor";
  breakdown: ScoreBreakdown[];
}

interface AnalysisResult {
  success: boolean;
  request_id: string;
  provider: string;
  model_version?: string;
  status: "ok" | "unsure" | "no_food";
  items: Item[];
  totals?: Nutrition;
  score?: MealScore;
  advice: string[];
}

interface ErrorDetails {
  code: string;
  message: string;
  hint?: string;
  retryable?: boolean;
}

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorDetails | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validateImage = (selectedFile: File): Promise<string | null> => {
    return new Promise((resolve) => {
      if (selectedFile.size > MAX_SIZE_BYTES) {
        resolve(
          `Image size (${(selectedFile.size / (1024 * 1024)).toFixed(
            1
          )} MB) exceeds the 10 MB limit.`
        );
        return;
      }

      if (!ALLOWED_TYPES.includes(selectedFile.type)) {
        resolve("Unsupported file format. Please upload JPEG, PNG, or WEBP.");
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(selectedFile);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const shortSide = Math.min(img.width, img.height);
        if (shortSide < MIN_SHORT_SIDE) {
          resolve(
            `Image resolution is too small (${img.width}x${img.height}). The short side must be at least 64 px.`
          );
        } else {
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve("Could not decode image. The file may be corrupted.");
      };
      img.src = objectUrl;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);

    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validationError = await validateImage(selectedFile);
    if (validationError) {
      setError({
        code: "INVALID_IMAGE",
        message: validationError,
        hint: "Please select a valid image conforming to the specifications.",
      });
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/analyze-food", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError({
          code: data.error?.code || "ANALYSIS_FAILED",
          message: data.error?.message || "Failed to analyze food image.",
          hint: data.error?.hint,
          retryable: data.error?.retryable,
        });
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setError({
          code: "REQUEST_CANCELLED",
          message: "Analysis request was cancelled by the user.",
          hint: "You can click 'Analyze Meal' to retry whenever you are ready.",
          retryable: true,
        });
      } else {
        setError({
          code: "CLIENT_ERROR",
          message: err instanceof Error ? err.message : "An unexpected error occurred.",
          retryable: true,
        });
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const chartData = result?.totals
    ? [
        { name: "Protein", grams: result.totals.protein_g, color: "#10b981" },
        { name: "Carbs", grams: result.totals.carbs_g, color: "#3b82f6" },
        { name: "Fat", grams: result.totals.fat_g, color: "#f59e0b" },
        { name: "Fiber", grams: result.totals.fiber_g, color: "#8b5cf6" },
        { name: "Sugar", grams: result.totals.sugar_g, color: "#ec4899" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <span className="font-semibold text-lg tracking-tight">
          Nutrify <span className="text-emerald-600">AI</span>
        </span>
        <div className="w-20" />
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Meal Nutrition Analysis</h1>
          <p className="text-slate-600 mt-1">
            Upload an image of your meal for instant detection, macronutrient breakdown, and health score.
          </p>
        </div>

        {/* DEMO Mode Banner */}
        {result?.provider === "mock" && (
          <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-sm uppercase tracking-wide">
                  Demo Mode (Mock Provider)
                </span>
                <p className="text-xs text-amber-700">
                  Running in mock demonstration mode. Predictions and nutritional values shown below are generated samples.
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
              MOCK DEMO
            </Badge>
          </div>
        )}

        {/* Error Panel */}
        {error && (
          <div className="mb-6 rounded-lg bg-rose-50 border border-rose-200 p-4 text-rose-900 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Error: {error.code}</span>
              </div>
              <p className="text-sm text-rose-800 mt-1">{error.message}</p>
              {error.hint && (
                <p className="text-xs text-rose-600 mt-1.5 italic">
                  Hint: {error.hint}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-rose-500 hover:text-rose-700 hover:bg-rose-100 -mt-1 -mr-1"
              onClick={() => setError(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Upload Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Meal Image Upload</CardTitle>
            <CardDescription>
              Select or drop a photo of your meal (JPEG, PNG, or WEBP, up to 10 MB).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!preview ? (
              <label className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group">
                <UploadCloud className="w-12 h-12 text-slate-400 group-hover:text-emerald-600 transition-colors mb-3" />
                <span className="text-sm font-medium text-slate-700">
                  Click to select a photo, or drag and drop
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  JPEG, PNG, WEBP • Max 10 MB • Min 64x64 px
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border bg-slate-900 max-h-80 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Meal preview"
                    className="max-h-80 object-contain w-full"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-3 right-3 bg-white/90 hover:bg-white text-slate-800"
                    onClick={handleReset}
                    disabled={loading}
                  >
                    Change Image
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  {!loading ? (
                    <Button
                      onClick={handleAnalyze}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Analyze Meal
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        disabled
                        className="bg-emerald-600/70 text-white cursor-not-allowed"
                      >
                        Analyzing Meal...
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        Cancel Analysis
                      </Button>
                    </div>
                  )}
                  <Button variant="ghost" onClick={handleReset} disabled={loading}>
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        {result && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-500">Analysis Status:</span>
                {result.status === "ok" && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Foods Detected
                  </Badge>
                )}
                {result.status === "unsure" && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Low Confidence / Unsure
                  </Badge>
                )}
                {result.status === "no_food" && (
                  <Badge className="bg-slate-100 text-slate-800 border-slate-300">
                    <XCircle className="w-3.5 h-3.5 mr-1" /> No Food Detected
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Provider: <strong>{result.provider}</strong></span>
                {result.model_version && (
                  <span>• Version: <strong>{result.model_version}</strong></span>
                )}
              </div>
            </div>

            {/* Unsure state candidate cards */}
            {result.status === "unsure" && result.items?.[0]?.candidates && (
              <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader>
                  <CardTitle className="text-amber-900 text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    Unsure Identification — Top Candidate Matches
                  </CardTitle>
                  <CardDescription>
                    The model was uncertain about the exact meal. Here are the top candidates:
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.items[0].candidates.map((cand, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-lg border border-amber-100 flex items-center justify-between"
                      >
                        <span className="font-medium text-sm text-slate-800">{cand.name}</span>
                        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                          {(cand.score * 100).toFixed(1)}% match
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detected Foods */}
            <Card>
              <CardHeader>
                <CardTitle>Detected Foods</CardTitle>
                <CardDescription>Estimated portions and macronutrient contributions.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {result.items.map((item, idx) => (
                    <div key={idx} className="py-3 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{item.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {(item.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>
                        <span className="text-xs text-slate-500">
                          Estimated portion: ~{item.grams} g ({item.match} match)
                        </span>
                      </div>
                      <div className="text-right text-xs text-slate-600 font-mono">
                        <div><strong>{item.nutrition.calories}</strong> kcal</div>
                        <div>P: {item.nutrition.protein_g}g • C: {item.nutrition.carbs_g}g • F: {item.nutrition.fat_g}g</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Totals & Chart Grid */}
            {result.totals && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Total Nutrition Cards */}
                <Card>
                  <CardHeader>
                    <CardTitle>Total Nutrition</CardTitle>
                    <CardDescription>Aggregate nutritional metrics for the meal.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-extrabold text-emerald-600">
                      {result.totals.calories} <span className="text-base font-normal text-slate-500">calories</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div className="p-2.5 bg-slate-50 rounded-lg border">
                        <span className="text-xs text-slate-500 block">Protein</span>
                        <strong className="text-base text-slate-900">{result.totals.protein_g} g</strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border">
                        <span className="text-xs text-slate-500 block">Carbs</span>
                        <strong className="text-base text-slate-900">{result.totals.carbs_g} g</strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border">
                        <span className="text-xs text-slate-500 block">Fat</span>
                        <strong className="text-base text-slate-900">{result.totals.fat_g} g</strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border">
                        <span className="text-xs text-slate-500 block">Fiber</span>
                        <strong className="text-base text-slate-900">{result.totals.fiber_g} g</strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border">
                        <span className="text-xs text-slate-500 block">Sugar</span>
                        <strong className="text-base text-slate-900">{result.totals.sugar_g} g</strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border">
                        <span className="text-xs text-slate-500 block">Sodium</span>
                        <strong className="text-base text-slate-900">{result.totals.sodium_mg} mg</strong>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Macro Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Macronutrient Distribution</CardTitle>
                    <CardDescription>Grams per macronutrient category.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => [`${value} g`, "Amount"]} />
                        <Bar dataKey="grams" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Score & Breakdown */}
            {result.score && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Meal Quality Score</CardTitle>
                    <CardDescription>Deterministic quality evaluation out of 100.</CardDescription>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {result.score.value}
                      <span className="text-sm font-normal text-slate-400">/100</span>
                    </span>
                    <div>
                      <Badge
                        className={`text-xs capitalize ${
                          result.score.band === "excellent"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : result.score.band === "good"
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : result.score.band === "fair"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}
                      >
                        {result.score.band}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.score.breakdown.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium text-slate-700">
                          <span>{item.label}</span>
                          <span>{item.points} / {item.max} pts</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-2 rounded-full transition-all"
                            style={{ width: `${(item.points / item.max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Health Advice */}
            {result.advice?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations & Advice</CardTitle>
                  <CardDescription>Actionable insights derived from your meal profile.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.advice.map((line, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}


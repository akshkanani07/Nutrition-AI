"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera,
  Cpu,
  BarChart3,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowRight,
  HeartPulse,
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

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navigation */}
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-30 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            N
          </div>
          <span className="font-bold text-xl tracking-tight">
            Nutrify <span className="text-emerald-600">AI</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/analyze">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm">
              Launch App <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-24 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="space-y-6"
        >
          <motion.div variants={fadeInUp}>
            <Badge
              variant="secondary"
              className="px-3 py-1 bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold uppercase tracking-wider"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              100% Offline • Zero API Calls • Complete Privacy
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight"
          >
            Instant Meal Nutrition <br className="hidden sm:inline" />
            <span className="text-emerald-600">Powered by Local AI</span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
          >
            Upload a meal photo and instantly get identified foods, estimated portions,
            complete macronutrient profiles, and an actionable meal health score.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Link href="/analyze" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-base font-semibold shadow-md hover:shadow-lg transition-all"
              >
                Analyze a Meal Now <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline py-2"
            >
              See How It Works
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works (3 Steps) */}
      <section id="how-it-works" className="py-16 bg-white border-y border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              How Nutrify AI Works
            </h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">
              A transparent, deterministic pipeline that transforms meal photos into scientific nutrition insights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 font-bold text-lg">
                  <Camera className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl">1. Upload Photo</CardTitle>
                <CardDescription>
                  Drop or capture any meal photo. Client-side validation ensures dimensions and format meet standards.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-500">
                Photos are processed in-memory and never written to disk or sent to external cloud APIs.
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 font-bold text-lg">
                  <Cpu className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl">2. Local AI Identification</CardTitle>
                <CardDescription>
                  A local deep neural network detects food classes and estimates realistic serving portions in grams.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-500">
                Fallback retrieval ensures high coverage, returning confidence ratings and candidate foods.
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 font-bold text-lg">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl">3. Deterministic Breakdown</CardTitle>
                <CardDescription>
                  Verified nutrition profiles calculate calories, six essential macros, and a comprehensive meal score.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-500">
                Receives actionable, rule-based health recommendations derived from verified nutritional benchmarks.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Engineered for Precision & Privacy
          </h2>
          <p className="text-slate-600 mt-2 text-sm sm:text-base">
            Built without third-party AI dependencies, hallucinations, or data leaks.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-slate-200/80 bg-white">
            <CardHeader className="pb-3">
              <ShieldCheck className="w-8 h-8 text-emerald-600 mb-2" />
              <CardTitle className="text-lg">Zero Cloud AI</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 leading-relaxed">
              Inference runs locally on CPU/GPU. No photos leave your machine, guaranteeing total privacy and offline capability.
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white">
            <CardHeader className="pb-3">
              <Zap className="w-8 h-8 text-emerald-600 mb-2" />
              <CardTitle className="text-lg">Deterministic Engine</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 leading-relaxed">
              Nutrition values scale deterministically from curated USDA & verified databases. Deterministic calculations compute macros and calories directly from verified reference data.
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white">
            <CardHeader className="pb-3">
              <HeartPulse className="w-8 h-8 text-emerald-600 mb-2" />
              <CardTitle className="text-lg">Meal Health Score</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 leading-relaxed">
              Every meal receives a clear score out of 100 with category breakdowns: protein, fiber, sugar, fat balance, and sodium.
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white">
            <CardHeader className="pb-3">
              <BarChart3 className="w-8 h-8 text-emerald-600 mb-2" />
              <CardTitle className="text-lg">Interactive Charts</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 leading-relaxed">
              Visualize macronutrients with responsive Recharts visualizations, highlighting dietary balances and deficits.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="bg-emerald-900 text-white py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to analyze your next meal?
          </h2>
          <p className="text-emerald-100 max-w-xl mx-auto text-sm sm:text-base">
            Try Nutrify AI right now with any food or beverage image.
          </p>
          <div className="pt-2">
            <Link href="/analyze">
              <Button
                size="lg"
                className="bg-white text-emerald-950 hover:bg-emerald-50 px-8 py-6 font-semibold text-base shadow-lg"
              >
                Go to Analysis Studio <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-6 text-center text-xs text-slate-500">
        Nutrify AI • Production-Grade Local Nutrition Analysis • Fully Offline
      </footer>
    </div>
  );
}

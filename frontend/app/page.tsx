import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Nutrify <span className="text-emerald-600">AI</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Upload a meal photo and get instant nutrition analysis — calories,
          macros, meal score, and personalised advice. Fully offline, fully
          private.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/analyze"
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors"
          >
            Analyze a Meal
          </Link>
        </div>
      </div>
    </main>
  );
}


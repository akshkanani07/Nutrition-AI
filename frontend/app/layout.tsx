import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nutrify AI — Instant Meal Nutrition Analysis",
  description:
    "Upload a meal photo and get instant nutrition analysis with AI-powered food recognition.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}


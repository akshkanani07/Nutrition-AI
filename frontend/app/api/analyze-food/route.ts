import { NextRequest, NextResponse } from "next/server";
import { handleAnalyzeProxy } from "@/lib/proxy";

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleAnalyzeProxy(request);
}

import { NextRequest, NextResponse } from "next/server";

export const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
export const REQUEST_TIMEOUT_MS = 30000;

export interface ErrorResponseEnvelope {
  success: false;
  request_id: string;
  error: {
    code: string;
    message: string;
    hint?: string;
    retryable?: boolean;
  };
}

export function makeErrorResponse(
  status: number,
  code: string,
  message: string,
  hint?: string,
  retryable = false
): NextResponse<ErrorResponseEnvelope> {
  return NextResponse.json(
    {
      success: false,
      request_id: crypto.randomUUID(),
      error: { code, message, hint, retryable },
    },
    { status }
  );
}

export async function handleAnalyzeProxy(
  request: NextRequest,
  backendUrl: string = process.env.BACKEND_API_URL || DEFAULT_BACKEND_URL,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<NextResponse> {
  // Check if client cancelled before processing
  if (request.signal.aborted) {
    return makeErrorResponse(
      499,
      "REQUEST_CANCELLED",
      "The analysis request was cancelled by the client."
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return makeErrorResponse(
      400,
      "INVALID_REQUEST",
      "Failed to parse multipart form data."
    );
  }

  const image = formData.get("image");
  if (!image) {
    return makeErrorResponse(
      400,
      "MISSING_IMAGE",
      "No image was uploaded.",
      "Attach an image file to the 'image' form field."
    );
  }

  const backendFormData = new FormData();
  backendFormData.append("image", image);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // If the client cancels mid-flight, forward abort
  const onClientAbort = () => controller.abort();
  request.signal.addEventListener("abort", onClientAbort);

  // Resolve headers based on TRUST_EDGE_PROXY (read at request time, default false)
  const trustEdgeProxy = process.env.TRUST_EDGE_PROXY === "true";
  const backendHeaders: Record<string, string> = {};

  if (trustEdgeProxy) {
    const incomingXff = request.headers.get("x-forwarded-for");
    if (incomingXff) {
      const hops = incomingXff.split(",").map((h) => h.trim()).filter(Boolean);
      if (hops.length > 0) {
        // Forward ONLY the rightmost entry
        backendHeaders["X-Forwarded-For"] = hops[hops.length - 1];
      }
    }
  }

  const fetchOptions: RequestInit = {
    method: "POST",
    body: backendFormData,
    signal: controller.signal,
  };
  if (Object.keys(backendHeaders).length > 0) {
    fetchOptions.headers = backendHeaders;
  }

  try {
    const backendResponse = await fetch(`${backendUrl}/api/v1/analyze-food`, fetchOptions);

    clearTimeout(timeoutId);
    request.signal.removeEventListener("abort", onClientAbort);

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: backendResponse.status });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    request.signal.removeEventListener("abort", onClientAbort);

    // Client cancellation check
    if (request.signal.aborted) {
      return makeErrorResponse(
        499,
        "REQUEST_CANCELLED",
        "The analysis request was cancelled by the client."
      );
    }

    // Timeout check
    if (err instanceof Error && err.name === "AbortError") {
      return makeErrorResponse(
        504,
        "ANALYSIS_TIMEOUT",
        "The analysis request timed out.",
        "Please try again with a smaller image or retry later.",
        true
      );
    }

    // Connection refused / Backend unreachable check
    const errorCause = (err as { cause?: { code?: string; errno?: number } })?.cause;
    const isConnRefused =
      errorCause?.code === "ECONNREFUSED" ||
      errorCause?.errno === -4078 ||
      (err instanceof Error &&
        (err.message.includes("ECONNREFUSED") ||
          err.message.includes("fetch failed")));

    if (isConnRefused) {
      return makeErrorResponse(
        503,
        "BACKEND_UNREACHABLE",
        "The analysis service is not running.",
        "Ensure the backend server is running and accessible.",
        true
      );
    }

    // Log the real error on the server; return generic message to client to avoid information leakage
    console.error("Analysis proxy unexpected error:", err);
    return makeErrorResponse(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred."
    );
  }
}

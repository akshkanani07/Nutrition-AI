import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { handleAnalyzeProxy } from "../lib/proxy";

function createMockRequest(options: {
  abort?: boolean;
  formData?: FormData;
  headers?: Record<string, string>;
  ip?: string;
} = {}) {
  const controller = new AbortController();
  if (options.abort) {
    controller.abort();
  }

  const formData = options.formData || new FormData();
  if (!options.formData) {
    formData.append("image", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "test.jpg");
  }

  const req = new NextRequest("http://localhost:3000/api/analyze-food", {
    method: "POST",
    body: formData,
    headers: options.headers,
    signal: controller.signal,
  });

  if (options.ip) {
    Object.defineProperty(req, "ip", { value: options.ip });
  }

  return { req, controller };
}

test("1. BACKEND_UNREACHABLE mapping when connection is refused", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    const error = new TypeError("fetch failed");
    (error as any).cause = { code: "ECONNREFUSED", errno: -4078 };
    throw error;
  };

  try {
    const { req } = createMockRequest();
    const response = await handleAnalyzeProxy(req, "http://127.0.0.1:9999");
    assert.equal(response.status, 503);

    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "BACKEND_UNREACHABLE");
    assert.equal(body.error.message, "The analysis service is not running.");
  } finally {
    global.fetch = originalFetch;
  }
});

test("2. REQUEST_CANCELLED mapping when client cancels", async () => {
  const { req } = createMockRequest({ abort: true });
  const response = await handleAnalyzeProxy(req, "http://127.0.0.1:8000");

  assert.equal(response.status, 499);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, "REQUEST_CANCELLED");
  assert.match(body.error.message, /cancelled/i);
});

test("3. server error passthrough retains backend code and status", async () => {
  const originalFetch = global.fetch;
  const backendErrorEnvelope = {
    success: false,
    request_id: "test-backend-req",
    error: {
      code: "MODEL_NOT_READY",
      message: "The ML model is not loaded. Weights may be missing.",
      retryable: true,
    },
  };

  global.fetch = async () => {
    return new Response(JSON.stringify(backendErrorEnvelope), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const { req } = createMockRequest();
    const response = await handleAnalyzeProxy(req, "http://127.0.0.1:8000");
    assert.equal(response.status, 503);

    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "MODEL_NOT_READY");
    assert.equal(body.error.message, backendErrorEnvelope.error.message);
  } finally {
    global.fetch = originalFetch;
  }
});

test("4. timeout mapping maps AbortError to 504 ANALYSIS_TIMEOUT", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    const abortErr = new Error("The operation was aborted");
    abortErr.name = "AbortError";
    throw abortErr;
  };

  try {
    const { req } = createMockRequest();
    const response = await handleAnalyzeProxy(req, "http://127.0.0.1:8000", 50);
    assert.equal(response.status, 504);

    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "ANALYSIS_TIMEOUT");
    assert.match(body.error.message, /timed out/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test("5. two requests with different spoofed X-Forwarded-For values, sent from the same socket, share one rate-limit bucket", async () => {
  const originalFetch = global.fetch;

  // Simulate backend rate-limiting bucket with capacity = 1 per forwarded IP
  const bucketCounts = new Map<string, number>();
  const forwardedIps: string[] = [];

  global.fetch = async (_url: any, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    const forwardedIp = headers?.["X-Forwarded-For"] || "unknown";
    forwardedIps.push(forwardedIp);

    const count = (bucketCounts.get(forwardedIp) || 0) + 1;
    bucketCounts.set(forwardedIp, count);

    if (count > 1) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "RATE_LIMITED", message: "Too many requests" },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, items: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    // Request 1: Client spoofs IP "203.0.113.195", but socket is from local server (e.g. 127.0.0.1)
    const { req: req1 } = createMockRequest({
      headers: { "x-forwarded-for": "203.0.113.195" },
      ip: "127.0.0.1",
    });
    const res1 = await handleAnalyzeProxy(req1, "http://127.0.0.1:8000");
    assert.equal(res1.status, 200, "First request from socket should succeed");

    // Request 2: Same socket (127.0.0.1) attempts to bypass limit by spoofing IP "198.51.100.42"
    const { req: req2 } = createMockRequest({
      headers: { "x-forwarded-for": "198.51.100.42" },
      ip: "127.0.0.1",
    });
    const res2 = await handleAnalyzeProxy(req2, "http://127.0.0.1:8000");

    // Both requests forwarded the socket's server-determined IP, ignoring the spoofed headers
    assert.equal(forwardedIps[0], "127.0.0.1");
    assert.equal(forwardedIps[1], "127.0.0.1");

    // Second request is rate limited because both requests shared the same bucket
    assert.equal(res2.status, 429, "Second request from same socket must be rate-limited despite spoofed header");
    const body2 = await res2.json();
    assert.equal(body2.error.code, "RATE_LIMITED");
  } finally {
    global.fetch = originalFetch;
  }
});

test("6. INTERNAL_ERROR returns generic message and does not leak real error", async () => {
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  let loggedError: any = null;
  console.error = (...args: any[]) => {
    loggedError = args;
  };

  global.fetch = async () => {
    throw new Error("SECRET_INTERNAL_DB_CONNECTION_LEAK");
  };

  try {
    const { req } = createMockRequest();
    const response = await handleAnalyzeProxy(req, "http://127.0.0.1:8000");
    assert.equal(response.status, 500);

    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INTERNAL_ERROR");
    assert.equal(body.error.message, "An unexpected error occurred.");
    assert.doesNotMatch(body.error.message, /SECRET_INTERNAL/);
    assert(loggedError !== null);
  } finally {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

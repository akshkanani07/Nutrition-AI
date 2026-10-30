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

test("5. TRUST_EDGE_PROXY controls X-Forwarded-For forwarding", async () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.TRUST_EDGE_PROXY;

  let capturedHeaders: HeadersInit | undefined;
  global.fetch = async (_url: any, init?: RequestInit) => {
    capturedHeaders = init?.headers;
    return new Response(
      JSON.stringify({ success: true, items: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    // 5a. When false: ignores any incoming X-Forwarded-For header and sends nothing
    process.env.TRUST_EDGE_PROXY = "false";
    capturedHeaders = undefined;
    const { req: reqFalse } = createMockRequest({
      headers: { "x-forwarded-for": "9.9.9.9, 1.2.3.4" },
    });
    await handleAnalyzeProxy(reqFalse, "http://127.0.0.1:8000");
    const sentHeaderFalse = (capturedHeaders as Record<string, string>)?.[
      "X-Forwarded-For"
    ];
    assert.equal(sentHeaderFalse, undefined, "When false, no X-Forwarded-For must be sent");

    // 5b. When true: forwards ONLY the rightmost entry ("1.2.3.4") from "9.9.9.9, 1.2.3.4"
    process.env.TRUST_EDGE_PROXY = "true";
    capturedHeaders = undefined;
    const { req: reqTrueWithHeader } = createMockRequest({
      headers: { "x-forwarded-for": "9.9.9.9, 1.2.3.4" },
    });
    await handleAnalyzeProxy(reqTrueWithHeader, "http://127.0.0.1:8000");
    const sentHeaderTrue = (capturedHeaders as Record<string, string>)?.[
      "X-Forwarded-For"
    ];
    assert.equal(sentHeaderTrue, "1.2.3.4", "When true, forwards strictly the rightmost entry");

    // 5c. When true with no header: forwards nothing
    capturedHeaders = undefined;
    const { req: reqTrueNoHeader } = createMockRequest();
    await handleAnalyzeProxy(reqTrueNoHeader, "http://127.0.0.1:8000");
    const sentHeaderEmpty = (capturedHeaders as Record<string, string>)?.[
      "X-Forwarded-For"
    ];
    assert.equal(sentHeaderEmpty, undefined, "When true with no header, no X-Forwarded-For must be sent");
  } finally {
    global.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.TRUST_EDGE_PROXY;
    } else {
      process.env.TRUST_EDGE_PROXY = originalEnv;
    }
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

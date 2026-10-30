import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { handleAnalyzeProxy } from "../lib/proxy";

function createMockRequest(options: {
  abort?: boolean;
  formData?: FormData;
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
    signal: controller.signal,
  });

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

# Nutrify AI

An AI-powered Food & Drink Recognition and Nutrition Analysis Platform running fully offline.

## Architecture

- **Backend**: FastAPI (Python 3.12), Pydantic schemas, deterministic nutritional math scaling.
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Framer Motion, Recharts.
- **ML Pipeline**: Offline CPU/GPU vision models and verified nutrition datasets.

## Production & Deployment Notes

### Rate Limiting & Proxy Security
Rate limiting uses a sliding-window counter per client IP. The system supports two deployment modes:

1. **Local Development (`TRUST_EDGE_PROXY=false`, default)**: The Next.js BFF sends no `X-Forwarded-For` header at all. The FastAPI backend sees the direct loopback socket (`127.0.0.1`) and uses a single local development bucket.
2. **Production Behind Edge Proxy (`TRUST_EDGE_PROXY=true`)**: The Next.js BFF reads the incoming `x-forwarded-for` header and forwards strictly its rightmost entry as `X-Forwarded-For`. It never forwards the whole header or untrusted client-supplied leftmost entries. If the header is missing, no `X-Forwarded-For` header is sent.

On the backend, `TRUSTED_PROXIES` must list only the immediate upstream hops you control (e.g. `127.0.0.1` for the local BFF). When the direct connecting socket host is in `TRUSTED_PROXIES`, FastAPI walks `X-Forwarded-For` from right to left and uses the first entry that is not in `TRUSTED_PROXIES`. If the direct connecting socket host is not in `TRUSTED_PROXIES`, `X-Forwarded-For` is ignored and the socket IP itself is used for rate limiting.

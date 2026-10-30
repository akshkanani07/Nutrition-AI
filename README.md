# Nutrify AI

An AI-powered Food & Drink Recognition and Nutrition Analysis Platform running fully offline.

## Architecture

- **Backend**: FastAPI (Python 3.12), Pydantic schemas, deterministic nutritional math scaling.
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Framer Motion, Recharts.
- **ML Pipeline**: Offline CPU/GPU vision models and verified nutrition datasets.

## Production & Deployment Notes

### Rate Limiting & Proxy Security
Per-IP rate limiting is accurate only behind a trusted reverse proxy. When deploying behind a reverse proxy (e.g., Cloudflare, NGINX, AWS ALB), ensure the proxy terminates client connections and securely sets client IP headers. The Next.js API proxy strips untrusted client-supplied headers and only forwards server-determined connection IPs to prevent header spoofing attacks.


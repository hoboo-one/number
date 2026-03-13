# Railway Single-Service Design

## Goal

Replace the Vercel-only image generation path with a single Railway Node service that:

- serves the current static frontend,
- exposes `/api/render-frame` from the same origin,
- forwards the user-provided OpenAI key server-side for BYOK rendering,
- avoids browser-to-OpenAI connectivity failures and Vercel runtime timeouts.

## Chosen Approach

We are using one Node HTTP server for both frontend and API traffic. This keeps deployment simple and removes CORS and multi-service coordination. The browser uploads reference images and prompt data to the same origin. The Node API forwards the request to OpenAI, returns the generated image, and never stores the user key.

## Data Flow

1. User opens the Railway-hosted site.
2. User uploads 1 to 6 reference images.
3. Browser compresses the images client-side for smaller payloads.
4. Browser sends `prompt`, `quality`, `inputFidelity`, and `images` to `/api/render-frame`.
5. Server calls OpenAI with the request header `x-openai-key`.
6. Server returns base64 image data to the browser.
7. Browser renders the result card and keeps download actions local.

## Safeguards

- Client image compression reduces request size and latency.
- API timeouts are capped before platform-level timeouts.
- Health endpoint `/health` supports Railway deploy checks.
- The app stays BYOK-only: no default OpenAI key is stored on the server.

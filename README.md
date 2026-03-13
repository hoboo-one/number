# AngleLab Studio

A Railway-ready MVP for generating 16:9 product storyboard images from uploaded product references.

## What this version does

- Upload 1-6 product reference images.
- Build a multi-shot storyboard blueprint locally in the browser.
- Compress reference images client-side before upload.
- Render each shot one by one through the same-origin `/api/render-frame` backend.
- Ask each user to bring their own OpenAI API key in the web UI.
- Keep the latest six blueprint configurations in local browser storage.

## Local development

1. Start the local server:
   `npm run dev`
2. Open `http://127.0.0.1:3000`
3. Optional: run a direct backend render test:
   `npm run test:render -- --input path/to/product.png --prompt "Create a premium 16:9 product shot."`

The local server uses the same `api/render-frame.js` handler as Railway production, so we can debug the real render path locally before redeploying.

## Deploy on Railway

1. Push this repository to GitHub.
2. Create a new Railway project.
3. Choose `Deploy from GitHub repo` and select this repository.
4. Railway will detect `railway.json` and run `npm start`.
5. After the deploy is ready, open the generated Railway URL.

## Important notes

- This MVP is BYOK only: the site does not ship with a default OpenAI key.
- The API key is sent with each render request and forwarded server-side to OpenAI for that request only.
- The app is designed for a single Railway service, so the frontend and render API share one origin.
- The frontend currently stores generation history in localStorage, not a database.
- Output size is fixed to 16:9 (1536x1024) for the first version.

## Why we moved off the Vercel-only path

- Browser-direct OpenAI calls can fail when the user's current network cannot reach OpenAI reliably.
- Vercel serverless functions timed out on long-running image edit requests.
- Railway is a better fit for keeping the frontend and BYOK render API in one persistent service.

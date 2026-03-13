# AngleLab Studio

A Vercel-ready MVP for generating 16:9 product storyboard images from uploaded product references.

## What this version does

- Upload 1-6 product reference images.
- Build a multi-shot storyboard blueprint locally in the browser.
- Render each shot one by one through OpenAI image edits.
- Ask each user to bring their own OpenAI API key in the web UI.
- Keep the latest six blueprint configurations in local browser storage.

## Local development

1. Put your OpenAI key into `.env.local` if you want to run CLI tests:
   `OPENAI_API_KEY=...`
2. Start the local server:
   `npm run dev`
3. Open `http://127.0.0.1:3000`
4. Optional: run a direct backend render test:
   `npm run test:render -- --input path/to/product.png --prompt "Create a premium 16:9 product shot."`

The local server uses the same `api/render-frame.js` handler as production, so we can debug API behavior before redeploying.

## Deploy on Vercel

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Deploy.

## Important notes

- This MVP is BYOK only: the site does not ship with a default OpenAI key.
- The API key is sent with each render request and kept only in the current browser session.
- This MVP renders one shot at a time on purpose, which is safer for Vercel time limits and lower budgets.
- The frontend currently stores generation history in localStorage, not a database.
- Output size is fixed to 16:9 (1536x1024) for the first version.

## Why the first deploy failed

- The production `api/render-frame` function was capped at 60 seconds, and OpenAI image generation exceeded that window.
- The Vercel function timeout is now raised to 300 seconds in `vercel.json`.
- In this Codex sandbox, outbound network access to `api.openai.com` is blocked, so local code paths can be validated here, but final image output still needs to be verified on your machine or in Vercel.

# AngleLab Studio

A Vercel-ready MVP for generating 16:9 product storyboard images from uploaded product references.

## What this version does

- Upload 1-6 product reference images.
- Build a multi-shot storyboard blueprint locally in the browser.
- Render each shot one by one through OpenAI image edits.
- Keep the latest six blueprint configurations in local browser storage.

## Deploy on Vercel

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. Add the environment variable `OPENAI_API_KEY`.
4. Optional: add `OPENAI_IMAGE_MODEL` if you want to override the default `gpt-image-1`.
5. Deploy.

## Important notes

- This MVP renders one shot at a time on purpose, which is safer for Vercel time limits and lower budgets.
- The frontend currently stores generation history in `localStorage`, not a database.
- Output size is fixed to 16:9 (`1536x1024`) for the first version.

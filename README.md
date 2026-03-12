# AngleLab Studio

A Vercel-ready MVP for generating 16:9 product storyboard images from uploaded product references.

## What this version does

- Upload 1-6 product reference images.
- Build a multi-shot storyboard blueprint locally in the browser.
- Render each shot one by one through OpenAI image edits.
- Ask each user to bring their own OpenAI API key in the web UI.
- Keep the latest six blueprint configurations in local browser storage.

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

## Intent Engine (Signal → Pipeline)

### What this project is

Intent Engine is a Go-To-Market “signal → pipeline” engine.

You give it a list of target company domains. It opens those sites with stealth browsers, extracts **revenue-relevant signals**, and turns them into:

- A deterministic **Intent Score (0–100)**
- A short, human-readable “why this score” summary
- Structured evidence you can ship to a CRM (HubSpot in this repo)

The UI is intentionally minimal: one input screen, one live run screen, one results table with a details drawer.

### Why it matters (the GTM value)

Sales teams don’t need generic scraping. They need fast, explainable account research that helps answer:

- “Are they investing in AI right now?”
- “Do they sell like an enterprise company?”
- “Is this worth an AE’s time today?”

This project demonstrates how Browserbase + Stagehand can power the same real-world workflow: turn web signals into pipeline inputs.

### How it works (plain English)

For each domain, the engine does this:

1. **Spin up a stealth browser session** (Browserbase).
2. **Read the homepage** to detect AI posture (AI in hero, LLM/agent mentions).
3. **Find and visit Careers/Jobs**, then extract AI/ML/LLM hiring signals (including role titles when available).
4. **Find and visit Pricing/Plans**, then extract enterprise-tier signals (“Enterprise tier” + “contact sales” patterns).
5. **Score it deterministically** (no magic model score) and generate a one-line GTM summary.
6. **Stream results live** to the UI via Server-Sent Events (SSE).
7. **Sync to HubSpot** (optional) so it feels like a real pipeline injection.

### Signals we extract (focused on the core objective)

- **AI hiring signals**
  - “Are they hiring for AI/ML/LLM roles?”
  - “What are the AI-related role titles?” (when available)
- **Enterprise pricing signals**
  - “Is there an explicit enterprise tier?”
  - “Does the top tier require talking to sales?”
- **AI marketing posture**
  - “Is AI highlighted in the hero section?”
  - “Does the site mention LLMs, agents, copilots?”

These map cleanly to a GTM intent story: product direction + willingness/ability to buy + urgency.

### Tech stack (what’s in this repo today)

- Node.js + TypeScript
- Express server + Vite React UI
- Stagehand v3 with Browserbase sessions
- Gemini model routing through Stagehand (this repo is **Gemini-only**)
- SSE for real-time updates
- HubSpot API for CRM sync

### Roadmap alignment (what’s described vs what’s implemented)

The “signal → pipeline intent engine” concept often describes a serverless setup, CSV ingestion, and generic webhooks.

This repo already has the core extraction + scoring + SSE UX + HubSpot sync. If you want to match the full writeup end-to-end, the next practical steps are:

- Add **CSV upload** (10 domains) and validate/normalize input.
- Add a **webhook sink** (in addition to HubSpot) to simulate “piped into a sales dashboard”.
- Decide on deployment shape:
  - UI on Vercel is easy.
  - Long-running browser sessions + SSE are usually better on a long-lived Node host (Railway/Fly/VM) than serverless.

### Run locally

**Prerequisites**

- Node.js

**Setup**

1. Install dependencies:

   `npm install`

2. Create a `.env` file with:

   - `GEMINI_API_KEY`
   - `BROWSERBASE_API_KEY`
   - `BROWSERBASE_PROJECT_ID`
   - `HUBSPOT_ACCESS_TOKEN` (optional; only needed for sync)

3. Start the app:

   `npm run dev`

Open `http://localhost:3000`.

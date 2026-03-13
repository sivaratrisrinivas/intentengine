## Intent Engine (Signal → Pipeline)

### What this is

Intent Engine takes a list of company domains and produces **GTM-ready intent signals**:

- **AI hiring signals** from the careers/jobs page (including AI/ML/LLM role titles when available)
- **Enterprise pricing signals** from the pricing/plans page (enterprise tier + “contact sales” patterns)
- A deterministic **Intent Score (0–100)** and a short, human-readable summary

Results stream into the UI in real-time and can be piped into HubSpot.

### Why this exists

Sales teams don’t need “scraping.” They need fast, explainable account research that answers:

- “Are they building/buying AI right now?”
- “Do they sell like an enterprise company?”
- “Is this worth an AE’s time today?”

This project is designed to demonstrate a practical Browserbase + Stagehand workflow that turns web signals into pipeline inputs.

### How it works (plain English)

For each domain you enter:

1. A stealth browser session opens the company site.
2. The app reads the homepage to detect **AI marketing posture** (AI in hero, LLM/agent mentions).
3. It navigates to **Careers** and extracts AI/ML/LLM hiring signals.
4. It navigates to **Pricing** and extracts enterprise-tier and sales-contact signals.
5. It combines those signals into a transparent **Intent Score** and streams the results back to the UI.
6. It syncs the enriched result to HubSpot (optional).

### Run locally

**Prerequisites**

- Node.js

**Setup**

1. Install dependencies:

   `npm install`

2. Create a `.env` file (or use your existing one) with:

   - `GEMINI_API_KEY`
   - `BROWSERBASE_API_KEY`
   - `BROWSERBASE_PROJECT_ID`
   - `HUBSPOT_ACCESS_TOKEN` (optional, only needed to sync)

3. Start the app:

   `npm run dev`

Then open `http://localhost:3000`.

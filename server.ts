import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAI() {
  let key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("API key is missing. Please add GEMINI_API_KEY to the Secrets tab.");
  }

  key = key.trim().replace(/^["']|["']$/g, "");

  return new GoogleGenAI({ apiKey: key });
}

type CompanySyncInput = {
  domain: string;
  name?: string;
  is_hiring_ai: boolean;
  pricing_tier: string;
  intent_score: number;
};

async function createHubSpotCompany(input: CompanySyncInput) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing HUBSPOT_ACCESS_TOKEN");
  }

  // Use standard HubSpot properties to avoid "Property doesn't exist" errors
  // We format the custom extracted data into the standard 'description' field
  const descriptionText = `[Intent Engine Extraction]\nAI Hiring: ${input.is_hiring_ai ? 'Yes' : 'No'}\nPricing Tier: ${input.pricing_tier}\nIntent Score: ${input.intent_score}/100`;

  const payload = {
    properties: {
      domain: input.domain,
      ...(input.name ? { name: input.name } : {}),
      description: descriptionText,
    }
  };

  const response = await fetch(
    "https://api.hubapi.com/crm/v3/objects/companies",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const json = await response.json();

  if (!response.ok) {
    // 409 means company already exists, which is fine for our demo purposes
    if (response.status === 409) {
      return json;
    }
    throw new Error(json.message || `HubSpot error: ${response.status}`);
  }

  return json;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const domains = req.query.domains ? (req.query.domains as string).split(",") : [];
    
    if (domains.length === 0) {
      res.write(`data: ${JSON.stringify({ type: "error", message: "No domains provided" })}\n\n`);
      res.end();
      return;
    }

    let isClosed = false;
    req.on("close", () => {
      isClosed = true;
    });

    const sendEvent = (data: any) => {
      if (!isClosed) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    const runSimulation = async () => {
      sendEvent({ type: "status", message: "Initializing pipeline..." });
      await new Promise((r) => setTimeout(r, 1000));
      
      const results: any[] = [];

      const processDomain = async (domain: string) => {
        if (isClosed) return;
        
        const domainErrors: string[] = [];
        let stagehand: any = null;

        // Homepage AI posture signals (also aggregated across retries)
        let hasAIHero = false;
        let mentionsLLMOrAgents = false;
        let aiSectionTitles: string[] = [];
        
        try {
          sendEvent({ type: "progress", domain, status: "connecting" });
          
          let isHiringAI = false;
          let pricingTier = "Unknown";
          let extractedText = "";

          // Aggregated signals used across retries
          let engineeringRoles: string[] = [];
          let aiRoleTitles: string[] = [];
          let numEngineeringRoles = 0;
          let hasEnterpriseTier = false;
          let requiresSalesContact = false;
          let pricingTiers: string[] = [];

          let retryCount = 0;
          let success = false;

          while (!success && retryCount < 3) {
            try {
              // Get the API key securely
              let key = process.env.GEMINI_API_KEY;
              if (!key) throw new Error("Missing Gemini API Key");
              key = key.trim().replace(/^["']|["']$/g, "");

              const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
              const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;
              if (!browserbaseApiKey || !browserbaseProjectId) {
                throw new Error("Missing Browserbase credentials in Secrets");
              }

              stagehand = new Stagehand({
                env: "BROWSERBASE",
                apiKey: browserbaseApiKey,
                projectId: browserbaseProjectId,
                model: {
                  modelName: "google/gemini-2.5-flash",
                  apiKey: key,
                },
              });
              await stagehand.init();

              const page = stagehand.context.activePage() || stagehand.context.pages()[0];
              if (!page) throw new Error("No active page found");
              const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
              
              sendEvent({ type: "progress", domain, status: "extracting" });

              let careersSnippet = "";
              let pricingSnippet = "";
              isHiringAI = false;
              pricingTier = "Unknown";

              // 1. Navigate to Homepage first
              await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeoutMs: 30000 });
              
              const waitForStagehandReady = async (page: any) => {
                try {
                  // 1) Let the shell load
                  await page.waitForLoadState("domcontentloaded");

                  // 2) Try waiting for network to calm down, but don't hard-fail if the app keeps polling
                  await page.waitForLoadState("networkidle", 10000).catch(() => {});

                  // 3) Wait for real page content, not just the top nav
                  const startTime = Date.now();
                  while (Date.now() - startTime < 15000) {
                    const isReady = await page.evaluate(() => {
                      const main = document.querySelector("main") || document.body;
                      if (!main) return false;
                      const text = (main.textContent || "").trim();
                      return text.length > 200;
                    }).catch(() => false);
                    if (isReady) break;
                    await page.waitForTimeout(500);
                  }

                  // 4) Scroll slowly to trigger lazy rendering / intersection observers
                  await page.evaluate(async () => {
                    await new Promise<void>((resolve) => {
                      let total = 0;
                      const step = 700;
                      const timer = setInterval(() => {
                        window.scrollBy(0, step);
                        total += step;

                        const reachedBottom =
                          window.innerHeight + window.scrollY >= document.body.scrollHeight - 5;

                        if (reachedBottom || total > 12000) {
                          clearInterval(timer);
                          resolve();
                        }
                      }, 250);
                    });
                  });

                  // 5) Give React/SPA hydration a moment after scrolling
                  await page.waitForTimeout(1500);

                  // 6) Optional: scroll back up if you want the page in a predictable position
                  await page.evaluate(() => window.scrollTo(0, 0));
                  await page.waitForTimeout(500);
                } catch (e) {
                  console.log("Wait strategy timed out or failed, proceeding anyway...", e);
                }
              };

              // 2. Extract high-level AI posture from the homepage
              try {
                await waitForStagehandReady(page);
                const aiSignals = await stagehand.extract(
                  "From this company's main marketing page, identify their AI posture for a Go-To-Market team.\n\nYou MUST:\n- Return true for hasAIHero if AI or an AI assistant is the focus of a hero section or primary headline\n- Return true for mentionsLLMOrAgents if there are references to LLMs, agents, copilots, or similar advanced AI concepts\n- Collect short titles or headings of any clearly AI-focused sections (e.g. 'AI Platform', 'Revenue AI Copilot').",
                  z.object({
                    hasAIHero: z
                      .boolean()
                      .describe("True if AI is clearly the focus of a hero or primary section"),
                    mentionsLLMOrAgents: z
                      .boolean()
                      .describe("True if the page mentions LLMs, agents, copilots, or similar advanced AI concepts"),
                    aiSectionTitles: z
                      .array(z.string())
                      .describe("Short titles or headings of AI-focused sections"),
                  })
                );
                hasAIHero = aiSignals.hasAIHero ?? false;
                mentionsLLMOrAgents = aiSignals.mentionsLLMOrAgents ?? false;
                aiSectionTitles = aiSignals.aiSectionTitles || [];
              } catch (e: any) {
                console.log(`AI posture extraction failed for ${domain}:`, e.message);
                domainErrors.push(`AI posture extraction failed.`);
              }

              // 3. Extract the URLs for Careers and Pricing
              let careersUrl = `${baseUrl}/careers`;
              let pricingUrl = `${baseUrl}/pricing`;
              
              try {
                await waitForStagehandReady(page);
                const urls = await stagehand.extract(
                  "Find the URLs for the company's Careers/Jobs page and their Pricing/Plans page from the homepage links.",
                  z.object({
                    careersUrl: z.string().nullable().describe("The URL to the careers, jobs, or open roles page"),
                    pricingUrl: z.string().nullable().describe("The URL to the pricing, plans, or enterprise page")
                  })
                );
                
                if (urls.careersUrl) {
                  careersUrl = urls.careersUrl.startsWith('http') ? urls.careersUrl : new URL(urls.careersUrl, baseUrl).toString();
                }
                if (urls.pricingUrl) {
                  pricingUrl = urls.pricingUrl.startsWith('http') ? urls.pricingUrl : new URL(urls.pricingUrl, baseUrl).toString();
                }
              } catch (e: any) {
                console.log(`URL extraction failed for ${domain}, falling back to defaults:`, e.message);
              }

              // 4. Navigate to Careers Page
              try {
                await page.goto(careersUrl, { waitUntil: 'domcontentloaded', timeoutMs: 20000 });
                await waitForStagehandReady(page);
                const careersResult = await stagehand.extract(
                  "From this company's careers/jobs page, extract signals relevant to a Go-To-Market team.\n\nYou MUST:\n- List the titles of all open engineering roles you can see\n- Identify which of those roles are clearly AI/ML/LLM related\n- Decide whether the company is hiring for AI/ML/LLM specialists\n- Count how many engineering roles are visible\n\nBe conservative; if you are not sure a role is AI-related, leave it out of aiRoleTitles.",
                  z.object({
                    isHiringAI: z
                      .boolean()
                      .describe("True if clearly hiring for AI/ML/LLM roles"),
                    engineeringRoles: z
                      .array(z.string())
                      .describe("Titles of all open engineering roles"),
                    aiRoleTitles: z
                      .array(z.string())
                      .describe("Subset of engineeringRoles that are AI/ML/LLM related"),
                    numEngineeringRoles: z
                      .number()
                      .describe("Count of engineering roles visible on the page"),
                  })
                );
                isHiringAI = careersResult.isHiringAI ?? false;
                engineeringRoles = careersResult.engineeringRoles || [];
                aiRoleTitles = careersResult.aiRoleTitles || [];
                numEngineeringRoles = careersResult.numEngineeringRoles ?? engineeringRoles.length;
                const pageText = await page.evaluate(() => document.body.innerText || "");
                careersSnippet = pageText.substring(0, 150).replace(/\s+/g, ' ').trim();
              } catch (e: any) {
                console.log(`Careers extraction failed for ${domain}:`, e.message);
                domainErrors.push(`Careers extraction failed.`);
                if (e.message.includes("429")) throw e;
              }

              // 5. Navigate to Pricing Page
              try {
                await page.goto(pricingUrl, { waitUntil: 'domcontentloaded', timeoutMs: 20000 });
                await waitForStagehandReady(page);
                const pricingResult = await stagehand.extract(
                  "Evaluate this company's pricing/plans page and extract signals that matter to a Go-To-Market team.\n\nYou MUST:\n- Identify the name of the highest tier (e.g., Enterprise, Scale, Custom)\n- List the names of all pricing tiers you can see, in order from lowest to highest\n- Decide whether there is an explicit enterprise tier\n- Decide whether purchasing requires contacting sales (no self-serve for the highest tier).",
                  z.object({
                    pricingTier: z
                      .string()
                      .nullable()
                      .describe("Name of the highest pricing tier, or null if unclear"),
                    tiers: z
                      .array(z.string())
                      .describe("Names of all pricing tiers from lowest to highest"),
                    hasEnterpriseTier: z
                      .boolean()
                      .describe("True if there is an explicit enterprise/custom/highest tier"),
                    requiresSalesContact: z
                      .boolean()
                      .describe("True if highest tier requires contacting sales"),
                  })
                );
                pricingTier = pricingResult.pricingTier ?? "Unknown";
                pricingTiers = pricingResult.tiers || [];
                hasEnterpriseTier = pricingResult.hasEnterpriseTier ?? false;
                requiresSalesContact = pricingResult.requiresSalesContact ?? false;
                const pageText = await page.evaluate(() => document.body.innerText || "");
                pricingSnippet = pageText.substring(0, 150).replace(/\s+/g, ' ').trim();
              } catch (e: any) {
                console.log(`Pricing extraction failed for ${domain}:`, e.message);
                domainErrors.push(`Pricing extraction failed.`);
                if (e.message.includes("429")) throw e;
              }

              extractedText = `Careers: ${careersSnippet ? `"${careersSnippet}..."` : "None"}\nPricing: ${pricingSnippet ? `"${pricingSnippet}..."` : "None"}`;
              success = true;
              
            } catch (e: any) {
               if (stagehand) {
                 try { await stagehand.close(); } catch (err) {}
                 stagehand = null;
               }
               
               if (e.message.includes("429") && retryCount < 2) {
                 retryCount++;
                 const match = e.message.match(/try again in (\d+) seconds/);
                 const waitTime = match ? parseInt(match[1], 10) * 1000 : 60000;
                 console.log(`Rate limited on ${domain}. Waiting ${waitTime}ms before retry ${retryCount}/2...`);
                 await new Promise(r => setTimeout(r, waitTime + 1000));
                 continue; // Retry the loop
               }

               console.error(`Stagehand error for ${domain}:`, e.message);
               if (e.message.includes("API key not valid") || e.message.includes("Missing Gemini API Key")) {
                 domainErrors.push(`Gemini AI: Invalid API Key. Please check your Secrets.`);
               } else if (e.message.includes("Browserbase")) {
                 domainErrors.push(`Browserbase: ${e.message}`);
               } else {
                 domainErrors.push(`Extraction failed: ${e.message}`);
               }
               
               // Use explicit failure states instead of random mock data
               isHiringAI = false;
               pricingTier = "Unknown";
               extractedText = `Extraction failed: ${e.message}`;
               break; // Exit loop on non-retriable error
            } finally {
              if (stagehand && success) {
                try {
                  await stagehand.close();
                } catch (e) {
                  console.error("Error closing stagehand session:", e);
                }
              }
            }
          }

          console.log("DEBUG scoring signals", {
            domain,
            hasEnterpriseTier,
            requiresSalesContact,
            numEngineeringRoles,
            aiRoleTitlesLength: aiRoleTitles.length,
          });

          sendEvent({ type: "progress", domain, status: "scoring" });
          
          // DETERMINISTIC, MULTI-SIGNAL INTENT SCORE (0–100)
          let intentScore = 10; // Base score

          // Pricing / packaging seriousness
          if (hasEnterpriseTier) intentScore += 30;
          if (requiresSalesContact) intentScore += 15;

          // AI posture on marketing + hiring
          if (isHiringAI) intentScore += 20;
          if (aiRoleTitles.length > 0) intentScore += 15;

          // Homepage AI posture
          if (typeof hasAIHero !== "undefined" && hasAIHero) intentScore += 10;
          if (typeof mentionsLLMOrAgents !== "undefined" && mentionsLLMOrAgents) intentScore += 10;

          // Org motion
          if (numEngineeringRoles >= 5 && numEngineeringRoles < 10) intentScore += 5;
          if (numEngineeringRoles >= 10) intentScore += 10;

          intentScore = Math.max(0, Math.min(100, intentScore));

          // Human-readable GTM summary derived from structured signals
          const summaryReasons: string[] = [];
          if (isHiringAI) summaryReasons.push("actively hiring for AI/ML talent");
          if (aiRoleTitles.length > 0)
            summaryReasons.push(`AI-related roles: ${aiRoleTitles.join(", ")}`);
          if (hasEnterpriseTier) summaryReasons.push("offers an enterprise-tier pricing plan");
          if (requiresSalesContact)
            summaryReasons.push("highest tier requires talking to sales");
          if (typeof hasAIHero !== "undefined" && hasAIHero)
            summaryReasons.push("AI is highlighted in the main marketing hero");
          if (typeof mentionsLLMOrAgents !== "undefined" && mentionsLLMOrAgents)
            summaryReasons.push("marketing copy mentions LLMs, copilots, or agents");
          if (numEngineeringRoles >= 10)
            summaryReasons.push(
              `${numEngineeringRoles}+ open engineering roles signal active expansion`
            );

          const shortSummary =
            summaryReasons.length === 0
              ? "Limited explicit AI or enterprise signals detected."
              : `Strong GTM signals: ${summaryReasons.join("; ")}.`;

          const result = {
            domain,
            isHiringAI,
            pricingTier,
            intentScore,
            engineeringRoles,
            aiRoleTitles,
            numEngineeringRoles,
            hasEnterpriseTier,
            requiresSalesContact,
            tiers: pricingTiers,
            summary: shortSummary,
            status: "Complete",
            errors: domainErrors,
            scrapedTextSnippet: extractedText,
            aiRawResponse: JSON.stringify(
              {
                isHiringAI,
                pricingTier,
                intentScore,
                engineeringRoles,
                aiRoleTitles,
                numEngineeringRoles,
                hasEnterpriseTier,
                requiresSalesContact,
                tiers: pricingTiers,
                hasAIHero,
                mentionsLLMOrAgents,
              },
              null,
              2
            )
          };
          
          results.push(result);
          sendEvent({ type: "result", data: result });
          
          sendEvent({ type: "progress", domain, status: "synced" });
          
          try {
            await createHubSpotCompany({
              domain,
              is_hiring_ai: isHiringAI,
              pricing_tier: pricingTier,
              intent_score: intentScore
            });
            sendEvent({ type: "hubspot_sync", domain, success: true });
          } catch (e: any) {
            console.error(`HubSpot error for ${domain}:`, e.message);
            domainErrors.push(`HubSpot failed: ${e.message}`);
            sendEvent({ type: "hubspot_sync", domain, success: false, error: e.message });
          }

        } catch (error: any) {
          console.error(`Error processing ${domain}:`, error);
          sendEvent({ type: "error", message: `Failed to process ${domain}` });
        }
      };

      // Run all domains concurrently
      await Promise.all(domains.map(processDomain));

      sendEvent({ type: "complete", summary: `Processed ${results.length} domains successfully.` });
      res.end();
    };

    runSimulation().catch((err) => {
      console.error("Simulation error:", err);
      sendEvent({ type: "error", message: "Internal server error during simulation" });
      res.end();
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

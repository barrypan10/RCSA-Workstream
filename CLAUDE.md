# RCSA Workstream — Project Context for Claude

This file is auto-loaded by Claude Code at the start of every session. Read it first.

## What this repo is

A static HTML proof-of-concept demo of an **AI-enabled Cyber RCSA workflow**, deployed via GitHub Pages from `/docs`. The demo showcases swimlane orchestration across 1LOD / 2LOD / Monitoring, decision routing, AI worksteps, and human-in-the-loop checkpoints.

Live URL: **https://barrypan10.github.io/RCSA-Workstream/**
Owner: barrypan10

## Source-of-truth precedence (IMPORTANT)

The demo's behavior is driven by two markdown documents in `source/`. They are **not equivalent** — there is a strict precedence:

1. **[source/cyber_rcsa_process_flow.md](source/cyber_rcsa_process_flow.md)** — canonical workflow specification. Defines steps, decisions, YES/NO routing, loop-backs, and where AI augments the process. **Any change to step order, branching logic, or human checkpoints must update this file first**, then propagate to `docs/assets/workflow.js`.
2. **[source/Cyber_RCSA_AI_Enabled_Workflow_Operating_Model.md](source/Cyber_RCSA_AI_Enabled_Workflow_Operating_Model.md)** — supporting business / governance context. Use it to enrich labels, AI output narrative, and operating-model accuracy. **Never use it to override routing.**

If File 1 and File 2 ever conflict on routing or process behavior, File 1 wins.

## Current state of the demo

`docs/` is the deployed site. Key files:

| File | Purpose |
|---|---|
| `docs/index.html` | Page shell with topbar, tab nav, swimlane canvas, detail panel, audit trail |
| `docs/assets/workflow.js` | Canonical workflow data: lanes, stages, steps, edges. Mirrors File 1. |
| `docs/assets/app.js` | Render engine, simulation logic, AI animation, tab switching, Step Detail view, Findings Report, Demo Mode runner with TTS voiceover and red spotlight |
| `docs/assets/styles.css` | Enterprise GRC light theme (Capgemini blue, AI=purple, Human=blue, Decision=amber, Spotlight=red) |
| `docs/assets/capgemini-spade.png` | Brand mark in topbar |
| `docs/.nojekyll` | Bypasses Jekyll so `assets/` ships as-is |
| `docs/DEMO_SCRIPT.md` | 90-second recording guide with cue-by-cue script |

## Realistic enterprise role titles (locked set)

Used at every human checkpoint in `workflow.js`. Reuse consistently when adding steps:

| Step | Role |
|---|---|
| Trigger Event | Cyber RCSA Lead, 1LOD |
| Step 1 — Define Scope | Application Owner, 1LOD |
| Step 2 — Identify Risks | Cyber RCSA Lead, 1LOD |
| Step 3 — Assess Risk | Cyber RCSA Lead, 1LOD |
| Step 4 — Evaluate Controls | Control Owner — IAM Lead, 1LOD |
| Step 5 — Control Test | Control Owner — IAM Lead, 1LOD |
| Step 6 — Identify Gaps | Cyber RCSA Lead, 1LOD |
| Step 7 — Remediation Plan | Remediation Owners (1LOD) · approval by Cyber RCSA Lead |
| Step 8 — Residual Risk | Application Owner + Cyber RCSA Lead, 1LOD |
| Step 9 — Submit RCSA | Cyber RCSA Lead, 1LOD |
| Step 10 — 2LOD Check & Challenge | Cyber Risk Officer, 2LOD (runs **two AI reviews**: internal challenge + peer comparison) |
| Step 11 — Approve / Validate | Head of Cyber Risk Governance, 2LOD |
| Step 12 — Monitoring & Review | Cyber RCSA Lead, 1LOD (with Continuous Monitoring Team) |

Named individuals used in mock comments / Findings Report: M. Chen (Cyber RCSA Lead), L. Ortega (Application Owner), P. Singh (IAM Lead), D. Park (Logging Eng Lead), A. Khan (PKI Eng Lead), R. Diaz (GRC Eng Lead), V. Romano (Cyber Risk Officer 2LOD), S. Beauchamp (Head of Cyber Risk Governance 2LOD).

## Version history

- **v1** — initial swimlane workflow with click-through simulation, AI animations, audit trail
- **v2** — Capgemini logo, two top-level tabs (Workflow Map / Step Detail), GRC-style step detail view (controls, attachments, comments, next-steps routing), Findings Report on Step 11 approve, realistic role titles, stage bands, larger nodes, all three Step 10 issue-route edges
- **v3** — Demo Mode (~88-second auto-walkthrough), Web Speech API voiceover with toggle, red pulsing spotlight on highlighted steps, dedicated horizontal channels for each loop-back edge
- **v4** — AI footprint reduced to 2 targeted checkpoints (Step 2 Identify Risks, Step 10 2LOD Check & Challenge). Trigger, Step 5, Step 6, Step 7, Step 9, Step 12 reverted to standard process / decision nodes — no `aiActions` / `aiOutput`, no purple AI styling. Demo Mode trimmed to ~62s with 2 spotlights instead of 7. Story reframed as "AI where it counts" rather than "AI everywhere." Routing, edges, role titles, loop-backs all unchanged.
- **v5** — Singular RCSA Prerequisites Pack ingested at cycle start. Real `.xlsx` lives at `docs/samples/RCSA-Prerequisites-Pack-PAYMENTS-CORE-2026Q2.xlsx` with 5 tabs (Risk & Control Inventory · Asset & Ownership Inventory · Prior RCSA & Open Issues · Policies & Regulatory Requirements · Evidence & Monitoring Data). Page load shows a modal that blocks the swimlane until the user drags the file, browses for it, or clicks "Use sample pack". 5 sections animate ✓ over ~3s, modal dismisses, persistent topbar chip appears. Trigger node attachment is now the same single .xlsx (downloadable). Step 2 AI lead-text refreshed to anchor on the pack. Demo Mode runtime ~62s → ~68s. Builder script: [scripts/build-prereq-pack.py](scripts/build-prereq-pack.py) (`py -m pip install openpyxl` then `py scripts/build-prereq-pack.py`).
- **v6** — **Live AI** at Step 2 + Step 10 (Anthropic Claude Haiku 4.5, browser-direct fetch, `sessionStorage`-backed key). New `docs/assets/ai-client.js` exposes `window.AIClient.callClaude({system, messages, maxTokens, cacheSystem, jsonSchema})` with prompt caching, structured output (`output_config.format`), and typed errors. New `⚙ API` topbar button opens a settings panel where viewers paste their own `sk-ant-...` key. Step 2 system prompt is `cache_control: ephemeral` so Step 10's call reads it from cache (≈90% input-token reduction within ~5 min). `state.prereq.context` carries the JSON pack used as grounding context for both runners. New `✨ Generate with AI` button in the prereq modal calls Claude to fabricate a realistic 5-section pack from `app + domain` seed (gated on key). Failure paths (auth/rate/network/parse) all toast + fall back to static `aiOutput`. Static `PREREQ_CONTEXT` mirrors the bundled .xlsx and is exposed on `window.__RCSA__.PREREQ_CONTEXT`. Public GitHub Pages site without a key behaves identically to v5.
- **v9** — **Org LLM gateway swap.** Replaced the Anthropic-direct live-AI path with an **OpenAI-compatible chat-completions** client. `docs/assets/ai-client.js` rewritten: no hardcoded provider, no `cache_control`, talks to `{baseUrl}/v1/chat/completions` with `Authorization: Bearer <key>`. Three sessionStorage keys (`rcsa.llm_base_url`, `rcsa.llm_api_key`, `rcsa.llm_model`) configured via the expanded ⚙ API panel. `window.AIClient.callClaude` keeps its legacy `{system, messages, maxTokens, cacheSystem, jsonSchema}` signature for back-compat — `cacheSystem` is silently ignored, `jsonSchema` becomes `response_format: {type: 'json_object'}`. Live attribution now reads the model name from the gateway response (`result.model`) and tags it onto the parsed output as `_model` so the AI cards show "Powered by &lt;actual-model&gt;" — gateway-honest. CORS-aware `NetworkError`: if `fetch()` throws (no HTTP status), the error message tells the user it's most likely a CORS block needing an origin allowlist on the gateway. Fallback to static memo on any failure unchanged. Default model `gpt-4o-mini` only when both gateway and user leave the model field blank. No personal Anthropic key needed anywhere. **v9.1 polish:** the ⚙ API panel now has a three-state status chip (Live / Partial config — needs &lt;missing piece&gt; / Static) and a **Test connection** button that fires a 4-token round-trip against the configured URL+key, surfacing typed errors (auth / rate / network / parse / api) in a result line so users can validate gateway settings before walking the workflow. Save validation now distinguishes "key only" vs "URL only" with actionable copy.

**v9.2 polish:** live AI requires running the demo via `py scripts/serve.py` (serves `docs/` at `http://localhost:8000/`). Browsers block CORS for `file://` origins before any request leaves the tab, so double-clicking `index.html` makes live AI impossible regardless of gateway settings. The ⚙ API modal now shows a yellow `file://` warning banner when loaded that way, pointing users at `scripts/serve.py`. The static demo (Demo Mode, Auto-Pilot, click-throughs) still works fine when double-clicked.

**v9.3:** added `scripts/proxy.py` — a Python-stdlib forwarding proxy on `localhost:8787` for enterprise gateways that refuse browser-direct CORS (the common case for the Capgemini Generative Engine). Browser → `localhost:8787` → `https://openai.generative.engine.capgemini.com`. Key lives in `CAPGEMINI_KEY` env var (never in browser, never in git). In the ⚙ API panel: Base URL becomes `http://localhost:8787`, API key is any non-empty placeholder (the proxy injects the real Bearer token upstream), Model is whatever the gateway exposes. Two-terminal setup: `py scripts/serve.py` in one, `py scripts/proxy.py` in another. Env var overrides: `CAPGEMINI_BASE_URL` (tenant), `RCSA_PROXY_PORT` (port), `RCSA_ALLOW_ORIGIN` (CORS origin).

**Canonical Capgemini Generative Engine endpoint:** `https://openai.generative.engine.capgemini.com` — note the `openai.` subdomain. NOT `api.generative.engine.capgemini.com`.

**v9.3 does not let you skip v9.2.** `serve.py` (localhost:8000) is still required for live AI. The proxy fixes the gateway side (CORS); the local server fixes the browser side (`file://` origin handling). Both are needed together.

- **v8** — **Auto-Pilot — one-click end-to-end RCSA cycle.** New 🤖 Auto-Pilot button in the topbar runs the full happy path hands-free: auto-ingests the sample Prerequisites Pack, walks every step (including the Step 5 → 7 → 5 retest loop), waits for live AI to complete at Step 2 + Step 10 ×2 before advancing, picks a deterministic default action at every human checkpoint via `pickAutoAction(step)`, and lands on the Findings Report. New `state.autoPilot { running, startedAt, completedSteps }` slot. New helpers `runAutoPilot` / `stopAutoPilot` / `waitForAiCompletion` / `pickAutoAction`. Sticky purple banner shows progress with a Stop button. Manual override: clicking any human-checkpoint button while Auto-Pilot is running stops the pilot and lets the user's choice stand. Decision trail attribution: `[Auto-Pilot · <role>] → <action> (auto-decided)`. Distinct from Demo Mode — Auto-Pilot is for live execution; Demo Mode is for narrated recording. Both coexist; resetting cancels either.
- **v7** — **Step 10 split into two AI reviews.** New `step.aiReviews: [...]` data shape on `step10` carries Review 1 (Internal Challenge — challenge submission in isolation) and Review 2 (Peer Comparison — compare against `PEER_SUBMISSIONS` corpus of 4 peer apps). Renderer iterates per review with stacked AI cards, sequential runs (so Review 2 hits Review 1's `cache_control: ephemeral` cache), per-review attribution (`state.aiReviewSources[step.id][reviewId]`), per-review regen button. Live AI: `STEP10_SYSTEM` split into `STEP10_ISOLATION_SYSTEM` + `STEP10_PEER_SYSTEM`; new `runLiveAiReview(step, review)` dispatches by review id. Tab 2 Step 10 detail gains a "Peer comparison corpus" card listing the 4 peers with their notable callouts. Findings Report Section 9 splits into 9.1 Internal Challenge and 9.2 Peer Comparison plus a peer-corpus summary table. Demo Mode Step 10 highlight splits into 2a + 2b (7.5s each, both spotlight `node:step10`); total runtime ~68s → ~72s. `PEER_SUBMISSIONS` exposed on `window.__RCSA__`. Backward compatible — single-review steps (step2) untouched.

Tags: `v1`, `v2`, `v3`, `v4`, `v5`, `v6`, `v7`, `v8`, `v9` (annotated on GitHub once cut).

**Note:** `docs/samples/` ships three posture-variant `.xlsx` files (CLEAN / MIXED / CRITICAL) in addition to the legacy single pack — drag any of them into the prereq modal for visible data variety. The demo's static AI memos do not differ per file (no scenario-aware overrides in code); live AI calls grounded in the imported pack will produce different output naturally because the input JSON differs.

## Feedback loops (loop-back routing)

The workflow is not strictly linear — it contains six explicit feedback loops that any change to routing must preserve. Each is encoded in `EDGES` in `workflow.js` with `type: 'loopback'` and is rendered in its own dedicated horizontal channel below the swimlanes (vertically separated by 24px so labels don't collide).

| # | From → To | Trigger condition | Why the loop exists |
|---|---|---|---|
| 1 | Step 5 → Step 6 (NO branch) | Control test fails (or evidence weak) | Failed controls become gaps that must be remediated before approval |
| 2 | Step 7 → Step 5 (YES retest) | Remediation owner marks fix implemented | Re-verify the control is now operating effectively |
| 3 | Step 7 → Step 7 (NO stay) | Fix not yet implemented | Remediation continues until done or formally escalated |
| 4 | Step 8 → Step 6 (NO acceptable) | Residual risk above tolerance | Need to identify additional gaps / remediation |
| 5 | Step 10 → Step 7 / 8 / 9 (issues found) | 2LOD challenge surfaces problem | Routes back to the *most relevant* upstream step depending on issue type (remediation, residual rationale, or submission quality) |
| 6 | Step 12 → Trigger (new cycle) | Continuous monitoring breaches threshold | Restart the RCSA cycle; AI re-runs triage in the new context |

Self-stay edges (Step 7 → Step 7, Step 12 → Step 12) are not drawn — they're recorded only in the audit trail.

The simulation engine clears the AI memo for any step on entry (`delete state.aiResults[targetId]` in `advanceTo()`), so revisiting a step on a loop-back triggers a fresh AI run rather than a cached one.

## Code structure

Pure static HTML + CSS + vanilla JS. No build step, no dependencies, no framework. All runtime work happens in the browser.

```
docs/
├─ index.html                 Page shell only — never holds workflow data
├─ .nojekyll                  Empty file; tells GitHub Pages to skip Jekyll
└─ assets/
   ├─ workflow.js             Pure data: LANES, STAGES, STEPS, EDGES (canonical, mirrors File 1)
   ├─ app.js                  Everything dynamic (one IIFE, ~700 lines)
   │  ├─ Geometry layer       COL_W, LANE_H, NODE_W/H, loop-channel math
   │  ├─ State                { currentStepId, selectedStepId, activeTab, history,
   │  │                         visited, traversedEdges, decisions, userComments,
   │  │                         terminated, approved, aiResults }
   │  ├─ Build (one-time)     buildSwimlanes() → stage bands → lanes → SVG edges → nodes
   │  ├─ Render (per state)   updateNodeStates / updateEdgeStates / renderActionPanel /
   │  │                         renderStepDetail / renderFindingsReport / renderAudit
   │  ├─ Mutators             handleHumanAction / advanceTo / runAi / logAudit
   │  ├─ Tab 2 (GRC view)     detailDescriptionCard / WorkItems / NextSteps /
   │  │                         AttachmentsCard / CommentsCard
   │  ├─ Tab 3 (report)       renderFindingsReport / tableFromWorkItems / decisionsTable
   │  └─ Demo Mode            DEMO_SCRIPT[] + runDemoSequence + speakNarration +
   │                            applySpotlight + tickProgress
   ├─ styles.css              Light enterprise GRC theme. Critical color tokens at top.
   └─ capgemini-spade.png     Topbar brand mark (32×32)
```

**Data flow:** `workflow.js` exposes the spec on `window.__RCSA__`. `app.js` reads it once, builds the DOM, and from then on every UI update is a render function reading from `state` and writing to specific DOM elements. There's no virtual DOM — render functions just `innerHTML` their slot.

**Single source of truth:** the workflow shape (steps, edges, stages, AI outputs, role titles, work items, attachments, comments, due dates) all lives in `workflow.js`. `app.js` is presentation only — it never hardcodes step IDs or labels (except the `DEMO_SCRIPT` sequence which references step IDs deliberately for the auto-walkthrough).

**Adding a new step** touches three things in `workflow.js`: append to `STEPS`, add forward + any loop-back entries to `EDGES`, and update the relevant `STAGES` column range. No `app.js` changes needed unless the step has unusual rendering needs.

## Git structure

| | |
|---|---|
| Default branch | `main` |
| GitHub Pages source | `main` branch, `/docs` folder (configured in repo Settings → Pages) |
| Live URL | https://barrypan10.github.io/RCSA-Workstream/ |
| Tag scheme | `v1`, `v2`, `v3`, … — annotated tags marking demo milestones, not formal SemVer |
| Branching | None today. All work has been on `main`. Cut a feature branch for experimental work that shouldn't go live immediately. |
| Pages deploy trigger | Any push to `main` that touches `/docs` → GitHub Pages rebuilds in ~30–60s. No GitHub Actions workflow; Pages does it natively. |

**Commit conventions:**
- Multi-line messages with bullets describing what shipped + why
- **Always pass via `git commit -F .commit-msg-tmp.txt`** (write the message to a temp file first, then delete after commit) — PowerShell mangles inline `-m @'...'@` here-strings that contain `<` / `>` characters, including the `Co-Authored-By: ... <noreply@anthropic.com>` trailer
- Trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` only when Claude wrote substantive code
- One commit per cohesive change; tag at milestone boundaries

**Tagging a milestone:**
```
git tag -a v4 -m "v4 - <one-line summary>"
git push origin v4
```

**Restoring an older state:**
- Browse a tag without changing your working tree: `git checkout v2` (read-only; `git checkout main` to come back)
- Reset working tree to a tag (destructive): `git reset --hard v2` — only with explicit user permission
- Cherry-pick a single change from a tag: `git cherry-pick <commit-from-tag>`

## Important things NOT in this repo (and why)

- **`docs/source/` is intentionally absent.** Source markdowns live in `source/` (top level), not under `docs/`, so they aren't deployed to the public Pages URL.
- **Real LLM calls.** All AI outputs in the demo are static, hand-authored content in `workflow.js`. The "AI thinking" spinner is a 1.2s timeout, not a real model call. This is intentional for an offline executive demo. To make AI live, see "Path to live AI" below.
- **Persistent state.** The demo doesn't use localStorage. Every page load is a fresh walkthrough.

## Path to live AI

1. **✅ Browser → OpenAI-compatible LLM gateway (implemented in v9; replaces v6 Anthropic-direct)** — `docs/assets/ai-client.js` calls `{baseUrl}/v1/chat/completions` with `Authorization: Bearer <key>`. Each viewer configures their own gateway URL + key (and optional model) via the topbar `⚙ API` panel; all three live in `sessionStorage` only. Anthropic-specific prompt caching is gone (not portable across gateways). CORS posture depends on the gateway — if the gateway is corporate-only, the public Pages site falls back to static memos with a clear toast.
2. **Cloudflare Worker / Vercel function proxy** — would keep credentials server-side, hide the gateway URL from page source, and bypass any CORS limits on the org gateway. Page stays static-hosted. Few hours of work.
3. **Real product** — backend, retrieval over CMDB / ServiceNow / Splunk, prompt engineering, audit logging, RBAC. Months.

## Working conventions

- The user prefers **terse, action-oriented responses** with clear option choices via the AskUserQuestion tool.
- The user works in **VS Code on Windows 11**. Default shell is PowerShell. Avoid Bash-only constructs when running commands.
- For commit messages, **always pass via `git commit -F <file>`** rather than inline `-m @'...'@` here-strings — PowerShell mangles multi-line here-strings with `<` / `>` characters in them.
- The user is `barrypan10` on GitHub. Default branch is `main`. GitHub Pages serves from `main /docs`.
- Don't commit unless explicitly asked. The user will say "commit and push" / "save progress" / "ship it".
- When the user wants live AI (org LLM gateway), remind them to run via `py scripts/serve.py` before opening the demo. The static demo works double-clicked, but browsers block CORS from `file://` origins so live AI calls fail before reaching the gateway.
- The demo has **two independent run modes** — choose the right one when describing or proposing changes:
  - **Demo Mode (`▶ Demo Mode`)** — fixed cinematic script (`DEMO_SCRIPT` array in `app.js`), narrated voiceover, big AI HIGHLIGHT banners, red spotlight, manual interactions disabled. Built for recording videos.
  - **Auto-Pilot (`🤖 Auto-Pilot`)** — live end-to-end execution. Reuses `runAi` / `advanceTo`, picks deterministic happy-path defaults via `pickAutoAction`, waits on real AI completion via `waitForAiCompletion`, lets the user override at any time. Built for "show the platform actually doing the work" demos. Auto-ingests the sample Prerequisites Pack on start.

## Common next-step requests

- "v4 ideas" — propose enhancements (live AI, multi-cycle dashboard, persistence, mobile, more roles, integration mocks)
- "fix the timing on highlight N" — `DEMO_SCRIPT` array in `app.js` controls demo timing per step
- "change role X to Y" — update both this file's table AND `workflow.js` `humanCheckpoint.actor` for the affected step(s)
- "add a step / remove a step" — touches `STEPS` and `EDGES` in `workflow.js`, the stage band ranges in `STAGES`, and possibly the report sections in `renderFindingsReport()` in `app.js`

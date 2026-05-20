# RCSA Workstream — Cyber RCSA Demo

Interactive proof-of-concept demo of an **AI-enabled Cyber RCSA workflow**. Showcases swimlane orchestration across System / 1LOD / 2LOD / Monitoring, decision routing (YES/NO), human-in-the-loop checkpoints, and AI worksteps at the points where AI augments the process (trigger triage, risk identification, gap drafting, remediation planning, pre-submission QC, 2LOD challenge, and continuous-monitoring anomaly detection).

Live URL once Pages is enabled: **https://barrypan10.github.io/RCSA-Workstream/**

## What's in the demo

- **Swimlane workflow canvas** — 13 nodes (Trigger + Steps 1–12) laid out across 4 lanes, with forward and loop-back edges.
- **Live simulation** — clicking the human-checkpoint actions advances the workflow per the routing in `cyber_rcsa_process_flow.md`. Loop-backs (Step 5 ↔ 6/7, Step 8 → 6, Step 12 → Trigger) are wired.
- **AI worksteps** — at AI-augmented steps a "thinking" animation plays, then a pre-canned, plausible AI output appears (with a regenerate button). AI never approves or rejects — every material decision routes through a human action.
- **Audit trail** — every transition, AI output, and human decision is timestamped at the bottom of the page.

## Local preview

No build step. Open `docs/index.html` directly in a browser:

```powershell
Start-Process .\docs\index.html
```

(Or just double-click the file.) All assets are referenced relatively — no server required.

## Running locally with live AI

> **Always launch the demo through `py scripts/serve.py`** when you want live AI. Double-clicking `index.html` works only for the static demo (Demo Mode, Auto-Pilot, click-throughs). The proxy in `scripts/proxy.py` does **not** let you bypass `serve.py` — it solves a different problem (the gateway's CORS posture), not the browser's `file://` origin handling.

The static demo (Demo Mode, Auto-Pilot, all the click-throughs) works fine when you double-click `docs/index.html`. **Live AI calls don't** — browsers block any cross-origin fetch from a `file://` origin before the request ever reaches your gateway, including your org's LLM gateway.

To use Live AI, run the demo through a local web server:

```powershell
py scripts/serve.py
```

That serves `docs/` at `http://localhost:8000/` and opens your default browser. The browser origin is now a real URL, so the gateway's CORS policy gets a chance to actually allow or reject the request. Stop with Ctrl+C.

If port 8000 is in use:

```powershell
$env:RCSA_DEMO_PORT='8765'; py scripts/serve.py
```

If the gateway still rejects `localhost` (you'll see a CORS-aware error in the ⚙ API panel's Test result), use the local proxy below — most enterprise gateways including the Capgemini Generative Engine require this.

### If the gateway rejects browser-direct calls (the common case)

Run a tiny local proxy in a **second** terminal. The proxy forwards browser → Capgemini gateway with your key kept in your shell environment — never in the browser, never in this repo, never in chat.

```powershell
# Terminal 2 — start the proxy
$env:CAPGEMINI_KEY='paste-your-real-gateway-key-here'
py scripts/proxy.py
```

Expected log:

```
TPRM/RCSA proxy listening on http://localhost:8787
Forwarding to https://openai.generative.engine.capgemini.com
Allowing CORS origin: http://localhost:8000
Key loaded from CAPGEMINI_KEY (NN chars).
```

Now in the demo's **⚙ API** panel set:

| Field | Value |
|---|---|
| Gateway base URL | `http://localhost:8787` |
| API key | `local-proxy` (placeholder — proxy ignores it) |
| Model | leave blank, or e.g. `gpt-4o-mini` if your gateway exposes a specific model |

Click **Test connection** → expect a green check. Click **Save**. Walk to Step 2 and Step 10 to see live AI fire. Stop the proxy with Ctrl+C in Terminal 2 when done.

Tenant override: if your gateway lives at a different subdomain, set `$env:CAPGEMINI_BASE_URL='https://your-tenant.example.com'` before launching the proxy. Port override: `$env:RCSA_PROXY_PORT='8788'`.

## Deploy via GitHub Pages

1. Commit and push the `docs/` folder to `main`.
2. In **GitHub → Settings → Pages**, set **Source** to `Deploy from a branch`, **Branch** = `main`, **Folder** = `/docs`. Save.
3. Wait ~30–60 seconds. The site goes live at `https://barrypan10.github.io/RCSA-Workstream/`.

`docs/.nojekyll` is included so GitHub Pages serves the `assets/` folder as-is without Jekyll processing.

## Project structure

```
docs/
  index.html              Page shell
  assets/
    workflow.js           Canonical workflow definition (mirrors cyber_rcsa_process_flow.md)
    app.js                Simulation engine, rendering, AI animation, audit trail
    styles.css            Enterprise GRC light theme
  .nojekyll
README.md                 (this file)
```

## Source documents

The demo is driven by two markdown source documents (kept outside `/docs/` so they stay in repo history rather than the published site):

- `cyber_rcsa_process_flow.md` — **canonical** workflow specification (states, decisions, routing). The demo's behavior conforms to this file.
- `Cyber_RCSA_AI_Enabled_Workflow_Operating_Model.md` — supporting business/governance context that informs labels and pre-canned AI outputs.

If these documents are updated, the canonical-source file is the one whose changes must be reflected in `docs/assets/workflow.js`.

## What this demo is *not*

- It is not connected to a real LLM — AI outputs are pre-canned for narrative credibility.
- It does not persist session state across reloads — every load is a fresh walkthrough.
- It is desktop-first (degrades acceptably below ~1280px).

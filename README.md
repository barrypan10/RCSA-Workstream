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

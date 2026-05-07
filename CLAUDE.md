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
| Step 10 — 2LOD Check & Challenge | Cyber Risk Officer, 2LOD |
| Step 11 — Approve / Validate | Head of Cyber Risk Governance, 2LOD |
| Step 12 — Monitoring & Review | Cyber RCSA Lead, 1LOD (with Continuous Monitoring Team) |

Named individuals used in mock comments / Findings Report: M. Chen (Cyber RCSA Lead), L. Ortega (Application Owner), P. Singh (IAM Lead), D. Park (Logging Eng Lead), A. Khan (PKI Eng Lead), R. Diaz (GRC Eng Lead), V. Romano (Cyber Risk Officer 2LOD), S. Beauchamp (Head of Cyber Risk Governance 2LOD).

## Version history

- **v1** — initial swimlane workflow with click-through simulation, AI animations, audit trail
- **v2** — Capgemini logo, two top-level tabs (Workflow Map / Step Detail), GRC-style step detail view (controls, attachments, comments, next-steps routing), Findings Report on Step 11 approve, realistic role titles, stage bands, larger nodes, all three Step 10 issue-route edges
- **v3** — Demo Mode (~88-second auto-walkthrough), Web Speech API voiceover with toggle, red pulsing spotlight on highlighted steps, dedicated horizontal channels for each loop-back edge

Tags: `v1`, `v2`, `v3` (annotated, on GitHub).

## Important things NOT in this repo (and why)

- **`docs/source/` is intentionally absent.** Source markdowns live in `source/` (top level), not under `docs/`, so they aren't deployed to the public Pages URL.
- **Real LLM calls.** All AI outputs in the demo are static, hand-authored content in `workflow.js`. The "AI thinking" spinner is a 1.2s timeout, not a real model call. This is intentional for an offline executive demo. To make AI live, see "Path to live AI" below.
- **Persistent state.** The demo doesn't use localStorage. Every page load is a fresh walkthrough.

## Path to live AI (when the user asks)

Three options in increasing order of effort:
1. **Browser-side Claude API call** — `fetch` from `app.js` to `api.anthropic.com` with the API key in JS source. Works for single-user / authenticated demos only. Quick win, but key is exposed.
2. **Cloudflare Worker / Vercel function proxy** — keeps key server-side, page stays static-hosted. ~few hours.
3. **Real product** — backend, retrieval over CMDB / ServiceNow / Splunk, prompt engineering, audit logging, RBAC. Months.

## Working conventions

- The user prefers **terse, action-oriented responses** with clear option choices via the AskUserQuestion tool.
- The user works in **VS Code on Windows 11**. Default shell is PowerShell. Avoid Bash-only constructs when running commands.
- For commit messages, **always pass via `git commit -F <file>`** rather than inline `-m @'...'@` here-strings — PowerShell mangles multi-line here-strings with `<` / `>` characters in them.
- The user is `barrypan10` on GitHub. Default branch is `main`. GitHub Pages serves from `main /docs`.
- Don't commit unless explicitly asked. The user will say "commit and push" / "save progress" / "ship it".

## Common next-step requests

- "v4 ideas" — propose enhancements (live AI, multi-cycle dashboard, persistence, mobile, more roles, integration mocks)
- "fix the timing on highlight N" — `DEMO_SCRIPT` array in `app.js` controls demo timing per step
- "change role X to Y" — update both this file's table AND `workflow.js` `humanCheckpoint.actor` for the affected step(s)
- "add a step / remove a step" — touches `STEPS` and `EDGES` in `workflow.js`, the stage band ranges in `STAGES`, and possibly the report sections in `renderFindingsReport()` in `app.js`

# Cyber RCSA Demo — Recording Guide

The demo has **built-in voiceover** (browser Text-to-Speech) and a **red spotlight box** that highlights the exact step being called out. You can record it as-is — no separate narration needed.

**v4 update:** AI footprint is now **2 targeted checkpoints** — Step 2 (Identify Risks) and Step 10 (2LOD Check & Challenge) — instead of seven scattered ones. The story is "AI where it counts, not AI everywhere."

**v5 update:** The demo opens with a **Prerequisites Pack upload moment**. Page load shows a modal blocking the swimlane until the user inserts `RCSA-Prerequisites-Pack-PAYMENTS-CORE-2026Q2.xlsx` (drag, browse, or "Use sample pack"). Five sections animate ✓ over ~3 s, modal dismisses, topbar chip appears, swimlane unlocks. The same .xlsx is the singular Trigger attachment downstream.

**v6 update:** Optional **Live AI mode** — paste credentials into the topbar `⚙ API` panel and the AI checkpoints at Step 2 and Step 10 call your LLM gateway directly (browser-side; settings stay in `sessionStorage`). The "Generate with AI" button in the prereq modal also fabricates a fresh pack from a seed. Without a key the demo behaves identically to v5. *(v9 update: this used to call Anthropic directly with a personal key. It now calls your organization's OpenAI-compatible gateway — see v9 below.)*

**v7 update:** Step 10 now runs **two sequential AI reviews** — Review 1 challenges the submission in isolation; Review 2 compares it against a static corpus of 4 peer team RCSAs (LENDING-CORE, FRAUD-CORE, MOBILE-AUTH, TREASURY-OPS) visible on the Step 10 detail tab. AI footprint is still two checkpoints (Step 2 + Step 10) but Step 10 is now two passes. The Findings Report splits the 2LOD section into 9.1 Internal Challenge and 9.2 Peer Comparison, with the peer corpus listed.

**v9 update:** Live AI now calls an **organization-issued OpenAI-compatible gateway** instead of Anthropic directly. The ⚙ API panel takes three fields: **Gateway base URL**, **API key**, and an optional **Model** name (blank = the gateway's default; falls back to `gpt-4o-mini` if both are blank). The AI memo card now shows the actual model the gateway returned — no more hardcoded "Claude Haiku 4.5" branding. If the gateway is corporate-network-only, the demo surfaces a CORS-aware toast and falls back to static memos cleanly.

**v8 update:** New 🤖 **Auto-Pilot** button in the topbar. **This page focuses on Demo Mode (recording).** For live "show the platform doing the work" demos — auto-ingest the prereq pack, walk every step, wait for real AI, land on the Findings Report — use Auto-Pilot instead. Auto-Pilot is not narrated and has no fixed timing; it follows actual AI completion and uses a soft purple banner with a Stop button. Manual clicks during Auto-Pilot stop the run.

## Quickest path to a finished video

1. Open the demo (local or live URL) in **Chrome or Edge** — they have the best built-in voices on Windows.
2. Make sure **🔊 Voiceover** in the topbar is checked. Uncheck it if you want to record your own voice instead.
3. Start screen recording: Loom, OBS, or **Win + G** (Xbox Game Bar) on Windows / **Cmd+Shift+5** on Mac.
4. Click **▶ Demo Mode**.
5. The demo auto-advances, narrates each step, and draws a red box around whatever is being highlighted.
6. Stop recording when the closing caption fades (~72 seconds).

## What viewers will see and hear

| Time  | On-screen                                          | Voiceover (TTS)                                                                                                                                                                              |
|-------|----------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0:00  | **Prerequisites Pack modal** + 5 sections ✓ animation | "It starts with one file — the RCSA Prerequisites Pack. Risks, assets, prior cycles, policies, evidence — all consolidated. The user inserts it, and the cycle begins."                  |
| 0:07  | Title caption                                      | "From here, AI is used in exactly two places — where it does heavy synthesis a human cannot do at speed. Everything else stays human-driven."                                                |
| 0:17  | **AI HIGHLIGHT 1/2** + red box on Step 2          | "First AI checkpoint — Identify Risks. AI mines prior cycles, audits, and incidents to surface six candidate risks, including two the team would have missed. The Cyber RCSA Lead validates each before it enters the register." |
| 0:31  | **AI HIGHLIGHT 2a/2** + red box on Step 10        | "Second AI checkpoint, review one — AI challenges the submission in isolation, surfacing weak justifications and unexplained rating changes within this RCSA."                              |
| 0:39  | **AI HIGHLIGHT 2b/2** + red box on Step 10        | "Review two — AI compares the submission against four peer team RCSAs and flags cross-team inconsistencies the reviewer needs to reconcile."                                                |
| 0:48  | Switch to Findings Report tab + red box on stamp  | "The platform auto-generates the Findings Report — every AI suggestion and every human decision attributed by role."                                                                         |
| 1:02  | Closing caption                                    | "AI accelerates the two steps where synthesis is the bottleneck. Humans hold every material decision. Every step, fully auditable."                                                          |

Total runtime: **~72 seconds**.

> **Recording note:** if you're capturing the cold-start moment, start your screen recording *before* clicking ▶ Demo Mode — the upload animation plays in the first ~6 s and is the strongest opening visual.

## Live AI mode (optional)

By default, the AI memos at Step 2 and Step 10 are static demo content. To switch them to real LLM calls grounded in the prereq pack, point the demo at your organization's OpenAI-compatible LLM gateway:

1. Click **⚙ API** in the topbar.
2. Fill in:
   - **Gateway base URL** — e.g. `https://gateway.your-org.com` (the demo appends `/v1/chat/completions`).
   - **API key** — Bearer token from your gateway.
   - **Model** *(optional)* — leave blank to use the gateway default, or name a specific model like `gpt-4o-mini`, `claude-3-5-sonnet`, etc.
3. Click **Save (this session only)**. The status flips to `● Live AI enabled · <model>`.

What changes:
- Step 2 and Step 10 take ~3 s instead of popping instantly. The memo text is genuinely LLM-generated and references the actual pack contents and decisions you've taken in this run.
- Audit trail shows a `Calling LLM gateway — <step>` event before each live call, then a result line with the memo's lead sentence.
- The AI memo card gets a `Powered by <model returned by gateway> · generated <ts>` line — the model name comes from the gateway response, so it's honest about what actually answered.
- The **✨ Generate with AI** button in the prereq upload modal becomes enabled. Click it, enter an app name + domain, and the gateway fabricates a fresh 5-section pack used as the cycle's grounding context.

Privacy: credentials never leave your browser tab — they're stored in `sessionStorage` (cleared when you close the tab) and sent directly to the gateway URL you configured. The repo, GitHub Pages, and any other demo viewers cannot see them. If a live call fails (bad key, rate limit, CORS, network), the demo surfaces a clear toast and silently falls back to the static memo so the demo never breaks.

CORS note: if your gateway is corporate-network-only or doesn't allow `https://barrypan10.github.io` as an origin, the live calls will fail from the public Pages site — the toast says exactly that and the static memos render. To work around: have your gateway team add the origin to the allowlist, run the demo locally, or stand up a small Cloudflare/Vercel proxy.

Cost: depends on your gateway's per-call pricing. Without Anthropic-style prompt caching, both Step 10 reviews each pay full input tokens (the prereq pack is ~2 KB, so still cheap).

## Recording with your own voice instead

1. **Uncheck** the **🔊 Voiceover** toggle in the topbar.
2. Open this file alongside the demo so you can read the cues.
3. Start recording, click **▶ Demo Mode**, and read the right column above as each highlight appears.

## Voice quality notes

- **Best voices on Windows:** Microsoft Aria, Microsoft Jenny, Microsoft Guy (install via Settings → Time & Language → Speech → Manage voices if not present).
- **Best on Mac:** Samantha, Ava, Allison.
- **Chrome / Edge** auto-pick a high-quality voice. Firefox and Safari may pick a more robotic one.
- For a polished investor / executive video, replace TTS with **ElevenLabs** ("Adam", "Rachel", "Daniel"): generate the audio for each row above, then mix into the screen recording in any video editor (DaVinci Resolve, CapCut, Premiere).

## If something goes wrong

- **No voice plays:** the browser may have blocked TTS until first user interaction. Click anywhere on the page once, then click **▶ Demo Mode** again.
- **Voice cuts off mid-sentence:** that's the duration of a step running out. Tell me which step and I'll lengthen it.
- **Red spotlight is on the wrong element:** also tell me — each highlight has an explicit spotlight target in the script that's easy to fix.

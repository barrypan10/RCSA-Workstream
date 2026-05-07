# Cyber RCSA Demo — Recording Guide

The demo now has **built-in voiceover** (browser Text-to-Speech) and a **red spotlight box** that highlights the exact step being called out. You can record it as-is — no separate narration needed.

## Quickest path to a finished video

1. Open the demo (local or live URL) in **Chrome or Edge** — they have the best built-in voices on Windows.
2. Make sure **🔊 Voiceover** in the topbar is checked. Uncheck it if you want to record your own voice instead.
3. Start screen recording: Loom, OBS, or **Win + G** (Xbox Game Bar) on Windows / **Cmd+Shift+5** on Mac.
4. Click **▶ Demo Mode (1:30)**.
5. The demo auto-advances, narrates each step, and draws a red box around whatever is being highlighted.
6. Stop recording when the closing caption fades (~88 seconds).

## What viewers will see and hear

| Time  | On-screen                                           | Voiceover (TTS)                                                                                                  |
|-------|-----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| 0:00  | Title caption                                       | "Cyber RCSA today is manual, fragmented, and slow. This is what an AI-enabled workflow looks like."             |
| 0:07  | **AI HIGHLIGHT 1/7** + red box on Trigger          | "It starts with a trigger. AI auto-triages and recommends the right RCSA scope. The Cyber RCSA Lead approves." |
| 0:17  | **AI HIGHLIGHT 2/7** + red box on Step 2           | "AI mines prior cycles, audits, and incidents to surface six candidate risks — two previously missed."          |
| 0:27  | **AI HIGHLIGHT 3/7** + red box on Step 5           | "In control testing, AI flags three ineffective controls and one with missing evidence."                        |
| 0:36  | **AI HIGHLIGHT 4/7** + red box on Step 6           | "AI clusters the gaps, then drafts JIRA tickets and a ServiceNow change — owners auto-assigned from the CMDB."  |
| 0:48  | **AI HIGHLIGHT 5/7** + red box on Step 9           | "Pre-submission, AI runs quality control — catching weak items before 2LOD ever sees the package."             |
| 0:57  | **AI HIGHLIGHT 6/7** + red box on Step 10          | "At 2LOD, AI generates the challenge brief — surfacing outliers and unexplained rating changes."               |
| 1:06  | **AI HIGHLIGHT 7/7** + red box on Step 12          | "And it does not stop at approval. AI continuously monitors KRIs and SIEM signals."                            |
| 1:13  | Switch to Findings Report tab + red box on stamp   | "The platform auto-generates a complete Findings Report — every AI suggestion and every human decision attributed by role." |
| 1:24  | Closing caption                                     | "AI accelerates every bottleneck. Humans hold every material decision. Every step, fully auditable."           |

Total runtime: ~88 seconds.

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

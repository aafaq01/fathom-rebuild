# Fathom recon — 2026-09-29

Account: free personal plan (Gmail), Windows, Zoom connected. Two recorded calls:
- `842316355` "Test call": Fathom's scripted demo with Emmily (1 min).
- `842371423` "Impromptu Zoom Meeting": a real solo standup (45 s) with scripted decisions, action items, a risk and one mid-call highlight.

Screenshots are numbered in this folder (`00`–`37`). Several show the account email.

## Flow by flow

| # | Flow | What happened | Verdict |
|---|------|---------------|---------|
| 1 | Sign up (01–04) | Google OAuth asks for `calendar.events.readonly` only. Then a personal vs work email fork warning "Cannot convert to a team plan later". | Harsh permanent choice in minute one |
| 2 | Preferences (04–06) | One screen, written as a sentence: "Take notes on [All meetings] and share with [All attendees]". The consent checkbox is on the user. | The sentence UI is nice. The defaults are aggressive. |
| 3 | Zoom step (08) | Footer says "Fathom will only join the meetings you ask it to", which contradicts the "All meetings" default two screens earlier. | Inconsistent |
| 4 | Desktop gate (09–10) | Onboarding hard-gates on installing the desktop app. `/home` redirects back. The "Bot-free capture" app is "coming soon" on Windows. | **Fathom itself is moving away from the bot.** |
| 5 | Auth handoff (10b) | The desktop app sends you to your default browser to authenticate, then deep-links back. Two browsers and an app to finish signup. | Friction |
| 6 | Home (11, 31) | Grid of video thumbnails. An onboarding modal, a floating video avatar, a points counter and a "gifted Ask Fathom" banner all compete for attention. | Noisy |
| 7 | In-call (15–16, 34) | Floating panel with Highlight (auto-ends after current speaker, optional title), End, Pause. It showed "RECONNECTING" while the bot was clearly in the call. After the call: talk time %, monologue count, feedback box. | Two sources of truth disagree |
| 8 | Call page (18–19, 35) | Video top-left. Tabs: Summary / Transcript / Ask Fathom. Right column: Share, Action items, Annotations ("Internal team only"). Fixed width, lots of dead space. | Solid, dated layout |
| 9 | Summary (18) | Sections (Purpose, Takeaways, Topics, Next steps). **Every bullet is already a link to its timestamp** (`data-timestamp`). | Timestamp-linked summaries are table stakes, not a differentiator |
| 10 | Templates (22–23) | 17 templates: Enhanced, 6 sales methodologies, 2 CS, Interview, Demo, 1:1, Kick-off, Project update, Q&A, Retro, Stand Up. Switching regenerates in about 5 s. | Sales-heavy flat list |
| 11 | Short call (35) | 45 s real call: **"Meeting too short to generate a summary"**. Yet it did generate action items and an AI highlight title. | Inconsistent. Short calls get nothing. |
| 12 | Action items (35) | Real call: "Send pricing doc **to Aafaq** by Wed" (wrong: I said *Sara* sends it) and "Fix login bug before demo" (correct owner). Both stamped `@0:07`. The demo call returned "None detected". "Copy follow-up email" and "Assign" exist. | **Owner attribution is wrong, and timestamps are coarse** |
| 13 | Transcript (20, 36) | Chat bubbles. Action items and highlights are inline markers. Search is within the transcript. "Resume auto-scroll". ASR errors: "Afak", "API **weight** limits" (rate), "this **fall**" (call). No way to fix a word. | Bubbles waste space. No corrections. |
| 14 | Highlight to clip (26–30) | Highlight row has a link icon that copies `/share/h/<id>`. Logged-out viewer: video, one-line title, "Get your own free AI Notetaker 🔥" upsell. **No transcript and no context.** +10 points modal for sharing. | The clip page doesn't tell a non-attendee why it matters |
| 15 | Search (32–33, 37) | Title search works ("Calls titled Impromptu"). **Transcript search found nothing** for "pricing" or "beta" about 5 min after the call ("No transcript matches"). | Transcript search is broken or lagging on the free plan |
| 16 | Ask Fathom | Per-call chat tab plus account-level "Ask Fathom" rail with suggestions ("What might fall through the cracks?"). | Nice. Stretch goal for us. |

## The 8-person, one-hour call (reasoned; we couldn't record one)

Everything on the call page scales badly with length and headcount:
- **Transcript:** about 9,000 words of chat bubbles (the demo's 60 s was 6 bubbles). No speaker filter, no chapters, no way to see who spoke when.
- **Scrubber:** a plain bar. Nothing shows topics, speakers, action items or highlights along the timeline.
- **Action items:** a flat list, and owner attribution is already wrong with *one* speaker. With 8 people "who owns what" is the core question, and there's no per-owner view.
- **Summary:** one template for the whole hour, with no navigation between topics.
- **Talk time:** shown only in the in-call panel as a single %. Nothing per speaker on the call page.
- **Search:** can't find words inside transcripts, so "which meeting did we decide X in?" fails.

## What we build (thesis: **built for the long, crowded call**)

Keep (parity): recording plus synced transcript, AI summary with templates and timestamp links, action items, highlights, clip share, cross-meeting search.

Improve (the story):
1. **Meeting timeline:** a scrubber with speaker lanes plus markers for chapters, action items and highlights. Click to jump.
2. **Chapters:** AI splits the hour into topics. Each chapter has its own mini-summary and is a navigation target.
3. **Compact transcript:** dense rows, not bubbles. Speaker filter chips, live highlight of the current line, in-meeting search with hit markers on the timeline.
4. **Action items by owner:** grouped per person, with precise timestamps and editable owner. Fixes Fathom's attribution bug head-on.
5. **Per-speaker talk time** on the meeting page.
6. **Search that searches transcripts:** snippet results that jump to the exact moment.
7. **Clip pages with context:** the public clip shows the transcript excerpt, speaker names, why it matters (AI one-liner) and a link to the chapter. No sign-in.
8. **Summaries for short calls too.** No "too short" dead end.

Cut (and say so):
- **The bot, calendar and desktop app.** Capture is stubbed. Upload a recording, or use seeded real meetings. Fathom's own "bot-free" direction backs this.
- **CRM, deals, playlists, alerts, team workspaces, billing, gamification/points, onboarding tour.**
- **Auth.** The live link opens straight into a demo workspace (the brief requires it to open for someone not signed in).
- **Ask Fathom.** Stretch goal only, if time remains.

# Fathom rebuild: built for the long, crowded call

**Live:** https://fathom-rebuild-five.vercel.app (no sign-in)

A rebuild of [Fathom](https://fathom.video)'s AI meeting notetaker in 24 hours. It's seeded with real,
Creative Commons-licensed meetings, including an 81-minute city advisory board meeting with 10 speakers.

Good places to start:
- [Burlington Telecom Advisory Board](https://fathom-rebuild-five.vercel.app/m/burlington-telecom-2017-10-11): the long, crowded call
- [A shared clip](https://fathom-rebuild-five.vercel.app/c/i3jpzjpc): what someone who wasn't there sees
- [Search "privacy" across every meeting](https://fathom-rebuild-five.vercel.app/search?q=privacy)
- [Upload your own recording](https://fathom-rebuild-five.vercel.app/upload)

## The thesis

I used Fathom end to end before writing any code; notes and screenshots are in [recon/](recon/RECON.md).
It works well for a 45-second call with one person. **The call page falls apart on an 8-person, 1-hour
meeting**, which is the meeting that most needs notes:

| Fathom today (from recon) | What this build does |
|---|---|
| The scrubber is a plain bar. Nothing shows who spoke when, or where topics, action items and highlights are. | **Timeline with a lane per speaker** and their talk-time share, a **chapter bar**, and markers for action items, clips and search hits. Click anywhere to jump. |
| The transcript is chat bubbles: about 9,000 words of them for an hour. No speaker filter, no chapters. | **Compact transcript rows.** The current line is highlighted and followed during playback, with **speaker filter chips**, **chapter dividers** and inline action items. |
| Action items are a flat list, owners are wrong even with one speaker ("Send pricing doc to Aafaq" when Sara sends it), and everything is stamped `@0:07`. | **Actions grouped by owner.** The owner is the person who will do it, not whoever mentioned it; unclear owners stay *Unassigned* rather than guessed. Every item has its **exact timestamp**. |
| One summary for the whole hour, and no way to move between topics. | **Chapters with mini-summaries**, each a jump target. Every summary bullet links to its moment. |
| 17 summary templates, mostly sales methodologies. Switching regenerates in about 5 s. | **5 templates:** General, Decisions & risks, Stand-up, Action-focused, Executive brief. They're precomputed, so **switching is instant**, and every bullet keeps its timestamp link. A missing template is generated once and cached. |
| ASR gets names wrong ("Afak"), and there's no way to fix a name. | Names come from **transcript evidence**, and anyone can **rename a speaker** by clicking their name (legend, transcript or action owner). The new name updates everywhere, including action owners and home avatars. |
| "Meeting too short to generate a summary." | Short meetings get a summary too. |
| Talk time appears only in the in-call panel, as one percentage. | **Talk time per speaker** on the meeting page. |
| Transcript search found nothing ("No transcript matches") about 5 minutes after the call. | **Cross-meeting transcript search** (Postgres full-text) with highlighted snippets that jump to the exact moment. **In-meeting search** puts its hits on the timeline. |
| The clip page is a video and a one-line title, with no transcript and no context. | **Clip pages with context:** an AI title and a "why it matters" line, the quoted words plus the surrounding lines, the chapter it belongs to, and a link into the full meeting at that second. No sign-in. |

## How the AI layer stays honest

- **Timestamps can't drift.** Claude (Sonnet 5, structured output) never writes a timestamp. It cites
  transcript rows by number, and every time shown comes from Deepgram's word timings.
  See [scripts/seed-ai.mjs](scripts/seed-ai.mjs).
- **Speaker names only with evidence.** Diarization gives "Speaker 0–9". Claude names a speaker only
  when the transcript supports it ("My name is Kit Andrews", or being addressed as "Joan" right before
  answering), and it records the quote. Everyone else stays "Speaker N" with an inferred role. On the
  Burlington call, 8 of 10 speakers were named this way.
- **Clips are cut on exact words.** Selecting words in the transcript uses each word's start and end time.
- **Cost:**
  - Notes for all 4 seed meetings cost **$0.22**.
  - The 16 extra summary templates cost roughly $0.50. Each meeting's transcript is cached, so templates
    after the first read it for about $0.016 each.
  - A clip title costs about $0.01.
  - Every public endpoint that calls Claude has an hourly cap: 30 clips, 40 generated summaries, 10 uploads.

## What I built first, and why

1. **Real data before UI.** Everything downstream depends on diarization quality, so I checked it first.
   The first candidate, a Wikimedia SIG call, turned out to be one presenter (81% of talk time), so I
   rejected it and picked the Burlington board meeting (9 speakers with at least 2% of talk time).
2. **The meeting page.** It's the product, and it's where the thesis lives: timeline, synced
   transcript, owner-grouped actions.
3. **Cross-meeting search and the list.**
4. **Clips with context.**
5. **Then, with time left:** summary templates, speaker rename, and upload.

## Upload (the stubbed capture layer)

[Upload a recording](https://fathom-rebuild-five.vercel.app/upload), audio or video, and it goes through the same
pipeline as the seeded meetings:

```
browser → Vercel Blob (presigned PUT, private store) → Deepgram nova-3 (diarized) → Claude notes → Postgres → /m/[id]
```

A processing page polls until the meeting is ready; a 2-minute recording took about 34 seconds.
The upload endpoint only accepts URLs from this app's Blob store, and it's capped at 10 uploads an hour.
Media is private, so the player and Deepgram each get a short-lived signed URL.

## What I cut, and why

| Cut | Why |
|---|---|
| Meeting bot, calendar, desktop app | Capture is commodity. Fathom itself is moving to "bot-free" capture. The brief allows stubbing capture, so **upload a recording** stands in for it. |
| Auth, CRM, billing, gamification, onboarding | Not the story. The live link opens straight into the demo workspace, as the brief requires. |
| Shared speaker renames | Renames are saved **per browser** (localStorage). The site is public with no auth, so shared renames would let any visitor vandalise the seed data. With auth, this becomes a column on the meeting. |
| Ask Fathom (chat with the meeting) | Nice to have, but a stretch goal behind everything above. |

## Seed data

Four real meetings, all Creative Commons. Full credits are in [seed/ATTRIBUTION.md](seed/ATTRIBUTION.md).

- **Burlington Telecom Advisory Board**, 2017-10-11 (81 min, 10 speakers): Town Meeting TV via Wikimedia Commons, CC BY 3.0
- **Williston Development Review Board**, 2017-08-08 (68 min, 7 speakers): Town Meeting TV via Wikimedia Commons, CC BY 3.0
- **AMI Meeting Corpus IS1009c and ES2004a** (30 and 17 min, 4 speakers): AMI Consortium, CC BY 4.0
- **"Williston DRB opening (upload demo)"**: a 2-minute clip of the Williston recording (CC BY 3.0), uploaded
  through the app to demonstrate the capture pipeline

The two AMI meetings are audio-only and stream from the AMI corpus server. Converting their video was
too slow from my connection, and ES2004a has no room-view video. No YouTube content was downloaded;
YouTube's Terms of Service forbid it even for CC-licensed videos.

## Stack

Next.js 16 (App Router) with Tailwind v4 on Vercel, Neon Postgres (full-text search with `tsvector` and
`ts_headline`), Deepgram nova-3 (diarized), and Claude Sonnet 5 through the Anthropic SDK with Zod
structured outputs.

```
seed/sources.json → scripts/transcribe.mjs (Deepgram)      → seed/deepgram/*.json
                  → scripts/seed-ai.mjs (Claude)           → seed/ai/*.json
                  → scripts/load-db.mjs                    → Postgres (db/schema.sql)
                  → scripts/seed-templates.mjs (Claude)    → seed/ai/templates/*.json → summaries
```

Uploads and seeds share the same code: `lib/rows.ts` (merging transcript fragments into rows),
`lib/notes.ts` (the Claude pass), `lib/summarize.ts` (templates) and `lib/store.ts` (database writes).

Raw transcripts and AI output are committed, so re-seeding costs nothing.

To run locally, put `DATABASE_URL`, `DEEPGRAM_API_KEY` and `ANTHROPIC_API_KEY` in `.env.local`, then:

```
npm install
node --env-file=.env.local scripts/load-db.mjs
npm run dev
```

## How this was built

With Claude Code. Every prompt and final response is captured automatically in
[.agent-logs/](.agent-logs/); see [CAPTURE-TEST.md](CAPTURE-TEST.md) for how that capture works, including
the capture bugs found and fixed along the way. The home, search and clip pages were built by a subagent
in parallel while the meeting page was built in the main session.

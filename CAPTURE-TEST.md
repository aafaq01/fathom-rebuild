# Capture Test

## Tool and model

- **Tool:** Claude Code 2.1.283, VS Code extension (same engine as the `claude` CLI).
- **Model:** `claude-opus-5-5` (Opus 5.5) both plans and executes. No separate planner model.
  Any subagents inherit it unless noted in the log, and the log records `message.model` per
  turn, so a switch mid-build shows up.
- **Hook mechanism:** yes. Claude Code has lifecycle hooks configured in settings files. This
  setup uses `UserPromptSubmit` (fires on every prompt) and `Stop` (fires at end of every turn).

## Mechanism

- **Config changed:** [.claude/settings.json](.claude/settings.json) (project-level, committed,
  so it applies to every session opened in this repo). Both events run:
  `node "$CLAUDE_PROJECT_DIR/.claude/hooks/capture.mjs"`
- **Script:** [.claude/hooks/capture.mjs](.claude/hooks/capture.mjs). It reads the hook stdin
  (`session_id`, `transcript_path`, `hook_event_name`), parses the session transcript JSONL,
  and appends to `.agent-logs/YYYY-MM-DD_HH-MM-SS_<session-id>.md`:
  - PROMPT: the user message verbatim. Tool results, meta/injected messages, compaction
    summaries and interrupt markers are excluded.
  - RESPONSE: the assistant text after the turn's last tool call, i.e. the final answer only.
    No thinking, tool calls or intermediate text.
  - Transcript UTC timestamps and the per-turn `message.model`.
- The log is append-only. Entries already present are never rewritten; only the frontmatter
  counters (`total_exchanges`, `last_prompt_time`, `model`) are refreshed. Because it syncs from
  the transcript, a turn missed by one firing (e.g. an interrupted turn, where `Stop` does not
  fire) is picked up by the next `UserPromptSubmit`.

## Where the canaries landed

- Headless session A/B: `.agent-logs/2026-09-29_09-23-44_a27492c2-e193-458c-87d2-198ddd2bd2e8.md`
- Interactive canaries (VS Code): _pending, see below_

## Canary entries (raw)

### Session `a27492c2` (fresh `claude -p` session, second turn via `--resume`)

```
[LOG_ENTRY type=PROMPT num=1 session=a27492c2]
timestamp: 2026-09-29T09:23:44.534Z
model: claude-opus-5-5

CAPTURE TEST — 8x assignment, Aafaq Rana (headless check A)


[LOG_ENTRY type=RESPONSE num=1 session=a27492c2]
timestamp: 2026-09-29T09:23:48.683Z
model: claude-opus-5-5

Got the capture test, headless check A. No task was included, so I haven't changed anything.

- Canva and Slack aren't connected yet. Authorize them in your claude.ai connector settings if you need them.
- The ponytail statusline badge isn't set up. I can add it to `~/.claude/settings.json` if you want it.

Send the actual 8x assignment task when you're ready.


[LOG_ENTRY type=PROMPT num=2 session=a27492c2]
timestamp: 2026-09-29T09:24:09.390Z
model: claude-opus-5-5

CAPTURE TEST — 8x assignment, Aafaq Rana (headless check B). Run 'git status --short' and tell me in one line how many untracked paths there are.


[LOG_ENTRY type=RESPONSE num=2 session=a27492c2]
timestamp: 2026-09-29T09:24:18.658Z
model: claude-opus-5-5

There are 2 untracked paths, `.agent-logs/` and `.claude/` (PowerShell errored with "command line is too long", so I ran it in Bash instead).
```

Turn 2 made tool calls; only the final text was captured. The RESPONSE 1 text was also checked
against the harness's own `last_assistant_message` from the Stop hook stdin: exact match.

### Interactive canaries

_Pending: one in the setup session (`d9ea18f8`) and one in a brand-new VS Code session._

## What didn't work / what I tried first

- **Earlier attempt, session `f2ad8478` (08:45 UTC).** The first run of this setup found `.git`
  in the parent folder (`8x assignment/`) rather than in `fathom-rebuild/`. Moving it was blocked
  as a risky action, so that session committed nothing, and its files were later discarded. The
  repo was re-initialised in `fathom-rebuild/` and setup restarted in session `d9ea18f8`. Its
  transcript was still on disk, so I backfilled it once by running the same capture script
  against it by hand: `.agent-logs/2026-09-29_08-45-10_f2ad8478-….md`.
- **Hook stdin field names.** A docs lookup said `UserPromptSubmit` carries `prompt_text`. A
  one-off stdin dump (extra `--settings` hook, not committed) showed the real field is `prompt`.
  The script doesn't depend on it anyway: it takes the prompt from the transcript, which also
  gives the exact UTC timestamp and the model that answered.
- **Hot-reload risk.** Hooks added mid-session may not load in the session that created them.
  That is why a fresh session was tested first, and why an interactive canary in a new VS Code
  session is still required.

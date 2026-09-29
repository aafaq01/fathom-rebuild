// Appends prompt + final response per turn to .agent-logs/<first-prompt-time>_<session>.md.
// Wired to UserPromptSubmit and Stop in .claude/settings.json. Source of truth is the
// session transcript (JSONL), so a turn missed by one hook firing is picked up by the next.
// Append-only: existing entries are never rewritten; only the frontmatter counts are refreshed.
import fs from 'node:fs';
import path from 'node:path';

const AUTHOR = 'aafaq01';

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const sid = input.session_id;
  const isStop = input.hook_event_name === 'Stop';
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd;
  const dir = path.join(root, '.agent-logs');

  // Transcript -> turns: { prompt, promptTs, model, segs: [{ texts (after last tool_use), ts }] }
  // A turn can stop more than once: a harness message (task notification, subagent hand-back) wakes
  // the model again without a human prompt. Each Stop (stop_hook_summary) closes one response segment.
  const turns = [];
  let cur = null, seg = null;
  const newSeg = () => cur.segs.push(seg = { texts: [], ts: null });
  for (const line of fs.readFileSync(input.transcript_path, 'utf8').split('\n')) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.isSidechain) continue;
    const c = e.message?.content;
    if (e.type === 'system' && e.subtype === 'stop_hook_summary' && cur) newSeg();
    else if (e.type === 'user' && !e.isMeta && !e.isCompactSummary) {
      if (e.origin && e.origin.kind !== 'human') continue; // harness-injected (<task-notification> etc.), not a prompt
      const blocks = typeof c === 'string' ? [{ type: 'text', text: c }] : c || [];
      if (blocks.some(b => b.type === 'tool_result')) continue;
      const text = blocks.map(b => b.type === 'text' ? b.text : b.type === 'image' ? '[image]' : '').join('\n');
      // ponytail: skip harness echoes that aren't typed prompts; extend this list if others show up
      if (!text.trim() || /^(\[Request interrupted by user|<local-command-stdout>|<bash-stdout>)/.test(text)) continue;
      turns.push(cur = { prompt: text, promptTs: e.timestamp, model: null, segs: [] });
      newSeg();
    } else if (e.type === 'assistant' && cur) {
      cur.model = e.message.model;
      for (const b of c || []) {
        if (b.type === 'tool_use') seg.texts = [];
        else if (b.type === 'text') { seg.texts.push(b.text); seg.ts = e.timestamp; }
      }
    }
  }
  if (!turns.length) process.exit(0);

  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.readdirSync(dir).find(f => f.endsWith(`_${sid}.md`));
  const file = path.join(dir, existing || `${turns[0].promptTs.slice(0, 19).replace('T', '_').replaceAll(':', '-')}_${sid}.md`);
  const old = existing ? fs.readFileSync(file, 'utf8') : '';
  const short = sid.slice(0, 8);
  // Dedupe on timestamp, not num: nums in the log are history, the parse of turns may change.
  // Only real headers count: start of line + this session's id. Pasted examples inside a prompt
  // (e.g. the setup doc's indented `[LOG_ENTRY ... session=3f9c1a20]`) must not.
  // ponytail: a prompt pasting this session's own header line verbatim, unindented, would still match
  const logged = new Map([...old.matchAll(new RegExp(`^\\[LOG_ENTRY type=(PROMPT|RESPONSE) num=(\\d+) session=${short}\\]\\ntimestamp: (\\S+)$`, 'gm'))]
    .map(m => [`${m[1]}@${m[3]}`, +m[2]]));
  let maxNum = Math.max(0, ...[...logged].filter(([k]) => k.startsWith('PROMPT@')).map(([, n]) => n));

  const entry = (type, n, ts, model, text) =>
    `[LOG_ENTRY type=${type} num=${n} session=${short}]\ntimestamp: ${ts}\nmodel: ${model}\n\n${text.trim()}\n\n\n`;

  let add = '';
  let lastModel = input.model || null;
  turns.forEach((t, i) => {
    const model = t.model || lastModel;
    lastModel = model;
    let num = logged.get('PROMPT@' + t.promptTs);
    if (!num) {
      if (!model) return; // first prompt, no reply yet: Stop will log it with the answering model
      num = ++maxNum;
      add += entry('PROMPT', num, t.promptTs, model, t.prompt);
      logged.set('PROMPT@' + t.promptTs, num);
    }
    // A segment is final once a later Stop/turn closed it, or this is the Stop that ends it.
    // A segment missed earlier is appended late (out of order) rather than dropped.
    t.segs.forEach((s, j) => {
      const text = s.texts.join('\n\n');
      const closed = isStop || j < t.segs.length - 1 || i < turns.length - 1;
      if (closed && text.trim() && !logged.has('RESPONSE@' + s.ts)) {
        add += entry('RESPONSE', num, s.ts, model, text);
        logged.set('RESPONSE@' + s.ts, num);
      }
    });
  });
  if (!add && existing) process.exit(0);

  const prompts = [...logged.keys()].filter(k => k.startsWith('PROMPT@')).map(k => k.slice(7)).sort();
  const body = existing
    ? old.slice(old.indexOf('\n---\n', 4) + 5)
    : `\n# Session Log - ${turns[0].promptTs.slice(0, 10)}\n\nSession: \`${short}\` | Project: \`${path.basename(root)}\` | Author: \`${AUTHOR}\`\n\n---\n\n`;
  const front = `---
session_id: ${sid}
date: ${turns[0].promptTs.slice(0, 10)}
author: ${AUTHOR}
model: ${lastModel}
tool: claude-code
project: ${path.basename(root)}
total_exchanges: ${prompts.length}
first_prompt_time: ${prompts[0] ?? ''}
last_prompt_time: ${prompts.at(-1) ?? ''}
---
`;
  fs.writeFileSync(file, front + body + add);
} catch (err) {
  // Never block the session; surface the failure in the hook output instead.
  console.error('capture hook failed:', err.stack || err);
}

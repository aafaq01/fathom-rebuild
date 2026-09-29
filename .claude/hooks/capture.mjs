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

  // Transcript -> turns: { prompt, promptTs, texts (after last tool_use), respTs, model }
  const turns = [];
  let cur = null;
  for (const line of fs.readFileSync(input.transcript_path, 'utf8').split('\n')) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.isSidechain) continue;
    const c = e.message?.content;
    if (e.type === 'user' && !e.isMeta && !e.isCompactSummary) {
      const blocks = typeof c === 'string' ? [{ type: 'text', text: c }] : c || [];
      if (blocks.some(b => b.type === 'tool_result')) continue;
      const text = blocks.map(b => b.type === 'text' ? b.text : b.type === 'image' ? '[image]' : '').join('\n');
      // ponytail: skip harness echoes that aren't typed prompts; extend this list if others show up
      if (!text.trim() || /^(\[Request interrupted by user|<local-command-stdout>|<bash-stdout>)/.test(text)) continue;
      turns.push(cur = { prompt: text, promptTs: e.timestamp, texts: [], respTs: null, model: null });
    } else if (e.type === 'assistant' && cur) {
      cur.model = e.message.model;
      for (const b of c || []) {
        if (b.type === 'tool_use') cur.texts = [];
        else if (b.type === 'text') { cur.texts.push(b.text); cur.respTs = e.timestamp; }
      }
    }
  }
  if (!turns.length) process.exit(0);

  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.readdirSync(dir).find(f => f.endsWith(`_${sid}.md`));
  const file = path.join(dir, existing || `${turns[0].promptTs.slice(0, 19).replace('T', '_').replaceAll(':', '-')}_${sid}.md`);
  const old = existing ? fs.readFileSync(file, 'utf8') : '';
  const short = sid.slice(0, 8);
  // Only real headers count: start of line + this session's id. Pasted examples inside a prompt
  // (e.g. the setup doc's indented `[LOG_ENTRY ... session=3f9c1a20]`) must not.
  // ponytail: a prompt pasting this session's own header line verbatim, unindented, would still match
  const logged = new Set([...old.matchAll(new RegExp(`^\\[LOG_ENTRY type=(PROMPT|RESPONSE) num=(\\d+) session=${short}\\]$`, 'gm'))].map(m => m[1] + m[2]));
  const entry = (type, n, ts, model, text) =>
    `[LOG_ENTRY type=${type} num=${n} session=${short}]\ntimestamp: ${ts}\nmodel: ${model}\n\n${text.trim()}\n\n\n`;

  let add = '';
  let lastModel = input.model || null;
  turns.forEach((t, i) => {
    const n = i + 1;
    const model = t.model || lastModel;
    lastModel = model;
    if (!logged.has('PROMPT' + n)) {
      if (!model) return; // first prompt, no reply yet: Stop will log it with the answering model
      add += entry('PROMPT', n, t.promptTs, model, t.prompt);
      logged.add('PROMPT' + n);
    }
    // Final response: only once the turn is over, and never after a later prompt is already in the log.
    const over = isStop || n < turns.length;
    let text = t.texts.join('\n\n');
    if (isStop && n === turns.length && !text.trim()) text = input.last_assistant_message || ''; // transcript not flushed yet
    if (over && text.trim() && !logged.has('RESPONSE' + n) && !logged.has('PROMPT' + (n + 1))) {
      add += entry('RESPONSE', n, t.respTs || new Date().toISOString(), t.model || model, text);
      logged.add('RESPONSE' + n);
    }
  });
  if (!add && existing) process.exit(0);

  const prompts = turns.filter((_, i) => logged.has('PROMPT' + (i + 1)));
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
first_prompt_time: ${prompts[0]?.promptTs ?? ''}
last_prompt_time: ${prompts.at(-1)?.promptTs ?? ''}
---
`;
  fs.writeFileSync(file, front + body + add);
} catch (err) {
  // Never block the session; surface the failure in the hook output instead.
  console.error('capture hook failed:', err.stack || err);
}

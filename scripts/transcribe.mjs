// Transcribe seed meetings with Deepgram nova-3 (diarized) and save the raw response to
// seed/deepgram/<id>.json. Deepgram fetches audio_url itself. Skips ids already saved.
// Usage: node --env-file=.env.local scripts/transcribe.mjs [id ...]
import fs from 'node:fs';

const sources = JSON.parse(fs.readFileSync('seed/sources.json', 'utf8'));
const ids = process.argv.slice(2);
fs.mkdirSync('seed/deepgram', { recursive: true });

const params = new URLSearchParams({ model: 'nova-3', diarize: 'true', utterances: 'true', smart_format: 'true', punctuate: 'true' });

for (const s of sources.filter(s => !ids.length || ids.includes(s.id))) {
  const out = `seed/deepgram/${s.id}.json`;
  if (!fs.existsSync(out)) {
    console.log(`${s.id}: transcribing ${s.audio_url}`);
    const t0 = Date.now();
    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: 'POST',
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: s.audio_url }),
      signal: AbortSignal.timeout(15 * 60_000),
    });
    const body = await res.text();
    if (!res.ok) { console.error(`${s.id}: Deepgram ${res.status}: ${body.slice(0, 500)}`); continue; }
    fs.writeFileSync(out, body);
    console.log(`${s.id}: saved in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  report(s.id, JSON.parse(fs.readFileSync(out, 'utf8')));
}

// Speaker check: talk-time share per diarized speaker, so we can see if the "crowded call" is real.
function report(id, dg) {
  const us = dg.results.utterances;
  const talk = {};
  for (const u of us) talk[u.speaker] = (talk[u.speaker] || 0) + (u.end - u.start);
  const total = Object.values(talk).reduce((a, b) => a + b, 0);
  const rows = Object.entries(talk).sort((a, b) => b[1] - a[1]);
  console.log(`${id}: ${(dg.metadata.duration / 60).toFixed(1)} min, ${us.length} utterances, ${rows.length} speakers, ` +
    `${rows.filter(([, t]) => t / total >= 0.02).length} with >=2% talk time`);
  for (const [sp, t] of rows) console.log(`  speaker ${sp}: ${(t / 60).toFixed(1)} min (${((100 * t) / total).toFixed(1)}%)`);
}

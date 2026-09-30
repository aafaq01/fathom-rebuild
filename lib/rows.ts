// Deepgram utterances are fragments (often 1-3 words). Merge consecutive same-speaker fragments
// into transcript rows: the unit we store, display, sync to playback and let the AI cite by index.
// Shared by the seed scripts (Node runs this .ts directly) and the upload pipeline.
// ponytail: rows cap at 40s so the "current line" highlight and timestamps stay precise in monologues
type DgWord = { start: number; end: number; word: string; punctuated_word?: string };
type DgUtterance = { speaker: number; start: number; end: number; transcript: string; words: DgWord[] };
export type Deepgram = { metadata: { duration: number }; results: { utterances: DgUtterance[] } };
export type SeedRow = { idx: number; speaker: number; start_ms: number; end_ms: number; text: string; words: [number, number, string][] };

export function toRows(dg: Deepgram): SeedRow[] {
  const rows: Omit<SeedRow, 'idx'>[] = [];
  for (const u of dg.results.utterances ?? []) {
    const last = rows.at(-1);
    const words = u.words.map(w => [Math.round(w.start * 1000), Math.round(w.end * 1000), w.punctuated_word ?? w.word] as [number, number, string]);
    if (last && last.speaker === u.speaker && u.start * 1000 - last.end_ms < 1500 && u.end * 1000 - last.start_ms < 40_000) {
      last.text += ' ' + u.transcript;
      last.end_ms = Math.round(u.end * 1000);
      last.words.push(...words);
    } else {
      rows.push({ speaker: u.speaker, start_ms: Math.round(u.start * 1000), end_ms: Math.round(u.end * 1000), text: u.transcript, words });
    }
  }
  return rows.map((r, idx) => ({ idx, ...r }));
}

export const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? h + ':' + String(m).padStart(2, '0') : m}:${String(s % 60).padStart(2, '0')}`;
};

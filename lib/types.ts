export type Speaker = { label: number; name: string | null; role: string; color: string; talk_ms: number };

export type Meeting = {
  id: string;
  title: string;
  recorded_at: string | null;
  duration_ms: number;
  media_kind: 'video' | 'audio';
  media_url: string;
  source_url: string | null;
  license: string | null;
  attribution: string | null;
  speakers: Speaker[];
};

export type Row = { idx: number; speaker: number; start_ms: number; end_ms: number; text: string; words: [number, number, string][] };
export type Chapter = { idx: number; title: string; summary: string; start_ms: number; end_ms: number };
export type ActionItem = { id: number; owner: number | null; text: string; due: string | null; at_ms: number; done: boolean };
export type Summary = { template: string; sections: { heading: string; bullets: { text: string; at_ms: number }[] }[] };
export type Highlight = { id: string; start_ms: number; end_ms: number; title: string; quote: string; why: string | null; created_at: string };

export const speakerName = (s: Speaker | undefined, label?: number) =>
  s?.name ?? `Speaker ${(s?.label ?? label ?? 0) + 1}`;

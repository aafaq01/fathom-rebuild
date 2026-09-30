'use client';
// Speaker renames are per-browser (localStorage): the live site is public, so visitors can fix names
// for themselves without being able to vandalise the shared seed data.
// ponytail: per-browser only; move to a DB column behind auth if renames need to be shared.
import { useCallback, useEffect, useState } from 'react';

const key = (meetingId: string) => `speaker-names:${meetingId}`;
const EVENT = 'speaker-names';
type Names = Record<string, string>;

export function readNames(meetingId: string): Names {
  try { return JSON.parse(localStorage.getItem(key(meetingId)) || '{}'); } catch { return {}; }
}

export function useSpeakerNames(meetingId: string) {
  const [names, setNames] = useState<Names>({});
  useEffect(() => {
    const load = () => setNames(readNames(meetingId));
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener('storage', load); // other tabs
    return () => { window.removeEventListener(EVENT, load); window.removeEventListener('storage', load); };
  }, [meetingId]);

  const rename = useCallback((label: number, name: string) => {
    const next = readNames(meetingId);
    const v = name.trim().slice(0, 40);
    if (v) next[label] = v; else delete next[label];
    try { localStorage.setItem(key(meetingId), JSON.stringify(next)); } catch { /* storage blocked: rename just won't stick */ }
    window.dispatchEvent(new Event(EVENT));
  }, [meetingId]);

  return { names, rename };
}

export function applyNames<T extends { label: number; name: string | null }>(speakers: T[], names: Names): T[] {
  return speakers.map(s => (names[s.label] ? { ...s, name: names[s.label] } : s));
}

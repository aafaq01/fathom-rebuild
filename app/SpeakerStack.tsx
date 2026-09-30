'use client';
import { applyNames, useSpeakerNames } from '@/lib/names';
import { speakerName, type Speaker } from '@/lib/types';
import { initials } from '@/lib/format';

// Home-card avatars, with this browser's speaker renames applied.
export default function SpeakerStack({ meetingId, speakers, max = 6 }: { meetingId: string; speakers: Speaker[]; max?: number }) {
  const { names } = useSpeakerNames(meetingId);
  const top = applyNames([...speakers].sort((a, b) => (b.talk_ms ?? 0) - (a.talk_ms ?? 0)), names);
  const extra = top.length - max;
  return (
    <div className="flex -space-x-2">
      {top.slice(0, max).map(s => {
        const name = speakerName(s);
        return (
          <span
            key={s.label} title={name}
            className={`grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold ring-2 ring-surface ${s.name ? 'text-white' : 'bg-surface-2 text-muted'}`}
            style={s.name ? { backgroundColor: s.color } : undefined}
          >
            {initials(name)}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted ring-2 ring-surface">+{extra}</span>
      )}
    </div>
  );
}

// A speaker's display name in server-rendered pages (search, clip), with this browser's renames applied.
export function SpeakerLabel({ meetingId, speaker, label }: { meetingId: string; speaker: Speaker | undefined; label: number }) {
  const { names } = useSpeakerNames(meetingId);
  return <>{names[label] ?? speakerName(speaker, label)}</>;
}

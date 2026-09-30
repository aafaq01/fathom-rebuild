// Summary templates. Five, not Fathom's seventeen. No dependencies: imported by client components.
export const TEMPLATES = [
  { id: 'general', label: 'General', blurb: 'Purpose, takeaways, decisions, next steps' },
  { id: 'decisions', label: 'Decisions & risks', blurb: 'What was decided, by whom, and what could go wrong' },
  { id: 'standup', label: 'Stand-up', blurb: 'Per person: done, next, blockers' },
  { id: 'actions', label: 'Action-focused', blurb: 'Commitments grouped by owner, plus loose ends' },
  { id: 'exec', label: 'Executive brief', blurb: 'TL;DR for someone with 30 seconds' },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]['id'];

// Claude sometimes echoes the row citations into prose, e.g. "(#7-#14, #26-#38)". The chip already links there.
export const stripRowRefs = (s: string) => s.replace(/\s*\((?:\s*#\d+(?:\s*[-–]\s*#?\d+)?\s*,?)+\)/g, '').trim();

export const TEMPLATE_GUIDE: Record<TemplateId, string> = {
  general: 'Sections, in this order, omitting any that would be empty: "Purpose", "Key takeaways", "Decisions", "Open questions", "Next steps".',
  decisions:
    'Sections: "Decisions made" (each bullet: what was decided and who decided or proposed it), "Risks & concerns" (who raised it), "Open questions", "Disagreements" (who disagreed about what). Omit empty sections. If nothing was formally decided, say so in one bullet under "Decisions made".',
  standup:
    'One section per person who gave an update; heading = their name, or "Speaker N (role)" if unnamed. Bullets start with "Done:", "Next:" or "Blocker:". Skip people who only made brief remarks. If this was not a stand-up, adapt: what each main participant reported, planned, or was blocked on.',
  actions:
    'One section per owner; heading = the owner\'s name, or "Speaker N (role)" if unnamed. Bullets = concrete commitments that person made or was assigned, with any deadline. Then a section "Unassigned" for tasks nobody owned, and "Loose ends" for things raised that need a follow-up but were not assigned. Owner = who will do it, not who mentioned it.',
  exec:
    'Sections: "TL;DR" (at most 3 bullets, one sentence each), "Outcomes" (what changed as a result of this meeting), "Needs attention" (risks, asks, or decisions pending). Terse and concrete; numbers and names over adjectives.',
};

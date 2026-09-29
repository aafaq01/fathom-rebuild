-- Fathom rebuild schema (Neon Postgres). Idempotent: safe to re-run.

create table if not exists meetings (
  id          text primary key,              -- slug, e.g. 'ami-is1009c'
  title       text not null,
  recorded_at timestamptz,
  duration_ms integer,
  media_kind  text not null default 'video' check (media_kind in ('video', 'audio')),
  media_url   text,
  source_url  text,                          -- where the recording came from
  license     text,
  attribution text,
  status      text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error       text,
  speakers    jsonb not null default '[]',   -- [{ "label": 0, "name": "Ana", "color": "#..." }]
  created_at  timestamptz not null default now()
);

create table if not exists utterances (
  meeting_id text not null references meetings(id) on delete cascade,
  idx        integer not null,
  speaker    integer not null,               -- diarization label; name lives in meetings.speakers
  start_ms   integer not null,
  end_ms     integer not null,
  text       text not null,
  words      jsonb,                          -- [[start_ms, end_ms, "word"], ...] for precise clip selection
  tsv        tsvector generated always as (to_tsvector('english', text)) stored,
  primary key (meeting_id, idx)
);
create index if not exists utterances_tsv on utterances using gin (tsv);

create table if not exists chapters (
  meeting_id text not null references meetings(id) on delete cascade,
  idx        integer not null,
  title      text not null,
  summary    text not null,
  start_ms   integer not null,
  end_ms     integer not null,
  primary key (meeting_id, idx)
);

create table if not exists action_items (
  id         serial primary key,
  meeting_id text not null references meetings(id) on delete cascade,
  owner      integer,                        -- speaker label; null = unassigned
  text       text not null,
  due        text,
  at_ms      integer not null,
  done       boolean not null default false
);
create index if not exists action_items_meeting on action_items (meeting_id);

create table if not exists summaries (
  meeting_id text not null references meetings(id) on delete cascade,
  template   text not null,                  -- general | decisions | standup | sales | interview
  sections   jsonb not null,                 -- [{ "heading": "...", "bullets": [{ "text": "...", "at_ms": 0 }] }]
  created_at timestamptz not null default now(),
  primary key (meeting_id, template)
);

create table if not exists highlights (
  id         text primary key,               -- short public slug for /c/[id]
  meeting_id text not null references meetings(id) on delete cascade,
  start_ms   integer not null,
  end_ms     integer not null,
  title      text not null,
  quote      text not null,
  why        text,                           -- AI one-liner: why this moment matters
  created_at timestamptz not null default now()
);

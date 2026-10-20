-- Paste this whole file into Supabase -> SQL Editor -> Run.
-- It creates the 8 tables the app needs.

create table if not exists profiles (
  id text primary key,                 -- for now "demo-user"; later the Supabase Auth user id
  display_name text not null default 'Demo User',
  timezone text not null default 'UTC',
  xp integer not null default 0 check (xp >= 0),
  coins integer not null default 0 check (coins >= 0),
  work_start text not null default '09:00',
  work_end text not null default '17:00',
  work_days smallint[] not null default '{1,2,3,4,5}',  -- 0 = Sunday ... 6 = Saturday
  active_theme text not null default 'theme_classic',
  active_character text not null default 'char_sprout',
  free_day_off_month text,             -- "2026-10" = this month's free Day Off card was given
  created_at timestamptz not null default now()
);

create table if not exists day_plans (
  id bigint generated always as identity primary key,
  user_id text not null references profiles(id) on delete cascade,
  date date not null,
  mode text not null default 'timer' check (mode in ('timer', 'deadline', 'flexible')),
  deadline_at timestamptz,
  status text not null default 'planning'
    check (status in ('planning', 'active', 'done', 'failed', 'excused', 'day_off')),
  started_at timestamptz,
  paused_at timestamptz,
  pause_type text check (pause_type in ('pause', 'emergency')),
  total_paused_seconds integer not null default 0,
  regular_paused_seconds integer not null default 0,
  bonus_pause_seconds integer not null default 0,  -- from Pause Pack cards
  flexible_card_used boolean not null default false, -- refunded if the day is restarted
  created_at timestamptz not null default now(),
  unique (user_id, date)               -- one plan per user per day
);

create table if not exists tasks (
  id bigint generated always as identity primary key,
  day_plan_id bigint not null references day_plans(id) on delete cascade,
  title text not null,
  details text not null default '',    -- the dropdown note under a task
  duration_minutes integer check (duration_minutes > 0),  -- null = no time set (deadline/flexible mode)
  is_break boolean not null default false,
  position integer not null,
  status text not null default 'planned'
    check (status in ('planned', 'running', 'completed', 'missed', 'deleted')),
  started_at timestamptz,
  paused_seconds integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- The rewards "ledger": one row for every XP/coins change (and notes like "Used a Day Off card")
create table if not exists reward_events (
  id bigint generated always as identity primary key,
  user_id text not null references profiles(id) on delete cascade,
  xp integer not null default 0,
  coins integer not null default 0,
  reason text not null,
  day_plan_id bigint references day_plans(id) on delete set null,
  task_id bigint references tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Every pause / emergency stop (used for the weekly emergency limit)
create table if not exists pause_events (
  id bigint generated always as identity primary key,
  user_id text not null references profiles(id) on delete cascade,
  day_plan_id bigint not null references day_plans(id) on delete cascade,
  type text not null check (type in ('pause', 'emergency')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- What each user owns from the store (cards, themes, characters)
create table if not exists inventory (
  user_id text not null references profiles(id) on delete cascade,
  item_id text not null,
  quantity integer not null default 0 check (quantity >= 0),
  primary key (user_id, item_id)
);

-- Notes tab: simple to-dos (no timer, no rewards). Can be dragged into the to-do bucket.
create table if not exists notes (
  id bigint generated always as identity primary key,
  user_id text not null references profiles(id) on delete cascade,
  title text not null,
  details text not null default '',
  done boolean not null default false,
  in_bucket boolean not null default false,
  added_to_date date,                  -- set when it was moved into a day's plan
  task_id bigint references tasks(id) on delete set null,  -- the task it became
  created_at timestamptz not null default now()
);

-- Scheduler tab: tasks for a future date. On that date they appear in the bucket.
create table if not exists scheduled_tasks (
  id bigint generated always as identity primary key,
  user_id text not null references profiles(id) on delete cascade,
  title text not null,
  details text not null default '',
  date date not null,
  time text,                           -- "14:30", or null for "any time"
  duration_minutes integer check (duration_minutes > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'added', 'dismissed')),
  task_id bigint references tasks(id) on delete set null,  -- the task it became
  created_at timestamptz not null default now()
);

-- Row Level Security ON with no policies = nobody can read these tables
-- with the public (anon) key. Our backend uses the SECRET key, which skips RLS.
-- When you add real login later, you can add policies here.
alter table profiles enable row level security;
alter table day_plans enable row level security;
alter table tasks enable row level security;
alter table reward_events enable row level security;
alter table pause_events enable row level security;
alter table inventory enable row level security;
alter table notes enable row level security;
alter table scheduled_tasks enable row level security;

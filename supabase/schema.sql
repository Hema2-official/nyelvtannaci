-- counters with no identifier and no free text
create table if not exists telemetry (
	id    bigint generated always as identity primary key,
	at    timestamptz not null default now(),
	kind  text not null,
	props jsonb not null default '{}'::jsonb
);

create index if not exists telemetry_at_idx on telemetry (at desc);
create index if not exists telemetry_kind_at_idx on telemetry (kind, at desc);

-- deliberately sent free text from the user
create table if not exists submissions (
	id        uuid primary key default gen_random_uuid(),
	at        timestamptz not null default now(),
	kind      text not null check (kind in ('report', 'feedback')),
	-- report: the text that was checked, the summaries shown while it ran, the result given.
	input     text,
	summaries jsonb,
	result    jsonb,
	-- report: an optional note from the user. feedback: the whole of it.
	message   text
);

create index if not exists submissions_at_idx on submissions (at desc);

alter table telemetry   enable row level security;
alter table submissions enable row level security;

revoke all on table telemetry, submissions from anon, authenticated;
grant insert on table telemetry, submissions to service_role;


-- 1) Install pg_cron extension
-- 2) Run this to set 90-day telemetry data retention
--
-- select cron.schedule('telemetry-retention', '0 3 * * *', $$
--   delete from telemetry where at < now() - interval '90 days'
-- $$);

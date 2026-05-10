-- Inspector signature profiles (reusable across logs)
create table if not exists saved_inspectors (
  id               uuid primary key default gen_random_uuid(),
  engineer_user_id uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  authorization_no text not null,
  signature_png    text not null,   -- base64 data URI of drawn signature
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table saved_inspectors enable row level security;
create policy "inspectors: own crud" on saved_inspectors for all
  using (auth.uid() = engineer_user_id)
  with check (auth.uid() = engineer_user_id);
create index if not exists saved_inspectors_engineer_idx on saved_inspectors (engineer_user_id);

-- Per-log inspector endorsements
create table if not exists inspector_endorsements (
  id               uuid primary key default gen_random_uuid(),
  log_id           uuid not null references maintenance_logs(id) on delete cascade,
  inspector_id     uuid references saved_inspectors(id) on delete set null,
  inspector_name   text not null,        -- snapshot in case profile is deleted
  authorization_no text not null,
  signature_png    text not null,        -- base64 snapshot of actual signature used
  endorsed_at      timestamptz default now(),
  remarks          text
);
alter table inspector_endorsements enable row level security;
create policy "endorsements: log owner read" on inspector_endorsements for select
  using (
    exists (
      select 1 from maintenance_logs m
      where m.id = inspector_endorsements.log_id
        and m.user_id = auth.uid()
    )
  );
create policy "endorsements: log owner insert" on inspector_endorsements for insert
  with check (
    exists (
      select 1 from maintenance_logs m
      where m.id = inspector_endorsements.log_id
        and m.user_id = auth.uid()
    )
  );
create index if not exists endorsements_log_idx on inspector_endorsements (log_id);

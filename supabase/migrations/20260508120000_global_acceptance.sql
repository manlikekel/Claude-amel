-- ============================================================================
-- AMEL Global Acceptance Migration
-- Adds: components, AD/SB compliance, tool calibration, signatures,
--       fault concurrences, CPD, type ratings, audit log, jobs, profile flags
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Components register (tracked aircraft parts with TSN/TSO/cycles)
-- ----------------------------------------------------------------------------
create table if not exists components (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  aircraft_profile_id uuid references aircraft_profiles(id) on delete set null,
  ata_chapter     text,
  part_number     text not null,
  serial_number   text,
  description     text not null,
  installed_date  date,
  removed_date    date,
  tsn_hours       numeric default 0,         -- time since new
  tso_hours       numeric default 0,         -- time since overhaul
  cycles_total    integer default 0,
  cycles_since_overhaul integer default 0,
  hard_time_limit numeric,                   -- hours; null = on-condition
  status          text default 'installed',  -- installed | removed | scrapped
  remarks         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table components enable row level security;
create policy "components: own read"   on components for select using (auth.uid() = user_id);
create policy "components: own insert" on components for insert with check (auth.uid() = user_id);
create policy "components: own update" on components for update using (auth.uid() = user_id);
create policy "components: own delete" on components for delete using (auth.uid() = user_id);
create index if not exists components_user_idx on components (user_id);
create index if not exists components_aircraft_idx on components (aircraft_profile_id);

-- ----------------------------------------------------------------------------
-- 2. Airworthiness Directives & Service Bulletins compliance
-- ----------------------------------------------------------------------------
create table if not exists ad_sb_compliance (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  aircraft_profile_id uuid references aircraft_profiles(id) on delete set null,
  reference_type  text not null,             -- 'AD' | 'SB' | 'STC'
  reference_number text not null,
  issuing_authority text,                    -- FAA, EASA, NCAA, etc.
  title           text not null,
  effective_date  date,
  compliance_date date,
  next_due_date   date,
  recurring_interval_hours integer,
  recurring_interval_cycles integer,
  status          text default 'open',       -- open | complied | not_applicable | superseded
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table ad_sb_compliance enable row level security;
create policy "adsb: own read"   on ad_sb_compliance for select using (auth.uid() = user_id);
create policy "adsb: own insert" on ad_sb_compliance for insert with check (auth.uid() = user_id);
create policy "adsb: own update" on ad_sb_compliance for update using (auth.uid() = user_id);
create policy "adsb: own delete" on ad_sb_compliance for delete using (auth.uid() = user_id);
create index if not exists adsb_user_idx on ad_sb_compliance (user_id);
create index if not exists adsb_status_idx on ad_sb_compliance (status);

-- ----------------------------------------------------------------------------
-- 3. Tool calibration register
-- ----------------------------------------------------------------------------
create table if not exists tool_calibration (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  tool_id         text not null,             -- internal asset / tag number
  tool_name       text not null,             -- "Torque wrench 0-150Nm"
  manufacturer    text,
  serial_number   text,
  category        text,                      -- torque | electrical | pressure | dimensional
  last_cal_date   date,
  next_cal_date   date not null,
  cal_interval_months integer default 12,
  cal_certificate_url text,
  status          text default 'in_service', -- in_service | due | overdue | out_of_service
  remarks         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table tool_calibration enable row level security;
create policy "tools: own read"   on tool_calibration for select using (auth.uid() = user_id);
create policy "tools: own insert" on tool_calibration for insert with check (auth.uid() = user_id);
create policy "tools: own update" on tool_calibration for update using (auth.uid() = user_id);
create policy "tools: own delete" on tool_calibration for delete using (auth.uid() = user_id);
create index if not exists tools_user_idx on tool_calibration (user_id);
create index if not exists tools_due_idx on tool_calibration (next_cal_date);

-- ----------------------------------------------------------------------------
-- 4. Digital signatures on log entries (and examiner co-sign)
--    The signature column stores a base64 ECDSA signature over the log hash.
--    public_key_jwk lets verifiers reproduce the verification independently.
-- ----------------------------------------------------------------------------
create table if not exists log_signatures (
  id              uuid primary key default gen_random_uuid(),
  log_id          uuid not null references maintenance_logs(id) on delete cascade,
  signer_user_id  uuid not null references auth.users(id) on delete cascade,
  role            text not null,             -- 'engineer' | 'examiner' | 'qa_inspector'
  signed_at       timestamptz not null default now(),
  log_hash        text not null,             -- sha-256 hex of canonical entry payload
  signature       text not null,             -- base64 ECDSA P-256 signature
  public_key_jwk  jsonb not null,            -- signer public key (JWK) for independent verification
  signer_name     text,
  signer_licence_no text,
  remarks         text
);

alter table log_signatures enable row level security;
create policy "log_signatures: read own logs"
  on log_signatures for select
  using (
    exists (
      select 1 from maintenance_logs m
      where m.id = log_signatures.log_id
        and (m.user_id = auth.uid() or auth.uid() = log_signatures.signer_user_id)
    )
  );
create policy "log_signatures: insert as self"
  on log_signatures for insert
  with check (auth.uid() = signer_user_id);
create index if not exists log_signatures_log_idx on log_signatures (log_id);

-- ----------------------------------------------------------------------------
-- 5. Co-sign requests (engineer asks an examiner to sign)
-- ----------------------------------------------------------------------------
create table if not exists cosign_requests (
  id              uuid primary key default gen_random_uuid(),
  log_id          uuid not null references maintenance_logs(id) on delete cascade,
  requester_id    uuid not null references auth.users(id) on delete cascade,
  examiner_email  text not null,
  examiner_user_id uuid references auth.users(id) on delete set null,
  status          text not null default 'pending', -- pending | signed | rejected | expired
  message         text,
  responded_at    timestamptz,
  expires_at      timestamptz default (now() + interval '30 days'),
  created_at      timestamptz not null default now()
);

alter table cosign_requests enable row level security;
create policy "cosign: requester read"
  on cosign_requests for select
  using (auth.uid() = requester_id or auth.uid() = examiner_user_id);
create policy "cosign: requester insert"
  on cosign_requests for insert
  with check (auth.uid() = requester_id);
create policy "cosign: examiner update"
  on cosign_requests for update
  using (auth.uid() = examiner_user_id or auth.uid() = requester_id);
create index if not exists cosign_requester_idx on cosign_requests (requester_id);
create index if not exists cosign_examiner_idx on cosign_requests (examiner_user_id);

-- ----------------------------------------------------------------------------
-- 6. Community fault concurrences (peer review for shared fixes)
-- ----------------------------------------------------------------------------
create table if not exists fault_concurrences (
  id              uuid primary key default gen_random_uuid(),
  fault_id        uuid not null references community_fault_library(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  decision        text not null,             -- 'concur' | 'disagree' | 'needs_clarification'
  remarks         text,
  created_at      timestamptz not null default now(),
  unique (fault_id, user_id)
);

alter table fault_concurrences enable row level security;
create policy "concur: insert as self" on fault_concurrences for insert with check (auth.uid() = user_id);
create policy "concur: delete own"     on fault_concurrences for delete using (auth.uid() = user_id);
create policy "concur: public read"    on fault_concurrences for select using (true);
create index if not exists concur_fault_idx on fault_concurrences (fault_id);

-- ----------------------------------------------------------------------------
-- 7. Continuing Professional Development (CPD) records
-- ----------------------------------------------------------------------------
create table if not exists cpd_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  course_title    text not null,
  provider        text,
  category        text,                      -- type | regulatory | human_factors | fuel_tank_safety | edto
  start_date      date,
  end_date        date,
  hours           numeric not null default 0,
  certificate_url text,
  certificate_no  text,
  framework       text,                      -- which framework this counts toward
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table cpd_records enable row level security;
create policy "cpd: own read"   on cpd_records for select using (auth.uid() = user_id);
create policy "cpd: own insert" on cpd_records for insert with check (auth.uid() = user_id);
create policy "cpd: own update" on cpd_records for update using (auth.uid() = user_id);
create policy "cpd: own delete" on cpd_records for delete using (auth.uid() = user_id);
create index if not exists cpd_user_idx on cpd_records (user_id);

-- ----------------------------------------------------------------------------
-- 8. Type ratings & endorsements
-- ----------------------------------------------------------------------------
create table if not exists type_ratings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  authority       text not null,             -- NCAA, EASA, FAA, etc.
  aircraft_type   text not null,             -- B737NG, A320FAM, EMB-145, etc.
  category        text,                      -- B1.1, B1.2, B2, A1, etc.
  issue_date      date,
  expiry_date     date,
  certificate_no  text,
  practical_assessment_date date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table type_ratings enable row level security;
create policy "tr: own read"   on type_ratings for select using (auth.uid() = user_id);
create policy "tr: own insert" on type_ratings for insert with check (auth.uid() = user_id);
create policy "tr: own update" on type_ratings for update using (auth.uid() = user_id);
create policy "tr: own delete" on type_ratings for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 9. Audit log (org-level + user-level high-value events)
-- ----------------------------------------------------------------------------
create table if not exists audit_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  organization_id uuid references organizations(id) on delete cascade,
  action          text not null,             -- log.create, log.update, log.delete, log.sign, ...
  resource_type   text,
  resource_id     text,
  metadata        jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);

alter table audit_log enable row level security;
create policy "audit: own user read"
  on audit_log for select
  using (auth.uid() = user_id);
create policy "audit: org owner read"
  on audit_log for select
  using (
    organization_id is not null
    and exists (
      select 1 from organization_members om
      where om.organization_id = audit_log.organization_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );
create policy "audit: insert"
  on audit_log for insert
  with check (auth.uid() = user_id or user_id is null);
create index if not exists audit_user_idx on audit_log (user_id, created_at desc);
create index if not exists audit_org_idx on audit_log (organization_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 10. Job board (maintenance opportunities)
-- ----------------------------------------------------------------------------
create table if not exists job_postings (
  id              uuid primary key default gen_random_uuid(),
  posted_by       uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  title           text not null,
  company         text not null,
  location        text not null,
  country         text,
  job_type        text default 'full_time',  -- full_time | contract | line_check | base_check
  required_authority text,                   -- NCAA, EASA, FAA, etc.
  required_categories text[],                -- ['B1.1', 'B2']
  required_aircraft text[],                  -- ['B737NG', 'A320FAM']
  description     text not null,
  salary_min      integer,
  salary_max      integer,
  salary_currency text default 'USD',
  contact_email   text,
  contact_url     text,
  status          text default 'open',       -- open | filled | closed
  posted_at       timestamptz not null default now(),
  expires_at      timestamptz default (now() + interval '90 days')
);

alter table job_postings enable row level security;
create policy "jobs: public read open"
  on job_postings for select
  using (status = 'open' and (expires_at is null or expires_at > now()));
create policy "jobs: poster manage"
  on job_postings for all
  using (auth.uid() = posted_by)
  with check (auth.uid() = posted_by);
create index if not exists jobs_posted_idx on job_postings (posted_at desc);
create index if not exists jobs_country_idx on job_postings (country);

-- ----------------------------------------------------------------------------
-- 11. Profile flags: AME verification + locale + timezone
-- ----------------------------------------------------------------------------
alter table profiles
  add column if not exists ame_verification_status text default 'unverified', -- unverified | pending | verified | rejected
  add column if not exists ame_verification_authority text,
  add column if not exists ame_verification_evidence_url text,
  add column if not exists ame_verified_at timestamptz,
  add column if not exists locale text default 'en',
  add column if not exists timezone text default 'UTC',
  add column if not exists data_residency_region text default 'global';

-- ----------------------------------------------------------------------------
-- 12. Maintenance log additions: cycles + maintenance cycles since maintenance
-- ----------------------------------------------------------------------------
alter table maintenance_logs
  add column if not exists cycles_added integer default 0,
  add column if not exists requires_cosign boolean default false,
  add column if not exists locked_at timestamptz,                   -- once signed, becomes immutable
  add column if not exists source_citation text;                    -- AMM/SB reference required when share_to_community=true

-- ----------------------------------------------------------------------------
-- 13. Updated-at trigger for new tables
-- ----------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create function set_updated_at() returns trigger language plpgsql as $body$
    begin new.updated_at = now(); return new; end $body$;
  end if;
end $$;

create trigger components_updated_at        before update on components        for each row execute function set_updated_at();
create trigger adsb_updated_at              before update on ad_sb_compliance  for each row execute function set_updated_at();
create trigger tools_updated_at             before update on tool_calibration  for each row execute function set_updated_at();
create trigger cpd_updated_at               before update on cpd_records       for each row execute function set_updated_at();
create trigger type_ratings_updated_at      before update on type_ratings      for each row execute function set_updated_at();

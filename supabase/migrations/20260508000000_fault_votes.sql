-- Community fault votes: users can mark a community fault entry as "helpful"
-- One vote per user per fault (enforced by unique constraint).

create table if not exists fault_votes (
  id        uuid primary key default gen_random_uuid(),
  fault_id  uuid not null references community_fault_library(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint fault_votes_unique_per_user unique (fault_id, user_id)
);

alter table fault_votes enable row level security;

-- Any authenticated user can vote
create policy "authenticated users can insert votes"
  on fault_votes for insert
  with check (auth.uid() = user_id);

-- Users can remove their own votes
create policy "users can delete own votes"
  on fault_votes for delete
  using (auth.uid() = user_id);

-- Anyone can read vote counts (needed for aggregation in UI)
create policy "votes are publicly readable"
  on fault_votes for select
  using (true);

-- Index for fast aggregation by fault_id
create index if not exists fault_votes_fault_id_idx on fault_votes (fault_id);

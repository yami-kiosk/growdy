-- Run in Supabase SQL Editor after creating a project.
-- Progress is keyed by burner wallet public key (base58).

create table if not exists public.game_saves (
  wallet_address text primary key,
  save_version int not null default 2,
  save_data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists game_saves_updated_at_idx on public.game_saves (updated_at desc);

alter table public.game_saves enable row level security;

-- Public idle game — anyone can read/write by wallet address (no auth).
-- Progress is not secret; tied to public Solana address.
create policy "game_saves_select"
  on public.game_saves for select
  using (true);

create policy "game_saves_insert"
  on public.game_saves for insert
  with check (true);

create policy "game_saves_update"
  on public.game_saves for update
  using (true);

-- Live presence for "ONLINE NOW" (heartbeat every ~45s from client).
create table if not exists public.player_presence (
  wallet_address text primary key,
  page text not null default 'site',
  last_seen timestamptz not null default now()
);

create index if not exists player_presence_last_seen_idx
  on public.player_presence (last_seen desc);

alter table public.player_presence enable row level security;

create policy "player_presence_select"
  on public.player_presence for select
  using (true);

create policy "player_presence_insert"
  on public.player_presence for insert
  with check (true);

create policy "player_presence_update"
  on public.player_presence for update
  using (true);

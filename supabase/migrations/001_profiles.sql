-- Bingo 2026 shared state table
create table if not exists public.profiles (
  id text primary key,
  name text not null,
  board_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  winner_at timestamptz null
);

insert into public.profiles (id, name)
values
  ('jeon_seungdeok', '전승덕'),
  ('jeon_hyeji', '전혜지'),
  ('seo_hyeonjun', '서현준'),
  ('joo_hyebin', '주혜빈')
on conflict (id) do update
set name = excluded.name;

alter table public.profiles enable row level security;

drop policy if exists profiles_read_all on public.profiles;
drop policy if exists profiles_insert_all on public.profiles;
drop policy if exists profiles_update_all on public.profiles;

create policy profiles_read_all
on public.profiles
for select
using (true);

create policy profiles_insert_all
on public.profiles
for insert
with check (true);

create policy profiles_update_all
on public.profiles
for update
using (true)
with check (true);

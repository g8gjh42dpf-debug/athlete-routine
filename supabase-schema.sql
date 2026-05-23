-- ============================================================
-- ATHLETE ROUTINE — Schéma Supabase
-- Colle ce SQL dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- Table des entrées (night, morning, journal)
create table if not exists public.entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('night', 'morning', 'journal')),
  data jsonb not null default '{}',
  created_at timestamptz default now() not null
);

-- Table des profils (nom, etc.)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  email text,
  created_at timestamptz default now()
);

-- Trigger : crée un profil auto quand un user s'inscrit
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security (RLS)
alter table public.entries enable row level security;
alter table public.profiles enable row level security;

-- Policies : chaque user voit uniquement ses données
create policy "Users see own entries" on public.entries
  for select using (auth.uid() = user_id);

create policy "Users insert own entries" on public.entries
  for insert with check (auth.uid() = user_id);

-- Le coach voit tout (remplace par ton user_id coach)
create policy "Coach sees all entries" on public.entries
  for select using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
      and email = current_setting('app.coach_email', true)
    )
  );

create policy "Coach sees all profiles" on public.profiles
  for select using (true);

create policy "Users see own profile" on public.profiles
  for select using (auth.uid() = id);

-- Index pour les perfs
create index if not exists entries_user_id_idx on public.entries(user_id);
create index if not exists entries_type_idx on public.entries(type);
create index if not exists entries_created_at_idx on public.entries(created_at desc);

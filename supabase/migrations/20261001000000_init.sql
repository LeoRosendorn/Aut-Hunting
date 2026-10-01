-- Aut-Hunting · esquema inicial (spec: docs/SPEC.md → "Esquema de base de datos").
-- Todas las tablas con RLS: cada usuaria ve solo lo suyo (criterio 3).

create type public.hunt_status as enum ('pending','parsing','searching','scoring','done','failed');
create type public.jd_source   as enum ('text','pdf','docx','txt','image');
create type public.cand_stage  as enum ('found','contacted','replied','interview','discarded');

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  locale text not null default 'es' check (locale in ('es','en','pt')),
  created_at timestamptz not null default now()
);

-- Crea el perfil al registrarse (email o Google). Google manda `full_name` o `name`.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case when new.raw_user_meta_data ->> 'locale' in ('es','en','pt')
         then new.raw_user_meta_data ->> 'locale' else 'es' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── hunts ───────────────────────────────────────────────────────────────────
create table public.hunts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  jd_text text not null check (char_length(jd_text) between 200 and 30000),
  jd_source public.jd_source not null,
  country char(2) not null,
  profile_language text not null check (profile_language in ('es','en','pt')),
  requirements jsonb,
  queries jsonb,
  boolean_string text,
  status public.hunt_status not null default 'pending',
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index hunts_user_created_idx on public.hunts (user_id, created_at desc);

-- ── candidates ──────────────────────────────────────────────────────────────
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  linkedin_url text not null,
  name text,
  headline text,
  location text,
  snippet text,
  score smallint check (score between 0 and 100),
  match_reasons jsonb,
  gaps jsonb,
  stage public.cand_stage not null default 'found',
  outreach_short text check (char_length(outreach_short) <= 300),
  outreach_long text check (char_length(outreach_long) <= 1000),
  notes text,
  feedback smallint check (feedback in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hunt_id, linkedin_url)
);
create index candidates_hunt_score_idx on public.candidates (hunt_id, score desc);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger candidates_touch_updated_at
  before update on public.candidates
  for each row execute function public.touch_updated_at();

-- ── usage_events (solo servidor, con la secret key) ─────────────────────────
create table public.usage_events (
  id bigserial primary key,
  user_id uuid references auth.users on delete set null,
  kind text not null check (kind in ('hunt','search_call','llm_call')),
  provider text,
  created_at timestamptz not null default now()
);
create index usage_events_user_kind_idx on public.usage_events (user_id, kind, created_at);
create index usage_events_provider_idx on public.usage_events (provider, created_at);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.hunts        enable row level security;
alter table public.candidates   enable row level security;
alter table public.usage_events enable row level security;  -- sin políticas: nadie salvo la secret key

create policy "profiles: leer el propio"      on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: editar el propio"    on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "hunts: leer los propios"       on public.hunts for select to authenticated using ((select auth.uid()) = user_id);
create policy "hunts: crear propios"          on public.hunts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "hunts: borrar los propios"     on public.hunts for delete to authenticated using ((select auth.uid()) = user_id);
-- Los updates de estado los hace el pipeline en el servidor con la secret key.

create policy "candidates: leer los propios"  on public.candidates for select to authenticated using ((select auth.uid()) = user_id);
create policy "candidates: editar los propios" on public.candidates for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "candidates: borrar los propios" on public.candidates for delete to authenticated using ((select auth.uid()) = user_id);

-- Desde el cliente solo se pueden editar estas columnas (no user_id, hunt_id, score, etc.).
revoke update on public.profiles, public.candidates from authenticated, anon;
grant update (full_name, locale) on public.profiles to authenticated;
grant update (stage, notes, feedback, outreach_short, outreach_long) on public.candidates to authenticated;

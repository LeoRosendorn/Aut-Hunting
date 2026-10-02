-- Cupos diarios controlados por la base de datos (no solo por la app):
--   * se cuentan en usage_events, que la usuaria no puede borrar (RLS sin políticas),
--     así que borrar un hunting no devuelve cupo;
--   * el trigger corre en cualquier INSERT, también si alguien llama a PostgREST directo;
--   * pg_advisory_xact_lock serializa los pedidos simultáneos de la misma usuaria.

create function public.hunts_per_day()
returns int
language sql
immutable
as $$ select 5 $$;

create function public.ai_calls_per_day()
returns int
language sql
immutable
as $$ select 10 $$;

-- Día UTC actual: el cupo se renueva a las 00:00 UTC (lo dice la interfaz).
create function public.start_of_utc_day()
returns timestamptz
language sql
stable
as $$ select date_trunc('day', now() at time zone 'utc') at time zone 'utc' $$;

create function public.enforce_hunt_quota()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  used int;
begin
  perform pg_advisory_xact_lock(hashtextextended('hunt:' || new.user_id::text, 0));

  select count(*) into used
  from public.usage_events
  where user_id = new.user_id
    and kind = 'hunt'
    and created_at >= public.start_of_utc_day();

  if used >= public.hunts_per_day() then
    raise exception 'DAILY_LIMIT' using errcode = 'P0001';
  end if;

  insert into public.usage_events (user_id, kind) values (new.user_id, 'hunt');
  return new;
end;
$$;

create trigger hunts_enforce_quota
  before insert on public.hunts
  for each row execute function public.enforce_hunt_quota();

-- Cupo restante de la usuaria logueada, para mostrarlo en la interfaz.
create function public.hunt_quota()
returns table (remaining int, total int)
language sql
stable
security definer set search_path = ''
as $$
  select greatest(0, public.hunts_per_day() - count(*))::int, public.hunts_per_day()
  from public.usage_events
  where user_id = auth.uid()
    and kind = 'hunt'
    and created_at >= public.start_of_utc_day();
$$;

-- Reserva un uso de IA (Gemini) para la usuaria logueada. Devuelve false si ya no le quedan hoy.
-- Se reserva ANTES de llamar a la IA: los intentos fallidos también cuentan.
create function public.consume_ai_call()
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  used int;
begin
  if uid is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai:' || uid::text, 0));

  select count(*) into used
  from public.usage_events
  where user_id = uid
    and kind = 'llm_call'
    and created_at >= public.start_of_utc_day();

  if used >= public.ai_calls_per_day() then
    return false;
  end if;

  insert into public.usage_events (user_id, kind, provider) values (uid, 'llm_call', 'gemini');
  return true;
end;
$$;

revoke all on function public.enforce_hunt_quota() from public, anon, authenticated;
revoke all on function public.hunt_quota() from public, anon;
revoke all on function public.consume_ai_call() from public, anon;
grant execute on function public.hunt_quota() to authenticated;
grant execute on function public.consume_ai_call() to authenticated;

-- Los huntings creados antes de esta migración también cuentan para el cupo de hoy.
insert into public.usage_events (user_id, kind, created_at)
select user_id, 'hunt', created_at
from public.hunts
where created_at >= public.start_of_utc_day();

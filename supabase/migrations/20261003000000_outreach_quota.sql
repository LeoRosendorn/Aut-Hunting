-- Mensajes de contacto (#5): cupo diario propio, separado del de lectura de archivos.
--   * consume_ai_call()       → leer imágenes / PDF escaneados (10 por día), provider 'gemini'.
--   * consume_outreach_call() → redactar mensajes de contacto (60 por día), provider 'gemini-outreach'.
-- Antes consume_ai_call contaba cualquier llm_call de la usuaria; ahora cada cupo cuenta solo lo suyo.

create function public.outreach_per_day()
returns int
language sql
immutable
as $$ select 60 $$;

create or replace function public.consume_ai_call()
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
    and provider = 'gemini'
    and created_at >= public.start_of_utc_day();

  if used >= public.ai_calls_per_day() then
    return false;
  end if;

  insert into public.usage_events (user_id, kind, provider) values (uid, 'llm_call', 'gemini');
  return true;
end;
$$;

-- Reserva un mensaje de contacto para la usuaria logueada. Devuelve false si ya usó los de hoy.
create function public.consume_outreach_call()
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

  perform pg_advisory_xact_lock(hashtextextended('outreach:' || uid::text, 0));

  select count(*) into used
  from public.usage_events
  where user_id = uid
    and kind = 'llm_call'
    and provider = 'gemini-outreach'
    and created_at >= public.start_of_utc_day();

  if used >= public.outreach_per_day() then
    return false;
  end if;

  insert into public.usage_events (user_id, kind, provider) values (uid, 'llm_call', 'gemini-outreach');
  return true;
end;
$$;

revoke all on function public.consume_outreach_call() from public, anon;
grant execute on function public.consume_outreach_call() to authenticated;

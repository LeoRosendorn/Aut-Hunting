-- Caché de búsquedas de perfiles (Exa / Tavily): la misma consulta en el mismo país se reutiliza
-- durante 7 días sin gastar cupo de los planes gratuitos. Las reclutadoras repiten búsquedas
-- parecidas ("SAP CAR Argentina"), así que cada acierto es una búsqueda gratis.
-- Solo la usa el servidor con la secret key (RLS sin políticas, como usage_events).

create table public.search_cache (
  query_key text primary key,
  provider text not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);
create index search_cache_created_idx on public.search_cache (created_at);

alter table public.search_cache enable row level security;

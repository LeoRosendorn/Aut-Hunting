-- El país de búsqueda puede quedar en "auto": la IA lo deduce de la ubicación de la JD.
alter table public.hunts alter column country type text;
alter table public.hunts add constraint hunts_country_check
  check (country = 'auto' or country ~ '^[A-Z]{2}$');

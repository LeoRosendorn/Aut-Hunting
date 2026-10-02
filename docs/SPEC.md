# [EPIC] Aut-Hunting: hunting de perfiles en LinkedIn con IA a partir de una JD

> Estado: **CONFIRMADO por el usuario (2026-10-01)**. Proveedores verificados: 2026-10-01.

## Context

Las reclutadoras de RRHH hoy hacen el hunting a mano: leen la Job Description (JD), arman búsquedas en LinkedIn, abren perfil por perfil y anotan candidatos en una planilla. Aut-Hunting automatiza ese trabajo. La reclutadora sube la JD en cualquier formato habitual y la app le devuelve **20 a 30 perfiles públicos de LinkedIn ordenados por afinidad**, cada uno con un puntaje, el motivo del puntaje y un mensaje de contacto listo para copiar. Después sigue a cada candidato en un pipeline.

Restricción dura: **costo $0**. Todo corre sobre capas gratuitas: hosting, base de datos, IA y búsqueda. Cada reclutadora tiene su cuenta y sus búsquedas privadas.

## Current State

- `C:\ProjectoFlor\Aut-Hunting\` es un vault de Obsidian con `Bienvenido.md` y `.obsidian/`. **No hay código, ni repo git, ni proyecto en Supabase o Vercel.** Es un proyecto nuevo (greenfield).
- Panorama de proveedores gratuitos, verificado el 2026-10-01:

| Servicio | Plan gratuito | Tarjeta | Uso en Aut-Hunting | Riesgo |
|---|---|---|---|---|
| Google Custom Search | Cerrado a clientes nuevos; se apaga el 1/1/2027 | — | ❌ No se usa | No disponible |
| Brave Search | Sin plan free desde 02/2026 (USD 5 de crédito) | **Sí** | ❌ No se usa | Exige tarjeta |
| **Tavily** | ~1.000 búsquedas/mes, renovables | No | ✅ Buscador principal | Cupo bajo |
| **Serper** | 2.500 búsquedas, por única vez | No | ✅ Respaldo (fallback) | Se agota y no se renueva |
| **Gemini Flash (AI Studio)** | ~1.500 consultas/día | No | ✅ Leer la JD, puntuar, redactar | En la capa free, Google puede usar los datos enviados |
| **Supabase Free** | Auth (email + Google), Postgres de 500 MB | No | ✅ Login + base de datos | Se pausa tras 7 días sin actividad |
| **Vercel Hobby** | Uso no comercial, funciones de hasta 300 s (Fluid Compute) | No | ✅ Hosting | Solo uso no comercial |

## Proposed Change

### Flujo principal

```
Reclutadora ─► Login (email o Google)
           ─► "Nuevo hunting": pega texto o sube archivo + elige país + idioma de los perfiles
           ─► [1] Gemini lee la JD ─► requisitos estructurados (JSON)
           ─► [2] Gemini genera 5 consultas X-ray + 1 string booleano para LinkedIn
           ─► [3] Tavily (fallback Serper) busca en linkedin.com/in ─► se deduplica por URL
           ─► [4] Gemini puntúa cada perfil 0-100 con motivos y brechas
           ─► Resultado: 20-30 perfiles ordenados + string booleano copiable
           ─► Por candidato: "Generar mensaje" ─► copiar ─► "Abrir perfil" (la reclutadora envía a mano)
           ─► Pipeline: Encontrado → Contactado → Respondió → Entrevista → Descartado
```

### Decisiones tomadas en la conversación

| # | Decisión | Elección |
|---|---|---|
| D0 | Fuente de perfiles | X-ray vía API de búsqueda + string booleano. **Sin scraping ni automatización dentro de LinkedIn.** |
| D1 | Cupo de búsqueda | Cupo de la app, compartido, con límite de 5 huntings por usuaria por día |
| D2 | Stack | Next.js + Supabase + Vercel |
| D3 | Idiomas de la interfaz | ES + EN + PT, con selector |
| D4 | Formatos de JD | Texto pegado, PDF, DOCX, TXT, PNG/JPG/WEBP; máximo 4 MB (Vercel Hobby corta los pedidos en 4,5 MB) |
| D5 | Modelo de cuentas | 1 cuenta = 1 persona; búsquedas privadas (RLS) |
| D6 | Extras en el MVP | Mensaje de contacto por candidato + pipeline por búsqueda |
| D7 | Privacidad IA | Se acepta que la capa gratuita de Gemini pueda usar la JD; se avisa en la UI y en `/privacy` |
| D8 | Público | Registro abierto: cualquier reclutadora puede crear su cuenta |

### Implementation Details

**Stack:** Next.js (App Router, última estable) + TypeScript estricto, Tailwind CSS + shadcn/ui, `next-intl` (es, en, pt), `@supabase/ssr`, `@google/genai` (modelo Gemini Flash de la capa gratuita, configurable con la variable `GEMINI_MODEL`), `mammoth` para DOCX, Zod para validar las respuestas de la IA, Vitest + Playwright para tests.

**Diseño visual ("llamativo pero corporativo"):**
- Paleta: azul marino profundo `#0B1F3A` (base), índigo eléctrico `#4F46E5` (primario y CTA), cian `#06B6D4` (acento y puntajes altos), ámbar `#F59E0B` (alertas), neutrales slate.
- Tipografía: *Plus Jakarta Sans* en títulos e *Inter* en el texto. Modo claro y oscuro.
- Puntaje de afinidad como insignia de color: ≥80 cian, 60-79 índigo, <60 slate.
- Accesibilidad: contraste AA en ambos modos.

**Rutas:**

| Ruta | Contenido |
|---|---|
| `/[locale]` | Landing: propuesta de valor, cómo funciona, CTA de registro |
| `/[locale]/login`, `/[locale]/signup` | Email + contraseña, botón "Continuar con Google" |
| `/auth/callback` | Callback OAuth / confirmación de email de Supabase |
| `/[locale]/app` | Dashboard: lista de huntings (título, fecha, estado, cantidad de perfiles) y cupo restante del día |
| `/[locale]/app/hunts/new` | Formulario: textarea o zona de arrastre de archivo, país (ISO-3166), idioma de los perfiles, título opcional |
| `/[locale]/app/hunts/[id]` | Progreso en vivo → tabla de resultados ↔ vista kanban; string booleano copiable |
| `/[locale]/app/settings` | Nombre, idioma, **eliminar cuenta y todos los datos** |

**Esquema de base de datos (Supabase/Postgres):**

```sql
create type hunt_status as enum ('pending','parsing','searching','scoring','done','failed');
create type jd_source   as enum ('text','pdf','docx','txt','image');
create type cand_stage  as enum ('found','contacted','replied','interview','discarded');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  locale text not null default 'es' check (locale in ('es','en','pt')),
  created_at timestamptz not null default now()
);

create table hunts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  jd_text text not null check (char_length(jd_text) between 200 and 30000),
  jd_source jd_source not null,
  country text not null check (country = 'auto' or country ~ '^[A-Z]{2}$'),  -- "auto": la IA lo deduce de la JD
  profile_language text not null check (profile_language in ('es','en','pt')),
  requirements jsonb,          -- salida validada del paso [1]
  queries jsonb,               -- consultas X-ray usadas en el paso [2]
  boolean_string text,
  status hunt_status not null default 'pending',
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references hunts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  linkedin_url text not null,  -- normalizada: https://www.linkedin.com/in/<slug>
  name text, headline text, location text, snippet text,
  score smallint check (score between 0 and 100),
  match_reasons jsonb,         -- string[] (máx. 3)
  gaps jsonb,                  -- string[] (máx. 3)
  stage cand_stage not null default 'found',
  outreach_short text,         -- ≤ 300 caracteres (nota de conexión)
  outreach_long text,          -- ≤ 1000 caracteres (mensaje / InMail)
  notes text,
  feedback smallint check (feedback in (-1,1)),  -- 👍/👎 de la reclutadora
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hunt_id, linkedin_url)
);

create table usage_events (
  id bigserial primary key,
  user_id uuid references auth.users on delete set null,
  kind text not null check (kind in ('hunt','search_call','llm_call')),
  provider text,               -- 'tavily' | 'serper' | 'gemini'
  created_at timestamptz not null default now()
);
create index on usage_events (user_id, kind, created_at);
create index on usage_events (provider, created_at);
```

RLS activado en todas las tablas: `user_id = auth.uid()` (en `profiles`: `id = auth.uid()`). `usage_events` solo se escribe desde el servidor con la service role. **El archivo original de la JD no se guarda; solo el texto extraído.**

**API (Route Handlers, Node runtime):**

| Método y ruta | Entrada | Salida | Notas |
|---|---|---|---|
| `POST /api/hunts` | `multipart/form-data`: `text?`, `file?`, `country`, `profileLanguage`, `title?` | `201 {id}` | Valida cupo y archivo; crea el hunt `pending` y ejecuta el pipeline con `after()`. `maxDuration = 300` |
| `GET /api/hunts/:id` | — | `{status, error_code, candidates_count}` | La UI consulta cada 2 s mientras el estado sea distinto de `done`/`failed` |
| `POST /api/candidates/:id/outreach` | `{language}` | `{short, long}` | Generación bajo demanda; se guarda en el candidato |
| `PATCH /api/candidates/:id` | `{stage?, notes?, feedback?}` | `200` | Mueve el candidato en el kanban o registra 👍/👎 |
| `DELETE /api/hunts/:id` | — | `204` | Borra en cascada |
| `DELETE /api/account` | — | `204` | Borra el usuario y todos sus datos |
| `GET /api/cron/keepalive` | header `CRON_SECRET` | `200` | Vercel Cron diario: hace un `select 1` para que Supabase no se pause |

Códigos de error (`error_code`) con texto traducido en la UI: `JD_TOO_SHORT`, `JD_TOO_LONG`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE`, `JD_UNREADABLE`, `DAILY_LIMIT`, `SEARCH_QUOTA_EXHAUSTED`, `AI_QUOTA_EXHAUSTED`, `NO_RESULTS`, `INTERNAL`.

**Pipeline (`lib/hunting/pipeline.ts`):**
1. **Extracción:** si es DOCX, se usa `mammoth`. Si es PDF o imagen, se le pasa el archivo a Gemini (multimodal). Si es TXT o texto pegado, se usa tal cual. Con menos de 200 caracteres útiles → `JD_UNREADABLE`.
2. **Requisitos:** Gemini devuelve un JSON validado con Zod: `{role_titles[], seniority, must_have_skills[], nice_to_have_skills[], years_min, languages[], location, industry}`. Si el JSON es inválido, se reintenta 1 vez; si vuelve a fallar → `failed`.
3. **Consultas:** se generan 5 consultas, de la más específica a la más amplia, más 1 string booleano para LinkedIn. Las palabras clave van en el idioma de los perfiles y la ubicación sale del país elegido.
4. **Búsqueda:** cada consulta va a Tavily (`include_domains: ["linkedin.com"]`, `max_results: 10`). Si Tavily responde 429, 402 o sin cuota → la misma consulta va a Serper (`site:linkedin.com/in`). Solo se aceptan URLs que matcheen `linkedin.com/in/<slug>`; se normalizan (sin query, sin subdominio de país, en minúsculas) y se deduplican. Si quedan menos de 20 únicos tras 5 consultas, se ejecutan hasta 3 consultas más amplias (**tope duro: 8 llamadas por hunt**).
5. **Puntaje:** una sola llamada a Gemini con los requisitos y hasta 40 perfiles (nombre, titular, snippet). Devuelve por perfil `{score, match_reasons[≤3], gaps[≤3]}`. Se ordena descendente y se guardan los **30 mejores**. Si quedan entre 1 y 19, se guardan igual y se muestra el aviso "Encontramos N perfiles; probá ampliar con el string booleano". Si quedan 0 → `NO_RESULTS`.

**Cupos (`lib/quota.ts`):**
- Por usuaria: **5 huntings por día** (zona UTC), aplicado por un trigger de Postgres que cuenta en `usage_events` (no se puede saltear borrando huntings, insertando por PostgREST ni en paralelo); el límite está en `public.hunts_per_day()`. Al superarlo → `DAILY_LIMIT` con la hora de reinicio.
- Global: se cuentan los `search_call` por proveedor en el mes calendario. Topes configurables (`TAVILY_MONTHLY_CAP=950`, `SERPER_TOTAL_CAP=2400`). Con los dos agotados → `SEARCH_QUOTA_EXHAUSTED` y el dashboard muestra un banner.
- Antes de cada llamada a Gemini se revisa un tope de 1.400 `llm_call` por día; al superarlo → `AI_QUOTA_EXHAUSTED`.

**Mensaje de contacto:** Gemini redacta con el titular y snippet del candidato y los requisitos del hunt. Devuelve una versión corta (≤300 caracteres, para la nota de conexión) y una larga (≤1000). La UI tiene "Copiar" y "Abrir perfil" (nueva pestaña). Al copiar, si el candidato está en `found`, se ofrece pasarlo a `contacted`. **No se envía nada automáticamente.**

**Email:** el SMTP por defecto de Supabase tiene un límite por hora muy bajo. Se configura un SMTP gratuito (Brevo Free, remitente verificado) para la confirmación de cuenta y la recuperación de contraseña.

**Legal / privacidad:**
- Páginas `/[locale]/terms` y `/[locale]/privacy`. Aclaran que solo se procesan datos públicos indexados por buscadores, que la app no accede a LinkedIn ni envía mensajes, que la JD se procesa con Gemini en la capa gratuita y que la usuaria puede borrar todo.
- Aviso visible en el formulario: "No incluyas datos confidenciales del cliente en la JD".

## Child Issues

| # | Título | Prioridad | Esfuerzo (humano / CC) | Depende de |
|---|---|---|---|---|
| 1 | Fundación: scaffold, sistema de diseño, i18n, Supabase, auth email+Google, deploy, keepalive | Critical | 3 d / 45 min | — |
| 2 | Ingesta de JD: formulario, subida, extracción, requisitos | Critical | 2 d / 30 min | 1 |
| 3 | Motor de hunting: consultas, Tavily/Serper, dedupe, puntaje, cupos | Critical | 3 d / 45 min | 2 |
| 4 | Resultados: tabla, progreso en vivo, kanban, notas, string booleano | High | 2 d / 30 min | 3 |
| 5 | Mensaje de contacto por candidato | High | 1 d / 15 min | 4 |
| 6 | Landing, términos, privacidad, settings y borrado de cuenta | Medium | 1,5 d / 20 min | 1 |

## Dependency Graph

```
#1 Fundación ─┬─> #2 Ingesta JD ──> #3 Motor ──> #4 Resultados ──> #5 Mensaje
              └─> #6 Landing / legal / settings  (en paralelo desde #1)
```

**Por qué este orden:** sin auth y RLS (#1) no hay dónde guardar huntings por usuaria. El motor (#3) necesita los requisitos estructurados de #2. El kanban y los mensajes (#4, #5) operan sobre candidatos que solo existen después de #3. La landing no depende de nada salvo del sistema de diseño.

## Acceptance Criteria

1. Una usuaria nueva se registra con email + contraseña, recibe el email de confirmación en menos de 2 min y entra después de confirmar. Sin confirmar, no puede entrar.
2. "Continuar con Google" crea la cuenta y entra en un solo flujo; repetirlo con el mismo email entra a la misma cuenta.
3. La usuaria A no puede leer, editar ni borrar huntings ni candidatos de la usuaria B, ni desde la UI ni llamando la API con IDs ajenos (respuesta 404). Hay un test de RLS que lo verifica.
4. Las 5 JD de prueba en `tests/fixtures/jd/` (texto, PDF, DOCX, TXT, PNG) terminan con estado `done` y **≥20 URLs únicas `linkedin.com/in/`** cada una.
5. El tiempo desde "Buscar" hasta los resultados es ≤90 s en p50 y ≤180 s en p95, medido sobre esas 5 JD.
6. Ningún hunt hace más de 8 llamadas de búsqueda (contadas en `usage_events`).
7. Cada candidato muestra puntaje 0-100, entre 1 y 3 motivos y un link que abre el perfil en otra pestaña. La lista está ordenada por puntaje descendente.
8. **Calidad:** (a) Antes del lanzamiento, el dueño del proyecto revisa el top 10 de las 5 JD de prueba y marca como "relevante" al menos 7 de 10 en promedio; el resultado queda en `tests/eval/relevancia.md`. (b) En producción, cada candidato tiene botones 👍/👎 (columna `candidates.feedback smallint check (feedback in (-1,1))`) y el dashboard de admin (consulta SQL documentada en `docs/metricas.md`) muestra el % de 👍 sobre el total votado del top 10.
9. Un archivo de más de 4 MB o de tipo no soportado se rechaza antes de llamar a cualquier API, con el mensaje traducido.
10. El sexto hunting del día devuelve `DAILY_LIMIT` y la hora de reinicio, sin llamar a Tavily, Serper ni Gemini.
11. Si se simula un 429 de Tavily, el hunt se completa usando Serper.
12. Con los dos proveedores agotados, el hunt falla con `SEARCH_QUOTA_EXHAUSTED` y el dashboard muestra el banner.
13. "Generar mensaje" devuelve una versión corta de ≤300 caracteres y una larga de ≤1000, en el idioma elegido, que mencionan el rol y al menos una habilidad del candidato.
14. Mover un candidato entre las 5 columnas del kanban persiste al recargar.
15. Todas las pantallas tienen textos en ES, EN y PT: no quedan claves sin traducir (lo verifica un script de CI).
16. Lighthouse en la landing y el dashboard: Performance ≥90, Accessibility ≥95, sin errores de contraste AA en modo claro ni oscuro.
17. "Eliminar cuenta" borra el usuario y todas sus filas; un SELECT con service role confirma 0 filas.
18. El cron `keepalive` corre una vez por día y el proyecto de Supabase no se pausa durante 14 días sin usuarias.
19. Costo mensual: USD 0. Ninguna cuenta de proveedor tiene tarjeta cargada.

## Testing Plan

| Capa | Qué | Cantidad |
|---|---|---|
| Unit | Normalización y dedupe de URLs de LinkedIn, esquemas Zod, cálculo de cupos, fallback de proveedores, truncado de mensajes | +20 |
| Integración | Pipeline completo con Tavily, Serper y Gemini mockeados (éxito, 429, JSON inválido, 0 resultados, <20 resultados); políticas RLS contra Supabase local | +10 |
| E2E (Playwright) | Registro email → confirmación → hunt con PDF → resultados → mensaje → kanban; login Google (mock); límite diario; borrar cuenta | +6 |
| Eval manual | Relevancia del top 10 en 5 JD reales (criterio 8) | 1 |

## Rollback Plan

- Cada deploy de Vercel es inmutable: rollback con "Promote" del deploy anterior.
- Las migraciones de Supabase van versionadas en `supabase/migrations/`, cada una con su `down`. En el MVP no hay datos de producción, así que el riesgo es bajo.
- Feature flag `SEARCH_ENABLED=false` para cortar las búsquedas sin bajar la app si un proveedor cambia sus condiciones.

## Effort Estimate

Total ≈ **12,5 días-persona** (≈ 3 h con CC): fundación 3 d + ingesta 2 d + motor 3 d + resultados 2 d + mensaje 1 d + landing/legal 1,5 d.

## Files Reference (a crear)

| Archivo | Cambio |
|---|---|
| `app/[locale]/(marketing)/page.tsx` | Landing |
| `app/[locale]/(auth)/login/page.tsx`, `signup/page.tsx` | Auth |
| `app/auth/callback/route.ts` | Callback de Supabase |
| `app/[locale]/app/page.tsx` | Dashboard |
| `app/[locale]/app/hunts/new/page.tsx` | Formulario de JD |
| `app/[locale]/app/hunts/[id]/page.tsx` | Resultados + kanban |
| `app/[locale]/app/settings/page.tsx` | Ajustes y borrado de cuenta |
| `app/api/hunts/route.ts`, `app/api/hunts/[id]/route.ts` | API de hunts |
| `app/api/candidates/[id]/route.ts`, `.../outreach/route.ts` | API de candidatos |
| `app/api/account/route.ts`, `app/api/cron/keepalive/route.ts` | Cuenta y keepalive |
| `lib/hunting/{pipeline,extract,requirements,queries,search,score}.ts` | Motor |
| `lib/providers/{tavily,serper,gemini}.ts` | Clientes de proveedores |
| `lib/quota.ts`, `lib/linkedin-url.ts` | Cupos y normalización |
| `messages/{es,en,pt}.json` | Traducciones |
| `supabase/migrations/0001_init.sql` | Esquema + RLS |
| `vercel.json` | Cron diario |
| `tests/fixtures/jd/*`, `tests/eval/relevancia.md` | Pruebas |

## Out of Scope

- Scraping de LinkedIn, extensiones de navegador o cualquier automatización con la cuenta de LinkedIn de la usuaria.
- Envío automático de mensajes (LinkedIn, email o WhatsApp).
- Conseguir emails o teléfonos de candidatos.
- Equipos/empresas con búsquedas compartidas, planes pagos, facturación.
- Carga de CVs, reescritura de JD, preguntas de entrevista (issues futuros).
- JD desde un link (URL).
- App móvil nativa.

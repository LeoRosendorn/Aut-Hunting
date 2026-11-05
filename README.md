# AI-Hunting

Aplicación web para reclutadoras: subís una descripción de puesto y devuelve hasta 30 perfiles públicos de LinkedIn ordenados por afinidad, con puntaje, motivos, brechas y un string booleano para seguir buscando a mano.

En producción: <https://aihunting.vercel.app>

> **Cómo se construyó:** el código lo generó [Claude Code](https://claude.com/claude-code). Leonardo Rosendorn definió el producto y sus restricciones, decidió el spec, dirigió al agente y validó el resultado. Por eso los commits llevan `Co-Authored-By: Claude`.

## Qué hace

- Lee la descripción en texto, PDF, Word o imagen.
- Extrae los requisitos y arma las búsquedas.
- Busca perfiles públicos y los puntúa con un LLM.
- Genera un mensaje de contacto personalizado, que la reclutadora copia y envía ella.
- Sigue a cada candidato por etapas, desde encontrado hasta entrevista.

La app no hace scraping ni automatiza nada dentro de LinkedIn: solo trabaja con búsquedas sobre perfiles públicos.

## Stack

Next.js y TypeScript, Supabase (autenticación y Postgres) y Vercel. Para la IA usa Gemini y Groq, y para la búsqueda, Exa con Tavily de respaldo. Todo corre sobre planes gratuitos.

## Arquitectura

| Tema | Decisión | Dónde |
|---|---|---|
| Ejecución | La ruta responde 202 y el trabajo sigue en segundo plano con `after()`. La interfaz lee el estado del hunting. | `app/api/hunts/[id]/run/route.ts` |
| Concurrencia | Un update condicional de `pending` a `parsing` actúa como claim atómico, así dos ejecuciones no se pisan. | `lib/hunting/pipeline.ts` |
| Proveedores | El router prueba Gemini lite, Groq y Gemini Flash, con timeout por intento y presupuesto total. Ante 429, 5xx o timeout, el proveedor queda en pausa uno o dos minutos. | `lib/providers/ai.ts` |
| Salida del LLM | Cada respuesta se valida con Zod. Un JSON inválido se reintenta una vez con el mismo modelo antes de cambiar de proveedor. | `lib/providers/ai.ts` |
| Puntaje | El modelo referencia los perfiles por índice y nunca devuelve nombres ni URLs, así que no puede inventar candidatos. | `lib/hunting/ai-schemas.ts` |
| Datos | Row Level Security en Postgres. Los cupos por usuario se aplican en la base. | `supabase/migrations/` |
| Búsquedas | Una consulta normalizada en el mismo país se reutiliza durante 7 días y no gasta cupo. | `lib/hunting/search-cache.ts` |

## Cómo correrlo

```bash
npm install
cp .env.example .env.local   # completar las variables
npm run dev
```

La puesta en marcha completa está en [`docs/SETUP.md`](docs/SETUP.md) y el spec del producto, en [`docs/SPEC.md`](docs/SPEC.md).

## Tests

```bash
npm test          # tests unitarios con Vitest
npm run check     # i18n, lint, tipos y tests
```

Los tests usan proveedores simulados: comprueban el manejo de errores, no la calidad del puntaje.

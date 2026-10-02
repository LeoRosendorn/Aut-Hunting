import "server-only";
import { HuntError } from "@/lib/hunting/errors";
import type { SearchResult } from "./tavily";

const EXA_TIMEOUT_MS = 25_000;
/** Hasta 25 resultados por búsqueda es el tramo más barato de Exa; con 2-3 consultas se llega a 40-50 perfiles. */
const RESULTS_PER_QUERY = 25;

export function isExaConfigured() {
  return Boolean(process.env.EXA_API_KEY);
}

type ExaResult = { title?: string | null; url?: string; author?: string | null; highlights?: string[]; summary?: string };

/**
 * Búsqueda de personas en Exa (category "people"): devuelve sobre todo perfiles públicos de LinkedIn.
 * `countryCode` es ISO alfa-2 (ej. "AR") y solo sesga los resultados hacia ese país.
 */
export async function searchPeople(query: string, countryCode?: string | null): Promise<SearchResult[]> {
  if (!isExaConfigured()) throw new HuntError("SEARCH_NOT_CONFIGURED");

  let res: Response;
  try {
    res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "x-api-key": process.env.EXA_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        type: "auto",
        category: "people",
        numResults: RESULTS_PER_QUERY,
        ...(countryCode ? { userLocation: countryCode } : {}),
        contents: { highlights: { maxCharacters: 500 } },
      }),
      signal: AbortSignal.timeout(EXA_TIMEOUT_MS),
    });
  } catch {
    throw new HuntError("SEARCH_BUSY");
  }

  // 402: sin créditos. 401/403: clave inválida. 429/5xx: saturado.
  if (res.status === 402) throw new HuntError("SEARCH_QUOTA_EXHAUSTED");
  if (res.status === 401 || res.status === 403) throw new HuntError("SEARCH_NOT_CONFIGURED");
  if (!res.ok) throw new HuntError("SEARCH_BUSY");

  const body = (await res.json()) as { results?: ExaResult[] };
  return (body.results ?? [])
    .filter((r): r is ExaResult & { url: string } => typeof r.url === "string")
    .map((r) => ({
      title: r.title || r.author || "",
      url: r.url,
      content: (r.highlights ?? []).join(" … ") || r.summary || "",
    }));
}

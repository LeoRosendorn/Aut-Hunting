import "server-only";
import { HuntError } from "@/lib/hunting/errors";

export type SearchResult = { title: string; url: string; content: string };

const TAVILY_TIMEOUT_MS = 20_000;

export function isTavilyConfigured() {
  return Boolean(process.env.TAVILY_API_KEY);
}

/**
 * Búsqueda "X-ray" restringida a perfiles de linkedin.com (1 crédito por consulta con search_depth=basic).
 * Es el respaldo de Exa: indexa pocos perfiles (1-3 por consulta en pruebas reales).
 * `country` es el nombre en inglés y en minúsculas que espera Tavily (ej. "argentina").
 */
export async function searchLinkedin(query: string, country?: string): Promise<SearchResult[]> {
  if (!isTavilyConfigured()) throw new HuntError("SEARCH_NOT_CONFIGURED");

  let res: Response;
  try {
    res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.TAVILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 20,
        // "linkedin.com/in" (no "linkedin.com"): si no, Tavily devuelve casi solo publicaciones y ofertas.
        include_domains: ["linkedin.com/in"],
        ...(country ? { country } : {}),
      }),
      signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS),
    });
  } catch {
    throw new HuntError("SEARCH_BUSY");
  }

  // 429: demasiados pedidos por minuto. 432/433: se terminó el cupo del plan gratuito.
  if (res.status === 432 || res.status === 433) throw new HuntError("SEARCH_QUOTA_EXHAUSTED");
  if (res.status === 401 || res.status === 403) throw new HuntError("SEARCH_NOT_CONFIGURED");
  if (!res.ok) throw new HuntError("SEARCH_BUSY");

  const body = (await res.json()) as { results?: Array<Partial<SearchResult>> };
  return (body.results ?? [])
    .filter((r): r is SearchResult => typeof r.url === "string" && typeof r.title === "string")
    .map((r) => ({ title: r.title, url: r.url, content: typeof r.content === "string" ? r.content : "" }));
}

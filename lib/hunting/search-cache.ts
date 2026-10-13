import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchResult } from "@/lib/providers/tavily";

/** Una búsqueda guardada sirve 7 días: los perfiles de LinkedIn no cambian tan rápido. */
export const SEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Misma consulta = mismo texto (sin mayúsculas, tildes ni espacios de más) en el mismo país. */
export function searchCacheKey(query: string, countryCode: string | null) {
  const normalized = query
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return `${countryCode ?? "*"}|${normalized}`;
}

// La caché es una mejora: si la tabla no existe o Supabase falla, el hunting sigue sin ella.

export async function getCachedSearch(admin: SupabaseClient, key: string): Promise<SearchResult[] | null> {
  try {
    const { data, error } = await admin
      .from("search_cache")
      .select("results")
      .eq("query_key", key)
      .gte("created_at", new Date(Date.now() - SEARCH_CACHE_TTL_MS).toISOString())
      .maybeSingle<{ results: SearchResult[] }>();
    if (error) throw error;
    return data?.results ?? null;
  } catch (err) {
    console.error("search_cache get", err);
    return null;
  }
}

export async function putCachedSearch(admin: SupabaseClient, key: string, provider: string, results: SearchResult[]) {
  if (results.length === 0) return;
  try {
    const { error } = await admin
      .from("search_cache")
      .upsert({ query_key: key, provider, results, created_at: new Date().toISOString() });
    if (error) throw error;
  } catch (err) {
    console.error("search_cache put", err);
  }
}

/** Borra las búsquedas vencidas (lo llama el cron diario). */
export async function purgeExpiredSearches(admin: SupabaseClient) {
  const { error } = await admin
    .from("search_cache")
    .delete()
    .lt("created_at", new Date(Date.now() - SEARCH_CACHE_TTL_MS).toISOString());
  if (error) console.error("search_cache purge", error);
}

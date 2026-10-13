import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tope global de búsquedas Tavily por mes (plan gratuito ≈ 1.000 créditos).
 * Se deja margen para no cortar un hunting a mitad de camino.
 */
export const TAVILY_MONTHLY_CAP = Number.parseInt(process.env.TAVILY_MONTHLY_CAP ?? "", 10) || 950;

type Provider = "tavily" | "exa" | "llm";

function startOfUtcMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Búsquedas que quedan este mes para toda la app (cliente con la secret key). */
export async function remainingSearchesThisMonth(admin: SupabaseClient) {
  const { count, error } = await admin
    .from("usage_events")
    .select("id", { head: true, count: "exact" })
    .eq("kind", "search_call")
    .eq("provider", "tavily")
    .gte("created_at", startOfUtcMonth());
  if (error) throw error;
  return TAVILY_MONTHLY_CAP - (count ?? 0);
}

/**
 * Registra una llamada a un proveedor externo para medir el consumo de los planes gratuitos.
 * Las llamadas a la IA del pipeline van sin user_id (provider = el modelo que respondió, ej. "gemini:gemini-flash-lite-latest"): el cupo de IA de la usuaria
 * (`consume_ai_call`, 10/día) es solo para leer archivos y no debe gastarse acá.
 */
export async function recordUsage(admin: SupabaseClient, userId: string, provider: Provider, model?: string) {
  await admin.from("usage_events").insert(
    provider === "llm"
      ? { user_id: null, kind: "llm_call", provider: model ?? "llm" }
      : { user_id: userId, kind: "search_call", provider },
  );
}

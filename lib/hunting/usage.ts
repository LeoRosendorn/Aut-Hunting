import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tope global de búsquedas Tavily por mes (plan gratuito ≈ 1.000 créditos).
 * Se deja margen para no cortar un hunting a mitad de camino.
 */
export const TAVILY_MONTHLY_CAP = Number.parseInt(process.env.TAVILY_MONTHLY_CAP ?? "", 10) || 950;

type Provider = "tavily" | "exa" | "llm";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cupo de hoy = lo que queda del mes repartido entre los días que faltan (hoy incluido).
 * Así un día con mucho uso no deja sin búsquedas al resto del mes, y lo que no se usa un día
 * se suma a los siguientes.
 */
export function dailySearchAllowance({
  cap,
  usedBeforeToday,
  usedToday,
  now = new Date(),
}: {
  cap: number;
  usedBeforeToday: number;
  usedToday: number;
  now?: Date;
}) {
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysLeft = daysInMonth - now.getUTCDate() + 1;
  const allowedToday = Math.floor(Math.max(0, cap - usedBeforeToday) / daysLeft);
  return allowedToday - usedToday;
}

async function countTavilySince(admin: SupabaseClient, since: Date) {
  const { count, error } = await admin
    .from("usage_events")
    .select("id", { head: true, count: "exact" })
    .eq("kind", "search_call")
    .eq("provider", "tavily")
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** Búsquedas Tavily que quedan hoy para toda la app (cliente con la secret key). */
export async function remainingSearchesToday(admin: SupabaseClient, now = new Date()) {
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfDay = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
  const [usedThisMonth, usedToday] = await Promise.all([
    countTavilySince(admin, startOfMonth),
    countTavilySince(admin, startOfDay),
  ]);
  return dailySearchAllowance({ cap: TAVILY_MONTHLY_CAP, usedBeforeToday: usedThisMonth - usedToday, usedToday, now });
}

/**
 * Registra una llamada a un proveedor externo para medir el consumo de los planes gratuitos.
 * Las llamadas a la IA del pipeline van sin user_id: el cupo de IA de la usuaria
 * (`consume_ai_call`, 10/día) es solo para leer archivos y no debe gastarse acá.
 * En ese caso `model` es el que respondió (ej. "gemini:gemini-flash-lite-latest").
 */
export async function recordUsage(admin: SupabaseClient, userId: string, provider: Provider, model?: string) {
  await admin.from("usage_events").insert(
    provider === "llm"
      ? { user_id: null, kind: "llm_call", provider: model ?? "llm" }
      : { user_id: userId, kind: "search_call", provider },
  );
}

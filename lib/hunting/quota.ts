import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cupo diario de huntings. La fuente de verdad es la base de datos
 * (supabase/migrations/20261002010000_quota_enforcement.sql): el trigger rechaza el
 * hunting que se pasa del límite aunque llegue por otro camino o en paralelo.
 */
export async function huntQuota(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("hunt_quota").single<{ remaining: number; total: number }>();
  if (error) throw error;
  return data;
}

/** Reserva un uso de IA para la usuaria logueada; false si ya usó los de hoy. */
export async function consumeAiCall(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("consume_ai_call");
  if (error) throw error;
  return data === true;
}

/** El trigger de cupo lanza `DAILY_LIMIT` (P0001) cuando la usuaria ya creó los de hoy. */
export function isDailyLimitError(error: { code?: string; message?: string } | null) {
  return error?.code === "P0001" && error.message?.includes("DAILY_LIMIT") === true;
}

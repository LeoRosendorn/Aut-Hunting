import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const HUNTS_PER_DAY = Number(process.env.HUNTS_PER_USER_PER_DAY ?? 5);

/** Inicio del día actual en UTC: el cupo diario se reinicia a las 00:00 UTC. */
export function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Huntings que la usuaria todavía puede crear hoy (usa el cliente con su sesión: RLS filtra por usuaria). */
export async function remainingHuntsToday(supabase: SupabaseClient) {
  const { count, error } = await supabase
    .from("hunts")
    .select("id", { head: true, count: "exact" })
    .gte("created_at", startOfUtcDay().toISOString());
  if (error) throw error;
  return Math.max(0, HUNTS_PER_DAY - (count ?? 0));
}

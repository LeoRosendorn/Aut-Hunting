import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { remainingSearchesToday, TAVILY_MONTHLY_CAP } from "@/lib/hunting/usage";

/** Emails con acceso al panel interno (ADMIN_EMAILS, separados por coma). Sin la variable, nadie entra. */
export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

const IN_PROGRESS = new Set(["pending", "parsing", "searching", "scoring"]);

type HuntRow = { status: string; error_code: string | null };
type UsageRow = { kind: string; provider: string | null };

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[key(row)] = (counts[key(row)] ?? 0) + 1;
  return counts;
}

/** Resume los huntings y el consumo de hoy. */
export function summarizeDay(hunts: HuntRow[], events: UsageRow[]) {
  const failed = hunts.filter((h) => h.status === "failed");
  const finished = hunts.filter((h) => h.status === "done").length + failed.length;
  return {
    hunts: {
      total: hunts.length,
      done: hunts.filter((h) => h.status === "done").length,
      failed: failed.length,
      inProgress: hunts.filter((h) => IN_PROGRESS.has(h.status)).length,
      // Sobre los terminados: un hunting en curso todavía no falló ni salió bien.
      errorRate: finished === 0 ? 0 : Math.round((failed.length / finished) * 100),
      errors: countBy(failed, (h) => h.error_code ?? "INTERNAL"),
    },
    ai: countBy(events.filter((e) => e.kind === "llm_call"), (e) => e.provider ?? "llm"),
    searches: countBy(events.filter((e) => e.kind === "search_call"), (e) => e.provider ?? "?"),
  };
}

async function countEvents(admin: SupabaseClient, provider: string, since: Date) {
  const { count, error } = await admin
    .from("usage_events")
    .select("id", { head: true, count: "exact" })
    .eq("kind", "search_call")
    .eq("provider", provider)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** Datos del panel interno (cliente con la secret key). */
export async function loadAdminStats(admin: SupabaseClient, now = new Date()) {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [hunts, events, tavilyMonth, exaMonth, tavilyRemaining, cache] = await Promise.all([
    admin.from("hunts").select("status, error_code").gte("created_at", startOfDay.toISOString()).limit(10_000),
    admin.from("usage_events").select("kind, provider").gte("created_at", startOfDay.toISOString()).limit(10_000),
    countEvents(admin, "tavily", startOfMonth),
    countEvents(admin, "exa", startOfMonth),
    remainingSearchesToday(admin, now),
    admin.from("search_cache").select("query_key", { head: true, count: "exact" }),
  ]);
  if (hunts.error) throw hunts.error;
  if (events.error) throw events.error;

  return {
    ...summarizeDay(hunts.data ?? [], events.data ?? []),
    tavily: { month: tavilyMonth, cap: TAVILY_MONTHLY_CAP, remainingToday: Math.max(0, tavilyRemaining) },
    exaMonth,
    // null: falta correr la migración de la caché (un pedido head a una tabla inexistente da count null, sin error).
    cacheEntries: cache.error ? null : cache.count,
  };
}

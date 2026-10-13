import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isExaConfigured, searchPeople } from "@/lib/providers/exa";
import { generateJson } from "@/lib/providers/ai";
import { searchLinkedin, type SearchResult } from "@/lib/providers/tavily";
import { createAdminClient } from "@/lib/supabase/admin";
import { huntPlanSchema, planPrompt, scoringPrompt, scoringSchema, type HuntPlan } from "./ai-schemas";
import { HuntError } from "./errors";
import { normalizeLinkedinUrl, parseProfileTitle } from "./linkedin";
import { recordUsage, remainingSearchesThisMonth } from "./usage";

/** Con esta cantidad de perfiles únicos ya no se buscan más (se puntúan hasta 40, se guardan 30). */
const TARGET_PROFILES = 40;
const MAX_SAVED = 30;
/** Tope duro de consultas de búsqueda por hunting (spec, criterio 6). */
const MAX_SEARCHES = 8;
/** Pasado este tiempo, un hunting que sigue "en proceso" se considera trabado (la función se cortó). */
export const STALE_AFTER_MS = 6 * 60 * 1000;

type Profile = { url: string; name: string; headline: string | null; snippet: string };

type HuntRow = {
  id: string;
  user_id: string;
  jd_text: string;
  country: string;
  profile_language: "es" | "en" | "pt";
  status: string;
};

/**
 * Corre el hunting completo: lee la JD → busca perfiles → los puntúa → guarda los 30 mejores.
 * Se ejecuta en segundo plano (after()) con la secret key; la usuaria ve el avance por el `status`.
 * Solo arranca si logra "tomar" el hunting (pending → parsing), así dos ejecuciones nunca se pisan.
 */
export async function runHunt(huntId: string, deps = { admin: createAdminClient() }) {
  const { admin } = deps;
  const { data: claimed } = await admin
    .from("hunts")
    .update({ status: "parsing", error_code: null })
    .eq("id", huntId)
    .eq("status", "pending")
    .select("id, user_id, jd_text, country, profile_language, status")
    .maybeSingle<HuntRow>();
  if (!claimed) return;

  try {
    await execute(admin, claimed);
  } catch (err) {
    const code = err instanceof HuntError ? err.code : "INTERNAL";
    if (!(err instanceof HuntError)) console.error("runHunt", huntId, err);
    await admin
      .from("hunts")
      .update({ status: "failed", error_code: code, finished_at: new Date().toISOString() })
      .eq("id", huntId);
  }
}

async function execute(admin: SupabaseClient, hunt: HuntRow) {
  // 1) Leer la JD: requisitos + consultas + string booleano.
  const fixedCountry = hunt.country === "auto" ? null : hunt.country;
  let aiProvider: string | undefined;
  const onProvider = (provider: string) => (aiProvider = provider);
  const plan = await generateJson(planPrompt(hunt.jd_text, hunt.profile_language, fixedCountry), huntPlanSchema, { onProvider });
  await recordUsage(admin, hunt.user_id, "llm", aiProvider);
  const countryCode = fixedCountry ?? plan.country_code;

  await setStatus(admin, hunt.id, "searching", {
    requirements: { ...plan, country_code: countryCode },
    queries: plan.queries,
    boolean_string: plan.boolean_string.slice(0, 600),
  });

  // 2) Buscar perfiles públicos (X-ray en linkedin.com/in).
  const profiles = await collectProfiles(admin, hunt, plan, countryCode);
  if (profiles.length === 0) throw new HuntError("NO_RESULTS");

  // 3) Puntuar con la IA y guardar los mejores.
  await setStatus(admin, hunt.id, "scoring");
  const scoring = await generateJson(
    scoringPrompt(
      plan,
      profiles.map((p, index) => ({ index, name: p.name, headline: p.headline, snippet: p.snippet })),
      hunt.profile_language,
    ),
    scoringSchema,
    { onProvider },
  );
  await recordUsage(admin, hunt.user_id, "llm", aiProvider);

  const rows = scoring.scores
    .filter((s) => s.index < profiles.length && s.score > 0)
    // Un índice repetido por la IA no puede duplicar un candidato.
    .filter((s, i, all) => all.findIndex((o) => o.index === s.index) === i)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SAVED)
    .map((s) => {
      const p = profiles[s.index];
      return {
        hunt_id: hunt.id,
        user_id: hunt.user_id,
        linkedin_url: p.url,
        name: p.name,
        // Exa a veces titula solo con el nombre: entonces se usa el titular que resume la IA.
        headline: p.headline ?? (s.headline.trim().slice(0, 300) || null),
        snippet: p.snippet.slice(0, 600),
        score: s.score,
        match_reasons: s.reasons.slice(0, 3).map((r) => r.slice(0, 140)),
        gaps: s.gaps.slice(0, 3).map((g) => g.slice(0, 140)),
      };
    });
  if (rows.length === 0) throw new HuntError("NO_RESULTS");

  const { error } = await admin.from("candidates").upsert(rows, { onConflict: "hunt_id,linkedin_url", ignoreDuplicates: true });
  if (error) throw error;

  await setStatus(admin, hunt.id, "done", { finished_at: new Date().toISOString() });
}

async function collectProfiles(admin: SupabaseClient, hunt: HuntRow, plan: HuntPlan, countryCode: string | null) {
  const country = countryCode ? new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode)?.toLowerCase() : undefined;
  const byUrl = new Map<string, Profile>();

  // Las consultas de la IA, y si no alcanzan, versiones más amplias (solo puesto + país).
  const broad = [plan.role_title, `${plan.role_title} ${plan.must_have_skills[0] ?? ""}`].map((q) => q.trim());
  const queries = [...new Set([...plan.queries.slice(0, 6), ...broad])].slice(0, MAX_SEARCHES);

  // Exa (categoría "people") encuentra muchos más perfiles; si falla o se queda sin crédito, sigue Tavily.
  let useExa = isExaConfigured();
  for (const query of queries) {
    if (byUrl.size >= TARGET_PROFILES) break;

    if (useExa) {
      try {
        const results = await searchPeople(query, countryCode);
        await recordUsage(admin, hunt.user_id, "exa");
        addProfiles(byUrl, results);
        continue;
      } catch (err) {
        if (!(err instanceof HuntError)) throw err;
        useExa = false;
      }
    }

    if ((await remainingSearchesThisMonth(admin)) <= 0) {
      if (byUrl.size > 0) break; // con lo que hay se puede puntuar
      throw new HuntError("SEARCH_QUOTA_EXHAUSTED");
    }
    const results = await searchLinkedin(query, country);
    await recordUsage(admin, hunt.user_id, "tavily");
    addProfiles(byUrl, results);
  }
  return [...byUrl.values()].slice(0, TARGET_PROFILES);
}

export function addProfiles(byUrl: Map<string, Profile>, results: SearchResult[]) {
  for (const r of results) {
    const url = normalizeLinkedinUrl(r.url);
    if (!url || byUrl.has(url)) continue;
    const { name, headline } = parseProfileTitle(r.title);
    if (!name) continue;
    byUrl.set(url, { url, name, headline, snippet: r.content.replace(/\s+/g, " ").trim().slice(0, 600) });
  }
}

async function setStatus(admin: SupabaseClient, huntId: string, status: string, extra: Record<string, unknown> = {}) {
  const { error } = await admin.from("hunts").update({ status, ...extra }).eq("id", huntId);
  if (error) throw error;
}

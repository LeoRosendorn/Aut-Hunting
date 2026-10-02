import { ArrowLeft, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { CandidateList, type CandidateRow } from "@/components/hunts/candidate-list";
import { CopyButton } from "@/components/hunts/copy-button";
import { HuntProgress } from "@/components/hunts/hunt-progress";
import { StatusBadge, type HuntStatus } from "@/components/hunts/status-badge";
import { LocalTime } from "@/components/local-time";
import { Link } from "@/i18n/navigation";
import { STALE_AFTER_MS } from "@/lib/hunting/pipeline";
import { createClient } from "@/lib/supabase/server";

type Params = PageProps<"/[locale]/app/hunts/[id]">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KNOWN_ERRORS = new Set([
  "AI_BUSY", "AI_NOT_CONFIGURED", "SEARCH_BUSY", "SEARCH_NOT_CONFIGURED", "SEARCH_QUOTA_EXHAUSTED", "NO_RESULTS",
]);

// cache(): generateMetadata y la página comparten una sola consulta por request.
const loadHunt = cache(async (id: string) => {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  // RLS: si el hunting es de otra usuaria, no vuelve ninguna fila → 404 (criterio 3).
  const { data } = await supabase
    .from("hunts")
    .select("id, title, jd_text, jd_source, country, profile_language, status, error_code, requirements, boolean_string, created_at")
    .eq("id", id)
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const hunt = await loadHunt(id);
  return { title: hunt?.title ?? "AI-Hunting" };
}

export default async function HuntPage({ params }: Params) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const hunt = await loadHunt(id);
  if (!hunt) notFound();

  const t = await getTranslations("hunt");
  const tn = await getTranslations("newHunt");
  const status = hunt.status as HuntStatus;

  const regions = new Intl.DisplayNames([locale], { type: "region" });
  const inferred = (hunt.requirements as { country_code?: string | null } | null)?.country_code;
  const country =
    hunt.country !== "auto"
      ? regions.of(hunt.country)
      : inferred
        ? t("countryInferred", { country: regions.of(inferred) ?? inferred })
        : tn("countryAuto");

  let candidates: CandidateRow[] = [];
  if (status === "done") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("candidates")
      .select("id, linkedin_url, name, headline, score, match_reasons, gaps, stage, outreach_short, outreach_long, notes")
      .eq("hunt_id", hunt.id)
      .order("score", { ascending: false })
      // Desempate fijo: con puntajes iguales, el orden no cambia entre recargas (ISSUE-001, /qa 2026-10-02).
      .order("name", { ascending: true })
      .order("id", { ascending: true });
    candidates = (data ?? []) as CandidateRow[];
  }
  const above80 = candidates.filter((c) => (c.score ?? 0) >= 80).length;
  const inProgress = status === "pending" || status === "parsing" || status === "searching" || status === "scoring";
  const ageMs = new Date().getTime() - new Date(hunt.created_at).getTime();
  const stale = inProgress && status !== "pending" && ageMs > STALE_AFTER_MS;

  return (
    <div className="space-y-8">
      <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{hunt.title}</h1>
          <StatusBadge status={status} />
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <div className="flex gap-1.5">
            <dt>{t("source")}:</dt>
            <dd className="text-foreground">{t(`sources.${hunt.jd_source}`)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>{t("country")}:</dt>
            <dd className="text-foreground">{country}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>{t("language")}:</dt>
            <dd className="text-foreground">{tn(`langs.${hunt.profile_language}`)}</dd>
          </div>
          <LocalTime iso={hunt.created_at} className="font-mono" />
        </dl>
      </div>

      {inProgress && (
        <HuntProgress huntId={hunt.id} status={status as "pending" | "parsing" | "searching" | "scoring"} stale={stale} />
      )}

      {status === "failed" && (
        <p role="alert" className="flex items-start gap-3 rounded-xl bg-destructive/10 p-5 text-destructive">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          {t(`errors.${KNOWN_ERRORS.has(hunt.error_code ?? "") ? hunt.error_code : "INTERNAL"}`)}
        </p>
      )}

      {status === "done" && (
        <section className="space-y-4">
          <p className="text-muted-foreground">
            {t.rich("summary", {
              total: candidates.length,
              above: above80,
              n: (chunks) => <span className="font-mono font-semibold text-foreground">{chunks}</span>,
            })}
          </p>
          <CandidateList candidates={candidates} />
        </section>
      )}

      {hunt.boolean_string && (
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{t("booleanTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("booleanHint")}</p>
            </div>
            <CopyButton text={hunt.boolean_string} label={t("copy")} copiedLabel={t("copied")} />
          </div>
          <code className="block rounded-lg bg-muted p-3 font-mono text-[13px] break-words whitespace-pre-wrap">
            {hunt.boolean_string}
          </code>
        </section>
      )}

      <details className="group rounded-xl border bg-card" open={!inProgress && status !== "done"}>
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 font-semibold">
          {t("jdTitle")}
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {tn("chars", { count: hunt.jd_text.length })}
          </span>
        </summary>
        <div className="max-h-[28rem] overflow-y-auto border-t px-5 py-4 text-[15px] leading-relaxed whitespace-pre-wrap">
          {hunt.jd_text}
        </div>
      </details>
    </div>
  );
}

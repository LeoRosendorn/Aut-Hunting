import { ArrowLeft, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StatusBadge, type HuntStatus } from "@/components/hunts/status-badge";
import { LocalTime } from "@/components/local-time";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

type Params = PageProps<"/[locale]/app/hunts/[id]">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadHunt(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  // RLS: si el hunting es de otra usuaria, no vuelve ninguna fila → 404 (criterio 3).
  const { data } = await supabase
    .from("hunts")
    .select("id, title, jd_text, jd_source, country, profile_language, status, created_at")
    .eq("id", id)
    .maybeSingle();
  return data;
}

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
  const country =
    hunt.country === "auto"
      ? tn("countryAuto")
      : new Intl.DisplayNames([locale], { type: "region" }).of(hunt.country);

  return (
    <div className="space-y-8">
      <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{hunt.title}</h1>
          <StatusBadge status={hunt.status as HuntStatus} />
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

      {hunt.status === "pending" && (
        <div role="status" className="flex gap-3 rounded-xl border bg-accent p-5 text-accent-foreground">
          <CircleCheck className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">{t("pendingTitle")}</p>
            <p className="mt-1 text-sm opacity-90">{t("pendingBody")}</p>
          </div>
        </div>
      )}

      <details className="group rounded-xl border bg-card" open>
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

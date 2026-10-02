import { Plus, Radar } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { STAGE_DOT } from "@/components/hunts/stage-styles";
import { StatusBadge, type HuntStatus } from "@/components/hunts/status-badge";
import { LocalTime } from "@/components/local-time";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { STAGES, type Stage } from "@/lib/hunting/pipeline-stages";
import { huntQuota } from "@/lib/hunting/quota";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/app">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("dashboard") };
}

export default async function DashboardPage({ params }: PageProps<"/[locale]/app">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const th = await getTranslations("hunt");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const [{ data: profile }, { data: hunts }, { remaining, total }, { data: tracked }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", auth.user!.id).maybeSingle(),
    supabase.from("hunts").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(50),
    huntQuota(supabase),
    // Solo los candidatos que ya avanzaron en el pipeline: el resumen por hunting.
    supabase.from("candidates").select("hunt_id, stage").neq("stage", "found").limit(1000),
  ]);
  const pipeline = new Map<string, Partial<Record<Stage, number>>>();
  for (const c of (tracked ?? []) as { hunt_id: string; stage: Stage }[]) {
    const counts = pipeline.get(c.hunt_id) ?? {};
    counts[c.stage] = (counts[c.stage] ?? 0) + 1;
    pipeline.set(c.hunt_id, counts);
  }
  const name = profile?.full_name?.split(" ")[0] || auth.user!.email?.split("@")[0] || "";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{t("greeting", { name })}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Link href="/app/hunts/new" className={cn(buttonVariants({ size: "lg" }), "h-12 px-5 text-base")}>
            <Plus />
            {t("newHunt")}
          </Link>
          <p className="text-sm text-muted-foreground">
            {remaining > 0
              ? t("quotaLeft", { remaining, total })
              : t("quotaNone", { total })}
          </p>
        </div>
      </div>

      {hunts && hunts.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">{t("historyTitle")}</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {hunts.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/app/hunts/${h.id}`}
                  className="flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <span className="min-w-0 space-y-1">
                    <span className="block truncate font-semibold">{h.title}</span>
                    {pipeline.has(h.id) && (
                      <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {STAGES.filter((s) => pipeline.get(h.id)?.[s]).map((s) => (
                          <span key={s} className="inline-flex items-center gap-1.5">
                            <span aria-hidden className={cn("size-1.5 rounded-full", STAGE_DOT[s])} />
                            {th(`stages.${s}`)}
                            <span className="font-mono font-semibold text-foreground tabular-nums">{pipeline.get(h.id)?.[s]}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={h.status as HuntStatus} />
                    <LocalTime iso={h.created_at} className="min-w-32 font-mono text-xs text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="flex flex-col items-start gap-4 rounded-xl border border-dashed bg-card px-6 py-12 sm:px-10">
          <Radar className="size-8 text-primary" />
          <h2 className="text-xl font-bold">{t("emptyTitle")}</h2>
          <p className="max-w-md text-muted-foreground">{t("emptyBody")}</p>
          <Link href="/app/hunts/new" className={buttonVariants({ size: "lg" })}>
            <Plus />
            {t("newHunt")}
          </Link>
        </section>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isAdminEmail, loadAdminStats } from "@/lib/admin/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/admin">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("title"), robots: { index: false } };
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function Breakdown({ title, counts, empty }: { title: string; counts: Record<string, number>; empty: string }) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map(([key, count]) => (
            <li key={key} className="flex justify-between gap-4">
              <span className="truncate font-mono">{key}</span>
              <span className="tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Panel interno: consumo de los planes gratuitos y errores de hoy (solo ADMIN_EMAILS). */
export default async function AdminPage({ params }: PageProps<"/[locale]/app/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!isAdminEmail(auth.user?.email)) notFound();

  const t = await getTranslations("admin");
  const stats = await loadAdminStats(createAdminClient());

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("huntsToday")} value={stats.hunts.total} />
        <Stat label={t("done")} value={stats.hunts.done} />
        <Stat label={t("inProgress")} value={stats.hunts.inProgress} />
        <Stat label={t("errorRate")} value={`${stats.hunts.errorRate}%`} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("tavilyRemainingToday")} value={stats.tavily.remainingToday} />
        <Stat label={t("tavilyMonth")} value={`${stats.tavily.month} / ${stats.tavily.cap}`} />
        <Stat label={t("exaMonth")} value={stats.exaMonth} />
        <Stat label={t("cacheEntries")} value={stats.cacheEntries ?? t("cacheMissing")} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Breakdown title={t("errorsToday")} counts={stats.hunts.errors} empty={t("none")} />
        <Breakdown title={t("aiToday")} counts={stats.ai} empty={t("none")} />
        <Breakdown title={t("searchesToday")} counts={stats.searches} empty={t("none")} />
      </div>
    </div>
  );
}

import { Plus, Radar } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const HUNTS_PER_DAY = Number(process.env.HUNTS_PER_USER_PER_DAY ?? 5);

export async function generateMetadata({ params }: PageProps<"/[locale]/app">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("dashboard") };
}

export default async function DashboardPage({ params }: PageProps<"/[locale]/app">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const name = profile?.full_name?.split(" ")[0] || auth.user!.email?.split("@")[0] || "";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold">{t("greeting", { name })}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{t("quota", { remaining: HUNTS_PER_DAY, total: HUNTS_PER_DAY })}</Badge>
          {/* Se habilita con el issue #3 (ingesta de JD). */}
          <Button size="lg" className="h-11" disabled title={t("comingSoon")}>
            <Plus />
            {t("newHunt")}
          </Button>
        </div>
      </div>

      <section className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4f46e5] to-[#06b6d4] text-white shadow-lg shadow-indigo-500/20">
          <Radar className="size-8" />
        </div>
        <h2 className="text-xl font-bold">{t("emptyTitle")}</h2>
        <p className="max-w-md text-muted-foreground">{t("emptyBody")}</p>
      </section>
    </div>
  );
}

import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NewHuntForm } from "@/components/hunts/new-hunt-form";
import { Link } from "@/i18n/navigation";
import { HUNTS_PER_DAY, remainingHuntsToday } from "@/lib/hunting/quota";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/hunts/new">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "newHunt" });
  return { title: t("title") };
}

export default async function NewHuntPage({ params }: PageProps<"/[locale]/app/hunts/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("newHunt");
  const td = await getTranslations("dashboard");
  const th = await getTranslations("hunt");

  const remaining = await remainingHuntsToday(await createClient());

  return (
    <div className="space-y-8">
      <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {th("back")}
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {remaining > 0
            ? td("quotaLeft", { remaining, total: HUNTS_PER_DAY })
            : td("quotaNone", { total: HUNTS_PER_DAY })}
        </p>
      </div>
      <NewHuntForm remaining={remaining} />
    </div>
  );
}

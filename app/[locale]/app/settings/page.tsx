import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeleteAccount } from "@/components/settings/delete-account";
import { ProfileForm } from "@/components/settings/profile-form";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/settings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("settings") };
}

export default async function SettingsPage({ params }: PageProps<"/[locale]/app/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", auth.user!.id).maybeSingle();
  const email = auth.user!.email ?? "";

  return (
    <div className="max-w-2xl space-y-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">{t("profileTitle")}</h2>
        <ProfileForm fullName={profile?.full_name ?? ""} email={email} />
      </section>

      <section className="space-y-4 rounded-xl border border-destructive/30 bg-card p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-destructive">{t("deleteTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("deleteBody")}</p>
        </div>
        <DeleteAccount email={email} />
      </section>
    </div>
  );
}

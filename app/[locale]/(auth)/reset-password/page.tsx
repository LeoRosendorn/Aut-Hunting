import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordForm } from "@/components/auth/password-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("resetTitle") };
}

/** Destino del link de "olvidé mi contraseña": /auth/callback ya abrió la sesión de recuperación. */
export default async function ResetPasswordPage({ params }: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <AuthShell>
      <PasswordForm mode="reset" />
    </AuthShell>
  );
}

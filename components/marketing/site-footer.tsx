import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
import { CONTACT_EMAIL } from "@/lib/contact";

/** Pie de las páginas públicas: aviso de privacidad y links legales. */
export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted-foreground md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-2">
          <Logo className="text-foreground" />
          <p>{t("disclaimer")}</p>
        </div>
        <nav aria-label={t("legal")} className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/privacy" className="hover:text-foreground">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {t("terms")}
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">
            {t("contact")}
          </a>
        </nav>
      </div>
    </footer>
  );
}

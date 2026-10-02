import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/brand/locale-switcher";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Link } from "@/i18n/navigation";

/** Pantalla partida: panel de marca a la izquierda (desktop) y formulario a la derecha. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("landing");

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="relative">
          <Logo className="text-white [&_.text-primary]:text-teal-300 [&>span:first-child]:bg-teal-600" />
        </Link>
        <div className="relative max-w-md space-y-4">
          <h2 className="text-4xl leading-tight font-extrabold">{t("title")}</h2>
          <p className="text-lg text-white/75">{t("subtitle")}</p>
        </div>
        <p className="relative text-sm text-white/60">{t("footnote")}</p>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}

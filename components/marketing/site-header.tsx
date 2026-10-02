import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/brand/locale-switcher";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Encabezado de las páginas públicas (landing, privacidad, términos). */
export function SiteHeader() {
  const nav = useTranslations("nav");

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" aria-label="AI-Hunting">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          {/* En celular solo "Ingresar": "Empezar gratis" ya está en el hero. */}
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            {nav("login")}
          </Link>
          <Link href="/signup" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
            {nav("signup")}
          </Link>
        </nav>
      </div>
    </header>
  );
}

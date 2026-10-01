import { LogOut } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/brand/locale-switcher";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/[locale]/app">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  // El proxy ya protege /app; esto cubre el caso de sesión revocada entre el proxy y el render.
  if (!data.user) return redirect({ href: "/login", locale: await getLocale() });

  const t = await getTranslations("nav");
  const email = data.user.email ?? "";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/app" aria-label={t("dashboard")}>
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <span className="mr-2 hidden max-w-[16rem] truncate text-sm text-muted-foreground md:inline">{email}</span>
            <LocaleSwitcher />
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut />
                <span className="hidden sm:inline">{t("logout")}</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
    </div>
  );
}

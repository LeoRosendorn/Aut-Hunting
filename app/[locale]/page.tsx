import { ArrowRight, FileText, Radar, Send, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/brand/locale-switcher";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Versión inicial de la landing; el issue #7 la completa (secciones, términos y privacidad).
export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const nav = await getTranslations("nav");

  const steps = [
    { icon: FileText, title: t("step1Title"), body: t("step1Body") },
    { icon: Radar, title: t("step2Title"), body: t("step2Body") },
    { icon: Send, title: t("step3Title"), body: t("step3Body") },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
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

      <main className="flex-1">
        <section className="relative overflow-hidden bg-brand-navy text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(79,70,229,0.55),transparent),radial-gradient(40rem_24rem_at_0%_110%,rgba(6,182,212,0.35),transparent)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-24 sm:py-32">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-medium text-cyan-200">
              <ShieldCheck className="size-4" />
              {t("badge")}
            </span>
            <h1 className="max-w-3xl text-4xl leading-[1.05] font-extrabold sm:text-6xl">
              {t("title")}
            </h1>
            <p className="max-w-2xl text-lg text-white/75 sm:text-xl">{t("subtitle")}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: "lg" }), "h-12 bg-white px-6 text-base text-brand-navy hover:bg-white/90")}
              >
                {t("cta")}
                <ArrowRight />
              </Link>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 border-white/25 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white")}
              >
                {t("secondaryCta")}
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="mb-10 text-3xl font-bold">{t("stepsTitle")}</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative rounded-2xl border bg-card p-6 shadow-sm">
                <span className="absolute top-6 right-6 font-heading text-5xl font-extrabold text-muted">{i + 1}</span>
                <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#06b6d4] text-white shadow-lg shadow-indigo-500/20">
                  <Icon className="size-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold">{title}</h3>
                <p className="text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Logo className="text-foreground" />
          <p>{t("footnote")}</p>
        </div>
      </footer>
    </div>
  );
}

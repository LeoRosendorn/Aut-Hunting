import {
  ArrowRight,
  Check,
  Copy,
  FileText,
  Globe,
  KanbanSquare,
  ListOrdered,
  MessageSquareText,
  Radar,
  Search,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { STAGE_DOT } from "@/components/hunts/stage-styles";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { STAGES } from "@/lib/hunting/pipeline-stages";
import { cn } from "@/lib/utils";

type Feature = { title: string; body: string };
type PreviewRow = { name: string; headline: string; score: number };
type Faq = { q: string; a: string };

const FEATURE_ICONS: LucideIcon[] = [ListOrdered, MessageSquareText, KanbanSquare, Search, FileText, Globe];

export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const th = await getTranslations("hunt");

  const steps = [
    { icon: FileText, title: t("step1Title"), body: t("step1Body") },
    { icon: Radar, title: t("step2Title"), body: t("step2Body") },
    { icon: Send, title: t("step3Title"), body: t("step3Body") },
  ];
  const features = t.raw("features") as Feature[];
  const preview = t.raw("preview") as PreviewRow[];
  const trust = t.raw("trust") as string[];
  const faq = t.raw("faq") as Faq[];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-brand-navy text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(45,212,191,0.28),transparent),radial-gradient(40rem_24rem_at_0%_110%,rgba(8,145,178,0.3),transparent)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:py-28 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col items-start gap-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-medium text-teal-200">
                <ShieldCheck className="size-4" />
                {t("badge")}
              </span>
              <h1 className="max-w-3xl text-4xl leading-[1.05] font-extrabold sm:text-6xl">{t("title")}</h1>
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
              <p className="text-sm text-white/60">{t("heroNote")}</p>
            </div>

            {/* Vista previa ilustrativa del resultado (datos ficticios). */}
            <figure aria-label={t("previewLabel")} className="rounded-2xl border border-white/10 bg-white p-1.5 text-brand-navy shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between gap-3 rounded-t-xl border-b border-slate-200 px-4 py-3">
                <p className="truncate font-heading text-sm font-bold">{t("previewTitle")}</p>
                <span className="shrink-0 rounded-md bg-teal-700 px-2 py-0.5 text-xs font-semibold text-white">{t("previewStatus")}</span>
              </div>
              <ol className="divide-y divide-slate-200">
                {preview.map((p, i) => (
                  <li key={p.name} className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-3 px-4 py-3">
                    <span className={cn("font-mono text-2xl font-bold tracking-tighter tabular-nums", p.score >= 80 ? "text-teal-700" : "text-slate-700")}>
                      {p.score}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{p.name}</span>
                      <span className="block truncate text-xs text-slate-500">{p.headline}</span>
                    </span>
                    {i === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-2 py-1 text-xs font-semibold text-white">
                        <Copy className="size-3" />
                        {th("copy")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
                        <span aria-hidden className={cn("size-1.5 rounded-full", i === 1 ? "bg-cyan-600" : "bg-slate-400")} />
                        {th(i === 1 ? "stages.contacted" : "stages.found")}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              <p className="rounded-b-xl bg-slate-50 px-4 py-2.5 text-[11px] text-slate-500">{t("previewNote")}</p>
            </figure>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="mb-10 text-3xl font-bold sm:text-4xl">{t("stepsTitle")}</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative rounded-2xl border bg-card p-6 shadow-sm">
                <span className="absolute top-6 right-6 font-heading text-5xl font-extrabold text-muted">{i + 1}</span>
                <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="size-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold">{title}</h3>
                <p className="text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Funcionalidades */}
        <section className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="mb-12 max-w-2xl space-y-3">
              <h2 className="text-3xl font-bold sm:text-4xl">{t("featuresTitle")}</h2>
              <p className="text-lg text-muted-foreground">{t("featuresSubtitle")}</p>
            </div>
            <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => {
                const Icon = FEATURE_ICONS[i] ?? Check;
                return (
                  <li key={f.title} className="space-y-2">
                    <Icon className="size-6 text-primary" />
                    <h3 className="text-lg font-bold">{f.title}</h3>
                    <p className="text-muted-foreground">{f.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Pipeline */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold sm:text-4xl">{t("pipelineTitle")}</h2>
              <p className="text-lg text-muted-foreground">{t("pipelineBody")}</p>
            </div>
            <ol className="flex flex-wrap items-center gap-2">
              {STAGES.filter((s) => s !== "discarded").map((s, i, all) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 font-medium shadow-sm">
                    <span aria-hidden className={cn("size-2.5 rounded-full", STAGE_DOT[s])} />
                    {th(`stages.${s}`)}
                  </span>
                  {i < all.length - 1 && <ArrowRight aria-hidden className="size-4 text-muted-foreground" />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Transparencia */}
        <section className="bg-brand-navy text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold sm:text-4xl">{t("trustTitle")}</h2>
              <p className="text-lg text-white/70">{t("trustBody")}</p>
              <Link href="/privacy" className="inline-flex items-center gap-1.5 font-semibold text-teal-300 underline-offset-4 hover:underline">
                {t("trustLink")}
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {trust.map((item) => (
                <li key={item} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-300" />
                  <span className="text-white/85">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Preguntas frecuentes */}
        <section className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="mb-8 text-3xl font-bold sm:text-4xl">{t("faqTitle")}</h2>
          <div className="divide-y rounded-xl border bg-card">
            {faq.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {item.q}
                  <span aria-hidden className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="flex flex-col items-start gap-6 rounded-2xl bg-primary px-6 py-12 text-primary-foreground sm:px-12 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">{t("finalTitle")}</h2>
              <p className="text-lg opacity-85">{t("finalBody")}</p>
            </div>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "h-12 shrink-0 bg-background px-6 text-base text-foreground hover:bg-background/90")}
            >
              {t("cta")}
              <ArrowRight />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

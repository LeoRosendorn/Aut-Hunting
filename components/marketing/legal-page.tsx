import { getTranslations } from "next-intl/server";
import { CONTACT_EMAIL } from "@/lib/contact";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type Section = { title: string; body: string[] };

/** Inserta el email de contacto como link donde el texto dice {email}. */
function withEmail(text: string) {
  const parts = text.split("{email}");
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <a key={i} href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </a>,
          part,
        ],
  );
}

/** Página legal (privacidad / términos) armada desde `legal.<doc>` de messages/*.json. */
export async function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const t = await getTranslations(`legal.${doc}`);
  const tl = await getTranslations("legal");
  const sections = t.raw("sections") as Section[];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <article className="space-y-10">
          <header className="space-y-3 border-b pb-8">
            <h1 className="text-4xl font-extrabold">{t("title")}</h1>
            <p className="font-mono text-sm text-muted-foreground">{tl("updated", { date: tl("updatedDate") })}</p>
            <p className="text-lg text-muted-foreground">{withEmail(t.raw("intro") as string)}</p>
          </header>
          {sections.map((s, i) => (
            <section key={s.title} className="space-y-3">
              <h2 className="text-xl font-bold">
                <span className="mr-2 font-mono text-muted-foreground">{i + 1}.</span>
                {s.title}
              </h2>
              {s.body.map((p) => (
                <p key={p} className="leading-relaxed">
                  {withEmail(p)}
                </p>
              ))}
            </section>
          ))}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

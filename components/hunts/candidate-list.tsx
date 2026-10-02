import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CandidateRow = {
  id: string;
  linkedin_url: string;
  name: string | null;
  headline: string | null;
  score: number | null;
  match_reasons: string[] | null;
  gaps: string[] | null;
};

function scoreTone(score: number) {
  if (score >= 80) return "text-primary";
  if (score >= 60) return "text-foreground";
  return "text-muted-foreground";
}

/** Ranking: el puntaje es un número grande (DESIGN: "el puntaje es tipografía"), filas sin tarjetas. */
export function CandidateList({ candidates }: { candidates: CandidateRow[] }) {
  const t = useTranslations("hunt");

  return (
    <ol className="divide-y rounded-xl border bg-card">
      {candidates.map((c, i) => {
        const score = c.score ?? 0;
        return (
          <li
            key={c.id}
            className="grid animate-in fade-in slide-in-from-bottom-1 grid-cols-[3.5rem_1fr] gap-x-4 gap-y-3 p-4 fill-mode-both sm:grid-cols-[4.5rem_1fr_auto] sm:p-5"
            style={{ animationDelay: `${Math.min(i, 15) * 40}ms` }}
          >
            <div className={cn("font-mono text-3xl leading-none font-bold tracking-tighter tabular-nums sm:text-4xl", scoreTone(score))}>
              <span className="sr-only">{t("scoreLabel")}: </span>
              {score}
            </div>
            <div className="min-w-0">
              <p className="font-heading text-base font-bold">{c.name}</p>
              {c.headline && <p className="mt-0.5 text-sm text-muted-foreground">{c.headline}</p>}
              {((c.match_reasons?.length ?? 0) > 0 || (c.gaps?.length ?? 0) > 0) && (
                <div className="mt-3 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                  <ul className="space-y-1">
                    {c.match_reasons?.map((r) => (
                      <li key={r} className="flex gap-1.5">
                        <span aria-hidden className="font-bold text-primary">+</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-1 text-muted-foreground">
                    {c.gaps?.map((g) => (
                      <li key={g} className="flex gap-1.5">
                        <span aria-hidden className="font-bold">−</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="col-start-2 flex items-start sm:col-start-3">
              <a
                href={c.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                {t("viewProfile")}
                <ExternalLink />
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

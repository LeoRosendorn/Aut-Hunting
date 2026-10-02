"use client";

import { Check, Loader2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = ["parsing", "searching", "scoring"] as const;
type Step = (typeof STEPS)[number];
const POLL_MS = 3000;

/**
 * Avance en vivo del hunting: refresca la página del servidor cada 3 s hasta que termina.
 * Si quedó trabado (la función en segundo plano se cortó) o nunca arrancó, ofrece relanzarlo.
 */
export function HuntProgress({ huntId, status, stale }: { huntId: string; status: "pending" | Step; stale: boolean }) {
  const t = useTranslations("hunt");
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const needsRun = status === "pending" || stale;

  useEffect(() => {
    if (needsRun) return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [needsRun, router]);

  async function run() {
    setRetrying(true);
    await fetch(`/api/hunts/${huntId}/run`, { method: "POST" }).catch(() => null);
    router.refresh();
    setRetrying(false);
  }

  const current = status === "pending" ? -1 : STEPS.indexOf(status);

  return (
    <section aria-live="polite" className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current && !stale;
          return (
            <li key={step} className={cn("border-t-[3px] pt-3", done || active ? "border-primary" : "border-border")}>
              <span className={cn("flex items-center gap-2 text-sm", done || active ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {done ? <Check className="size-4 text-primary" /> : active ? <Loader2 className="size-4 animate-spin text-primary" /> : null}
                {i + 1} · {t(`steps.${step}`)}
              </span>
            </li>
          );
        })}
      </ol>

      {needsRun ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t(stale ? "staleBody" : "pendingRunBody")}</p>
          <Button onClick={run} disabled={retrying}>
            {retrying ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            {t(stale ? "retry" : "runNow")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("progressHint")}</p>
      )}
    </section>
  );
}

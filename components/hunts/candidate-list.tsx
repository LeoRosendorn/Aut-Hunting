"use client";

import { Check, ChevronDown, Copy, ExternalLink, Loader2, MessageSquareText, RefreshCw, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { LONG_MAX, SHORT_MAX } from "@/lib/hunting/outreach";
import { countByStage, NOTES_MAX, STAGES, type CandidatePatch, type Stage } from "@/lib/hunting/pipeline-stages";
import { cn } from "@/lib/utils";
import { STAGE_DOT } from "./stage-styles";

export type CandidateRow = {
  id: string;
  linkedin_url: string;
  name: string | null;
  headline: string | null;
  score: number | null;
  match_reasons: string[] | null;
  gaps: string[] | null;
  stage: Stage;
  outreach_short: string | null;
  outreach_long: string | null;
  notes: string | null;
};

type Filter = Stage | "all";

function scoreTone(score: number) {
  if (score >= 80) return "text-primary";
  if (score >= 60) return "text-foreground";
  return "text-muted-foreground";
}

async function patchCandidate(id: string, patch: CandidatePatch) {
  const res = await fetch(`/api/candidates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/**
 * Ranking + seguimiento. El puntaje es un número grande (DESIGN: "el puntaje es tipografía"), filas sin tarjetas.
 * Cada candidato tiene su etapa (Sin contactar → Contactado → Respondió → Entrevista, o Descartado)
 * y un mensaje de contacto personalizado que se genera bajo demanda y se copia con un botón.
 */
export function CandidateList({ candidates }: { candidates: CandidateRow[] }) {
  const t = useTranslations("hunt");
  const [rows, setRows] = useState(candidates);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = countByStage(rows);
  const visible = filter === "all" ? rows : rows.filter((r) => r.stage === filter);

  function update(id: string, patch: Partial<CandidateRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function moveTo(id: string, stage: Stage, previous: Stage) {
    if (previous === stage) return;
    update(id, { stage });
    if (!(await patchCandidate(id, { stage }))) {
      update(id, { stage: previous });
      toast.error(t("saveError"));
    }
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label={t("pipelineLabel")} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {(["all", ...STAGES] as const).map((f) => {
          const count = f === "all" ? rows.length : counts[f];
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
              )}
            >
              {f !== "all" && <span aria-hidden className={cn("size-2 rounded-full", STAGE_DOT[f])} />}
              {f === "all" ? t("filterAll") : t(`stages.${f}`)}
              <span className={cn("font-mono text-xs tabular-nums", active ? "text-background/70" : "text-muted-foreground")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          {t("filterEmpty")}
        </p>
      ) : (
        <ol className="divide-y rounded-xl border bg-card">
          {visible.map((c, i) => (
            <CandidateItem
              key={c.id}
              c={c}
              index={i}
              open={openId === c.id}
              onToggle={() => setOpenId((prev) => (prev === c.id ? null : c.id))}
              onMove={(stage) => moveTo(c.id, stage, c.stage)}
              onUpdate={(patch) => update(c.id, patch)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function CandidateItem({
  c,
  index,
  open,
  onToggle,
  onMove,
  onUpdate,
}: {
  c: CandidateRow;
  index: number;
  open: boolean;
  onToggle: () => void;
  onMove: (stage: Stage) => void;
  onUpdate: (patch: Partial<CandidateRow>) => void;
}) {
  const t = useTranslations("hunt");
  const score = c.score ?? 0;
  const panelId = `outreach-${c.id}`;

  return (
    <li
      className={cn(
        "grid animate-in fade-in slide-in-from-bottom-1 grid-cols-[3.5rem_1fr] gap-x-4 gap-y-3 p-4 fill-mode-both sm:grid-cols-[4.5rem_1fr_auto] sm:p-5",
        c.stage === "discarded" && "opacity-60",
      )}
      style={{ animationDelay: `${Math.min(index, 15) * 40}ms` }}
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

      <div className="col-start-2 flex flex-wrap items-start gap-2 sm:col-start-3 sm:w-44 sm:flex-col sm:items-stretch">
        <label className="relative inline-flex">
          <span className="sr-only">{t("stageLabel", { name: c.name ?? "" })}</span>
          <span aria-hidden className={cn("pointer-events-none absolute top-1/2 left-2.5 size-2 -translate-y-1/2 rounded-full", STAGE_DOT[c.stage])} />
          <select
            value={c.stage}
            onChange={(e) => onMove(e.target.value as Stage)}
            className="h-8 w-full appearance-none rounded-lg border border-border bg-background pr-8 pl-6 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {t(`stages.${s}`)}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground" />
        </label>
        <Button
          type="button"
          variant={open ? "secondary" : "default"}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <MessageSquareText />
          {t("message")}
        </Button>
        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
          {t("viewProfile")}
          <ExternalLink />
        </a>
      </div>

      {open && (
        <div id={panelId} className="col-span-full sm:col-start-2">
          <OutreachPanel c={c} onMove={onMove} onUpdate={onUpdate} />
        </div>
      )}
    </li>
  );
}

type Variant = "short" | "long";

function OutreachPanel({
  c,
  onMove,
  onUpdate,
}: {
  c: CandidateRow;
  onMove: (stage: Stage) => void;
  onUpdate: (patch: Partial<CandidateRow>) => void;
}) {
  const t = useTranslations("hunt");
  const [variant, setVariant] = useState<Variant>("short");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState(c.notes ?? "");
  // Último texto guardado de cada versión, para no mandar un PATCH si no cambió.
  const [saved, setSaved] = useState({ outreach_short: c.outreach_short, outreach_long: c.outreach_long });

  const field = variant === "short" ? "outreach_short" : "outreach_long";
  const max = variant === "short" ? SHORT_MAX : LONG_MAX;
  const text = c[field] ?? "";
  const hasMessage = Boolean(c.outreach_short !== null && c.outreach_long !== null);

  async function generate(regenerate: boolean) {
    setLoading(true);
    const res = await fetch(`/api/candidates/${c.id}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerate }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { short?: string; long?: string; error?: string } | null;
    setLoading(false);

    if (!res?.ok || !body?.short || !body.long) {
      const code = body?.error;
      const known = code === "OUTREACH_LIMIT" || code === "AI_BUSY" || code === "AI_NOT_CONFIGURED";
      toast.error(t(`outreachErrors.${known ? code : "INTERNAL"}`));
      return;
    }
    onUpdate({ outreach_short: body.short, outreach_long: body.long });
    setSaved({ outreach_short: body.short, outreach_long: body.long });
  }

  async function saveMessage() {
    const value = text.trim();
    if (!value || value === saved[field]) return;
    if (await patchCandidate(c.id, { [field]: value })) setSaved((s) => ({ ...s, [field]: value }));
    else toast.error(t("saveError"));
  }

  async function saveNotes() {
    if (notes === (c.notes ?? "")) return;
    if (await patchCandidate(c.id, { notes })) onUpdate({ notes });
    else toast.error(t("saveError"));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast.error(t("copyError"));
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (c.stage === "found") {
      toast.success(t("copiedAskContacted"), {
        action: { label: t("markContacted"), onClick: () => onMove("contacted") },
        duration: 8000,
      });
    } else {
      toast.success(t("copiedMessage"));
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
      {!hasMessage ? (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t("outreachIntro")}</p>
          <Button type="button" onClick={() => generate(false)} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {loading ? t("generating") : t("generate")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="radiogroup" aria-label={t("message")} className="inline-flex rounded-lg border bg-background p-0.5">
              {(["short", "long"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={variant === v}
                  onClick={() => setVariant(v)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    variant === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(v === "short" ? "variantShort" : "variantLong")}
                </button>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => generate(true)} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {t("regenerate")}
            </Button>
          </div>

          <label className="block">
            <span className="sr-only">{t(variant === "short" ? "variantShort" : "variantLong")}</span>
            <textarea
              value={text}
              maxLength={max}
              rows={variant === "short" ? 4 : 9}
              onChange={(e) => onUpdate({ [field]: e.target.value })}
              onBlur={saveMessage}
              className="block w-full resize-y rounded-lg border border-input bg-background p-3 text-[15px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">
                {text.length}/{max}
              </span>{" "}
              · {t(variant === "short" ? "variantShortHint" : "variantLongHint")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={copy} disabled={!text.trim()}>
                {copied ? <Check /> : <Copy />}
                {copied ? t("copied") : t("copy")}
              </Button>
              <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
                {t("openToSend")}
                <ExternalLink />
              </a>
            </div>
          </div>
        </div>
      )}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{t("notes")}</span>
        <textarea
          value={notes}
          maxLength={NOTES_MAX}
          rows={2}
          placeholder={t("notesPlaceholder")}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          className="block w-full resize-y rounded-lg border border-input bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>
    </div>
  );
}

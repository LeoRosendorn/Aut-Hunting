"use client";

import { CircleAlert, FileText, Loader2, Search, Upload, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import {
  ACCEPT_ATTR,
  COUNTRIES,
  detectSource,
  MAX_FILE_BYTES,
  MIN_JD_CHARS,
  PROFILE_LANGUAGES,
} from "@/lib/hunting/jd-input";
import { cn } from "@/lib/utils";

type ErrorKey =
  | "JD_TOO_SHORT"
  | "JD_TOO_LONG"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE"
  | "JD_UNREADABLE"
  | "AI_NOT_CONFIGURED"
  | "AI_LIMIT"
  | "AI_BUSY"
  | "DAILY_LIMIT"
  | "INVALID_INPUT"
  | "INTERNAL"
  | "UNAUTHORIZED";

const KNOWN_ERRORS = new Set<string>([
  "JD_TOO_SHORT", "JD_TOO_LONG", "FILE_TOO_LARGE", "UNSUPPORTED_FILE", "JD_UNREADABLE",
  "AI_NOT_CONFIGURED", "AI_LIMIT", "AI_BUSY", "DAILY_LIMIT", "INVALID_INPUT", "INTERNAL", "UNAUTHORIZED",
]);

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function NewHuntForm({ remaining }: { remaining: number }) {
  const t = useTranslations("newHunt");
  const locale = useLocale();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(remaining <= 0 ? "DAILY_LIMIT" : null);
  const [submitting, setSubmitting] = useState(false);

  const countryNames = new Intl.DisplayNames([locale], { type: "region" });

  function pickFile(candidate: File | undefined) {
    if (!candidate) return;
    if (!detectSource(candidate.name)) return setError("UNSUPPORTED_FILE");
    if (candidate.size > MAX_FILE_BYTES) return setError("FILE_TOO_LARGE");
    setError(null);
    setFile(candidate);
  }

  function clearFile() {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  const textLength = text.trim().length;
  const canSubmit = remaining > 0 && !submitting && (file !== null || textLength >= MIN_JD_CHARS);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file && textLength < MIN_JD_CHARS) return setError("JD_TOO_SHORT");

    const form = new FormData(event.currentTarget);
    if (file) {
      form.set("file", file);
      form.delete("text");
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/hunts", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(KNOWN_ERRORS.has(body.error) ? body.error : "INTERNAL");
        setSubmitting(false);
        return;
      }
      router.push(`/app/hunts/${body.id}`);
    } catch {
      setError("INTERNAL");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_20rem]" noValidate>
      {/* La misma superficie sirve para pegar texto y para soltar un archivo. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pickFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "relative flex min-h-[22rem] flex-col rounded-xl border-2 border-dashed bg-card p-5 transition-colors sm:p-6",
          dragging ? "border-primary bg-accent" : "border-border",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{t("dropTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("dropHint")}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={submitting}>
            <Upload />
            {t("chooseFile")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>

        {file ? (
          <div className="mt-6 flex items-center gap-3 rounded-lg border bg-background p-3">
            <FileText className="size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label={t("removeFile")} onClick={clearFile} disabled={submitting}>
              <X />
            </Button>
          </div>
        ) : (
          <>
            <label htmlFor="jd-text" className="sr-only">
              {t("dropTitle")}
            </label>
            <textarea
              id="jd-text"
              name="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("placeholder")}
              className="mt-5 min-h-60 w-full flex-1 resize-y rounded-lg bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/80"
            />
            <p className={cn("mt-2 text-right font-mono text-xs", textLength > 0 && textLength < MIN_JD_CHARS ? "text-brand-amber" : "text-muted-foreground")}>
              {textLength > 0 && textLength < MIN_JD_CHARS ? t("minChars", { min: MIN_JD_CHARS }) + " · " : ""}
              {t("chars", { count: textLength })}
            </p>
          </>
        )}

        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-accent/90 text-lg font-semibold text-accent-foreground">
            {t("dropActive")}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <Field label={t("country")} htmlFor="country">
          <select id="country" name="country" defaultValue="auto" className={selectClass}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c === "auto" ? t("countryAuto") : countryNames.of(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("language")} htmlFor="profileLanguage">
          <select
            id="profileLanguage"
            name="profileLanguage"
            defaultValue={(PROFILE_LANGUAGES as readonly string[]).includes(locale) ? locale : "es"}
            className={selectClass}
          >
            {PROFILE_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {t(`langs.${l}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("titleLabel")} htmlFor="title">
          <Input id="title" name="title" maxLength={120} placeholder={t("titlePlaceholder")} className="h-10" />
        </Field>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {t(`errors.${error}`)}
          </p>
        )}

        <Button type="submit" size="lg" className="h-12 text-base" disabled={!canSubmit}>
          {submitting ? <Loader2 className="animate-spin" /> : <Search />}
          {submitting ? t("submitting") : t("submit")}
        </Button>
        <p className="rounded-lg bg-brand-amber/10 p-3 text-sm text-brand-amber">{t("privacy")}</p>
      </div>
    </form>
  );
}

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

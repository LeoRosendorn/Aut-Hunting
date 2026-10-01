"use client";

import { CircleAlert, Loader2, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { AuthState } from "@/app/[locale]/(auth)/actions";
import { signIn, signUp } from "@/app/[locale]/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { GoogleButton } from "./google-button";

type Mode = "login" | "signup";

export function AuthForm({ mode, next, initialError }: { mode: Mode; next?: string; initialError?: "callback" }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "login" ? signIn : signUp,
    initialError ? { status: "error", error: initialError } : { status: "idle" },
  );

  if (state.status === "check-email") {
    return (
      <div className="space-y-4 text-center" role="status">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <MailCheck className="size-7" />
        </div>
        <h1 className="text-2xl font-bold">{t("checkEmailTitle")}</h1>
        <p className="text-muted-foreground">{t("checkEmailBody", { email: state.email })}</p>
      </div>
    );
  }

  const isLogin = mode === "login";

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-extrabold">{t(isLogin ? "loginTitle" : "signupTitle")}</h1>
        <p className="text-muted-foreground">{t(isLogin ? "loginSubtitle" : "signupSubtitle")}</p>
      </div>

      <GoogleButton next={next} />

      <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
        <Separator className="flex-1" />
        {t("or")}
        <Separator className="flex-1" />
      </div>

      <form action={action} className="space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}

        {!isLogin && (
          <Field id="fullName" label={t("fullName")}>
            <Input id="fullName" name="fullName" autoComplete="name" required className="h-11" />
          </Field>
        )}
        <Field id="email" label={t("email")}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.status === "error" ? state.email : undefined}
            className="h-11"
          />
        </Field>
        <Field id="password" label={t("password")} hint={isLogin ? undefined : t("passwordHint")}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={isLogin ? undefined : 8}
            className="h-11"
          />
        </Field>

        {state.status === "error" && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {t(`errors.${state.error}`)}
          </p>
        )}

        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {t(isLogin ? "loginSubmit" : "signupSubmit")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t(isLogin ? "noAccount" : "haveAccount")}{" "}
        <Link
          href={isLogin ? "/signup" : "/login"}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {isLogin ? t("signupSubmit") : t("loginSubmit")}
        </Link>
      </p>
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

"use client";

import { CircleAlert, Loader2, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { AuthState } from "@/app/[locale]/(auth)/actions";
import { requestPasswordReset, updatePassword } from "@/app/[locale]/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";

/** "Olvidé mi contraseña" (pide el email) y "Elegí una contraseña nueva" (después del link del email). */
export function PasswordForm({ mode }: { mode: "forgot" | "reset" }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "forgot" ? requestPasswordReset : updatePassword,
    { status: "idle" },
  );

  if (state.status === "check-email") {
    return (
      <div className="space-y-4 text-center" role="status">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <MailCheck className="size-7" />
        </div>
        <h1 className="text-2xl font-bold">{t("checkEmailTitle")}</h1>
        <p className="text-muted-foreground">{t("resetEmailSent", { email: state.email })}</p>
      </div>
    );
  }

  const forgot = mode === "forgot";

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-extrabold">{t(forgot ? "forgotTitle" : "resetTitle")}</h1>
        <p className="text-muted-foreground">{t(forgot ? "forgotSubtitle" : "resetSubtitle")}</p>
      </div>

      <form action={action} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor={forgot ? "email" : "password"}>{t(forgot ? "email" : "newPassword")}</Label>
          {forgot ? (
            <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
          ) : (
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="h-11" />
          )}
          {!forgot && <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>}
        </div>

        {state.status === "error" && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              {t(`errors.${state.error}`)}{" "}
              {state.error === "linkExpired" && (
                <Link href="/forgot-password" className="font-semibold underline underline-offset-4">
                  {t("forgotSubmit")}
                </Link>
              )}
            </span>
          </p>
        )}

        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {t(forgot ? "forgotSubmit" : "resetSubmit")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}

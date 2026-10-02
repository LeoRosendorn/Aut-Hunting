"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/app/[locale]/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, { status: "idle" });

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" value={email} readOnly disabled className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fullName">{t("fullName")}</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">{t("fullNameHint")}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {t("save")}
        </Button>
        <p role="status" className="text-sm">
          {state.status === "saved" && (
            <span className="inline-flex items-center gap-1.5 text-success">
              <Check className="size-4" />
              {t("saved")}
            </span>
          )}
          {state.status === "error" && <span className="text-destructive">{t("saveError")}</span>}
        </p>
      </div>
    </form>
  );
}

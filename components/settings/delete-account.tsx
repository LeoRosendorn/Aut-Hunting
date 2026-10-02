"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";

/** Borrado de cuenta en dos pasos: hay que escribir el email para confirmar. */
export function DeleteAccount({ email }: { email: string }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function remove() {
    setDeleting(true);
    const res = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setDeleting(false);
      toast.error(t("deleteError"));
      return;
    }
    // La API ya borró las cookies de sesión: se vuelve a la landing sin la usuaria.
    router.replace("/");
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
        <Trash2 />
        {t("deleteButton")}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="confirm-email">{t("deleteConfirmLabel", { email })}</Label>
        <Input id="confirm-email" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="h-11" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" onClick={remove} disabled={!matches || deleting}>
          {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {t("deleteConfirm")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

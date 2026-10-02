import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type HuntStatus = "pending" | "parsing" | "searching" | "scoring" | "done" | "failed";

const STYLES: Record<HuntStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  parsing: "bg-accent text-accent-foreground",
  searching: "bg-accent text-accent-foreground",
  scoring: "bg-accent text-accent-foreground",
  done: "bg-primary text-primary-foreground",
  failed: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: HuntStatus }) {
  const t = useTranslations("status");
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold", STYLES[status])}>
      {t(status)}
    </span>
  );
}

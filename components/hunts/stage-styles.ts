import type { Stage } from "@/lib/hunting/pipeline-stages";

/** Color del punto de cada etapa del pipeline (lista de candidatos y dashboard). */
export const STAGE_DOT: Record<Stage, string> = {
  found: "bg-muted-foreground/40",
  contacted: "bg-chart-2",
  replied: "bg-brand-amber",
  interview: "bg-success",
  discarded: "bg-destructive/60",
};

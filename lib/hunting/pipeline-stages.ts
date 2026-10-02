import { z } from "zod";
import { LONG_MAX, SHORT_MAX } from "./outreach";

/** Etapas del seguimiento, en orden (enum `cand_stage` de la base). */
export const STAGES = ["found", "contacted", "replied", "interview", "discarded"] as const;
export type Stage = (typeof STAGES)[number];

export const NOTES_MAX = 2000;

export const candidatePatchSchema = z
  .object({
    stage: z.enum(STAGES),
    notes: z.string().max(NOTES_MAX),
    outreach_short: z.string().trim().min(1).max(SHORT_MAX),
    outreach_long: z.string().trim().min(1).max(LONG_MAX),
  })
  .partial()
  .strict();
export type CandidatePatch = z.infer<typeof candidatePatchSchema>;

/** Cuenta candidatos por etapa (todas las etapas presentes, aunque estén en 0). */
export function countByStage(rows: { stage: Stage }[]) {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const r of rows) counts[r.stage] += 1;
  return counts;
}

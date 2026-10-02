import { NextResponse, type NextRequest } from "next/server";
import type { HuntPlan } from "@/lib/hunting/ai-schemas";
import { HuntError } from "@/lib/hunting/errors";
import { fitMessage, LONG_MAX, outreachPrompt, outreachSchema, SHORT_MAX } from "@/lib/hunting/outreach";
import { generateJson } from "@/lib/providers/gemini";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CandidateWithHunt = {
  id: string;
  name: string | null;
  headline: string | null;
  snippet: string | null;
  match_reasons: string[] | null;
  outreach_short: string | null;
  outreach_long: string | null;
  hunts: { requirements: HuntPlan | null; profile_language: "es" | "en" | "pt" } | null;
};

/**
 * Redacta (o devuelve el ya guardado) el mensaje de contacto de un candidato:
 * una nota de conexión corta y un mensaje largo. `{ regenerate: true }` pide una versión nueva.
 * Nunca envía nada: la reclutadora lo copia y lo manda ella desde LinkedIn.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/candidates/[id]/outreach">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { regenerate?: unknown };
  const regenerate = body.regenerate === true;

  // RLS: un candidato de otra usuaria no vuelve → 404 (criterio 3).
  const { data: candidate } = await supabase
    .from("candidates")
    .select("id, name, headline, snippet, match_reasons, outreach_short, outreach_long, hunts(requirements, profile_language)")
    .eq("id", id)
    .maybeSingle<CandidateWithHunt>();
  if (!candidate) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (!regenerate && candidate.outreach_short && candidate.outreach_long) {
    return NextResponse.json({ short: candidate.outreach_short, long: candidate.outreach_long });
  }

  const plan = candidate.hunts?.requirements;
  if (!plan) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_outreach_call");
  if (quotaError) {
    console.error("consume_outreach_call", quotaError);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
  if (allowed !== true) return NextResponse.json({ error: "OUTREACH_LIMIT" }, { status: 429 });

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();

  try {
    const draft = await generateJson(
      outreachPrompt({
        plan,
        language: candidate.hunts?.profile_language ?? "es",
        recruiterName: profile?.full_name?.trim() || null,
        candidate,
      }),
      outreachSchema,
      { temperature: 0.7 },
    );
    const message = { short: fitMessage(draft.short, SHORT_MAX), long: fitMessage(draft.long, LONG_MAX) };

    const { error } = await supabase
      .from("candidates")
      .update({ outreach_short: message.short, outreach_long: message.long })
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json(message);
  } catch (err) {
    // AI_BUSY / AI_NOT_CONFIGURED: el cupo ya se descontó, como en la lectura de archivos.
    if (err instanceof HuntError) return NextResponse.json({ error: err.code }, { status: 503 });
    console.error("POST /api/candidates/:id/outreach", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}

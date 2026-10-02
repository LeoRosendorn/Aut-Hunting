import { NextResponse, type NextRequest } from "next/server";
import { candidatePatchSchema } from "@/lib/hunting/pipeline-stages";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mueve al candidato en el pipeline o guarda notas / el mensaje editado a mano. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/candidates/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = candidatePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // RLS + permisos de columna: solo se pueden tocar stage, notes y los mensajes de candidatos propios.
  const { data, error } = await supabase.from("candidates").update(parsed.data).eq("id", id).select("id").maybeSingle();
  if (error) {
    console.error("PATCH /api/candidates/:id", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

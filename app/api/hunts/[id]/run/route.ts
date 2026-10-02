import { after, NextResponse } from "next/server";
import { runHunt, STALE_AFTER_MS } from "@/lib/hunting/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const IN_PROGRESS = ["parsing", "searching", "scoring"];

/**
 * Relanza un hunting que quedó en "pending" (por ejemplo, creado antes de que existiera el motor)
 * o trabado "en proceso" más de 6 minutos (la función en segundo plano se cortó).
 * Un hunting terminado o con error no se relanza: volver a buscar gastaría cupo de búsqueda.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/hunts/[id]/run">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // RLS: solo devuelve el hunting si es de la usuaria.
  const { data: hunt } = await supabase.from("hunts").select("id, status, created_at").eq("id", id).maybeSingle();
  if (!hunt) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const stale = IN_PROGRESS.includes(hunt.status) && Date.now() - new Date(hunt.created_at).getTime() > STALE_AFTER_MS;
  if (hunt.status !== "pending" && !stale) return NextResponse.json({ error: "NOT_RUNNABLE" }, { status: 409 });

  if (stale) {
    await createAdminClient().from("hunts").update({ status: "pending" }).eq("id", id).eq("status", hunt.status);
  }
  after(() => runHunt(id));
  return NextResponse.json({ ok: true }, { status: 202 });
}

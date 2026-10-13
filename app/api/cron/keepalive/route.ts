import { NextResponse, type NextRequest } from "next/server";
import { purgeExpiredSearches } from "@/lib/hunting/search-cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vercel Cron lo llama una vez por día (ver vercel.json) para que el proyecto
 * Supabase Free no se pause tras 7 días sin actividad (criterio 18).
 * De paso borra las búsquedas vencidas de la caché (el plan Free tiene 500 MB).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  await purgeExpiredSearches(admin);
  const { error } = await admin
    .from("profiles")
    .select("id", { head: true, count: "exact" });

  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}

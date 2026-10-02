import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Borra la cuenta de la usuaria logueada y, en cascada, sus huntings, candidatos, mensajes y notas
 * (criterio 17). Los registros de uso quedan sin user_id (on delete set null) para los cupos globales.
 */
export async function DELETE() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { error } = await createAdminClient().auth.admin.deleteUser(auth.user.id);
  if (error) {
    console.error("DELETE /api/account", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }

  // Limpia las cookies de sesión (el usuario ya no existe, así que se ignora la respuesta del servidor).
  await supabase.auth.signOut({ scope: "local" }).catch(() => null);
  return new NextResponse(null, { status: 204 });
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { status: "idle" | "saved" | "error" };

const profileSchema = z.object({ fullName: z.string().trim().min(2).max(120) });

/** Cambia el nombre de la usuaria (se usa como firma en los mensajes de contacto). */
export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const parsed = profileSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return { status: "error" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error" };

  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", auth.user.id);
  if (error) return { status: "error" };

  revalidatePath("/[locale]/app", "layout");
  return { status: "saved" };
}

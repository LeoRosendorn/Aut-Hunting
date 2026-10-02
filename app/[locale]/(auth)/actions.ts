"use server";

import { redirect as nextRedirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { mapSupabaseAuthError, type AuthErrorKey } from "@/lib/auth/errors";
import { forgotSchema, loginSchema, newPasswordSchema, signupSchema } from "@/lib/auth/schemas";
import { safeNextPath } from "@/lib/safe-next";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export type AuthState =
  | { status: "idle" }
  | { status: "error"; error: AuthErrorKey; email?: string }
  | { status: "check-email"; email: string };

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0].message as AuthErrorKey };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", error: mapSupabaseAuthError(error.code), email: parsed.data.email };
  }

  const locale = await getLocale();
  const next = safeNextPath(formData.get("next")?.toString(), `/${locale}/app`);
  // `next` ya incluye el prefijo de idioma, así que se usa el redirect de Next sin localizar.
  nextRedirect(next);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0].message as AuthErrorKey };
  }

  const locale = await getLocale();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=/${locale}/app`,
      data: { full_name: parsed.data.fullName, locale },
    },
  });
  if (error) {
    return { status: "error", error: mapSupabaseAuthError(error.code), email: parsed.data.email };
  }

  // Con "Confirm email" activo, Supabase no devuelve sesión hasta que se confirma (criterio 1).
  // Si el email ya existía, devuelve un usuario sin identidades para no filtrar qué emails están registrados.
  if (data.session) redirect({ href: "/app", locale });
  return { status: "check-email", email: parsed.data.email };
}

/** Manda el email para elegir una contraseña nueva. Siempre responde igual, para no revelar qué emails existen. */
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0].message as AuthErrorKey };
  }

  const locale = await getLocale();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/${locale}/reset-password`,
  });
  if (error && mapSupabaseAuthError(error.code) === "rateLimited") {
    return { status: "error", error: "rateLimited", email: parsed.data.email };
  }
  return { status: "check-email", email: parsed.data.email };
}

/** Guarda la contraseña nueva. Requiere la sesión que abre el link del email. */
export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0].message as AuthErrorKey };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", error: "linkExpired" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", error: mapSupabaseAuthError(error.code) };

  redirect({ href: "/app", locale: await getLocale() });
  return { status: "idle" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/login", locale: await getLocale() });
}

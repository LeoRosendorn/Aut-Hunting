import { describe, expect, it } from "vitest";
import { mapSupabaseAuthError } from "@/lib/auth/errors";
import { loginSchema, signupSchema } from "@/lib/auth/schemas";
import es from "@/messages/es.json";

describe("mapSupabaseAuthError", () => {
  it.each([
    ["invalid_credentials", "invalidCredentials"],
    ["email_not_confirmed", "emailNotConfirmed"],
    ["weak_password", "weakPassword"],
    ["user_already_exists", "userExists"],
    ["over_email_send_rate_limit", "rateLimited"],
    [undefined, "generic"],
    ["algo_nuevo", "generic"],
  ])("%s → %s", (code, key) => {
    expect(mapSupabaseAuthError(code)).toBe(key);
  });

  it("toda clave posible existe en los mensajes", () => {
    const codes = ["invalid_credentials", "email_not_confirmed", "weak_password", "email_address_invalid", "user_already_exists", "over_request_rate_limit", undefined];
    for (const c of codes) expect(es.auth.errors).toHaveProperty(mapSupabaseAuthError(c));
  });
});

describe("signupSchema", () => {
  const ok = { fullName: "Ana Pérez", email: "ana@empresa.com", password: "12345678" };

  it("acepta datos válidos", () => {
    expect(signupSchema.safeParse(ok).success).toBe(true);
  });

  it.each([
    [{ ...ok, password: "1234567" }, "weakPassword"],
    [{ ...ok, email: "no-es-email" }, "invalidEmail"],
    [{ ...ok, fullName: " " }, "nameRequired"],
  ])("rechaza %o con %s", (input, key) => {
    const r = signupSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toBe(key);
    expect(es.auth.errors).toHaveProperty(key);
  });
});

describe("loginSchema", () => {
  it("exige email válido y contraseña", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ error: "invalidEmail" }),
  password: z.string().min(1, { error: "invalidCredentials" }),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, { error: "nameRequired" }).max(120, { error: "nameRequired" }),
  email: z.email({ error: "invalidEmail" }),
  password: z.string().min(8, { error: "weakPassword" }).max(72, { error: "weakPassword" }),
});

export const forgotSchema = z.object({
  email: z.email({ error: "invalidEmail" }),
});

export const newPasswordSchema = z.object({
  password: z.string().min(8, { error: "weakPassword" }).max(72, { error: "weakPassword" }),
});

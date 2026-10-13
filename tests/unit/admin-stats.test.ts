import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminEmail, summarizeDay } from "@/lib/admin/stats";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAdminEmail", () => {
  it("sin ADMIN_EMAILS nadie entra al panel", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(isAdminEmail("ana@empresa.com")).toBe(false);
  });

  it("acepta los emails de la lista sin importar mayúsculas ni espacios", () => {
    vi.stubEnv("ADMIN_EMAILS", " Ana@Empresa.com , beto@empresa.com");
    expect(isAdminEmail("ana@empresa.com")).toBe(true);
    expect(isAdminEmail("BETO@empresa.com")).toBe(true);
    expect(isAdminEmail("carla@empresa.com")).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});

describe("summarizeDay", () => {
  it("cuenta huntings por estado y la tasa de error sobre los terminados", () => {
    const summary = summarizeDay(
      [
        { status: "done", error_code: null },
        { status: "done", error_code: null },
        { status: "done", error_code: null },
        { status: "failed", error_code: "AI_BUSY" },
        { status: "searching", error_code: null },
      ],
      [
        { kind: "llm_call", provider: "gemini:gemini-flash-lite-latest" },
        { kind: "llm_call", provider: "gemini:gemini-flash-lite-latest" },
        { kind: "llm_call", provider: "groq:openai/gpt-oss-120b" },
        { kind: "search_call", provider: "exa" },
        { kind: "hunt", provider: null },
      ],
    );
    expect(summary.hunts).toEqual({ total: 5, done: 3, failed: 1, inProgress: 1, errorRate: 25, errors: { AI_BUSY: 1 } });
    expect(summary.ai).toEqual({ "gemini:gemini-flash-lite-latest": 2, "groq:openai/gpt-oss-120b": 1 });
    expect(summary.searches).toEqual({ exa: 1 });
  });

  it("sin huntings terminados la tasa de error es 0", () => {
    expect(summarizeDay([{ status: "pending", error_code: null }], []).hunts.errorRate).toBe(0);
  });
});

import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@google/genai")>()),
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const { readWithGemini, generateJson } = await import("@/lib/providers/gemini");
const { z } = await import("zod");

const png = new Uint8Array([1, 2, 3]);
const timeout = () => new DOMException("This operation was aborted", "AbortError");
const apiError = (status: number) => new ApiError({ message: `error ${status}`, status });

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "clave-de-prueba");
  generateContent.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Regression: ISSUE-001 — si gemini-flash-latest tardaba más de 30 s, el timeout cortaba sin probar
// el modelo lite y la captura de la JD mostraba "La IA está saturada"
// Found by /qa on 2026-10-13
// Report: .gstack/qa-reports/run-20261013T000000Z/qa-report-gemini-2026-10-13.md
describe("readWithGemini: fallback entre modelos", () => {
  it.each([
    ["timeout", timeout()],
    ["503 saturado", apiError(503)],
    ["500 error interno", apiError(500)],
    ["429 cuota", apiError(429)],
  ])("si el primer modelo falla por %s, usa el siguiente", async (_caso, err) => {
    generateContent.mockRejectedValueOnce(err).mockResolvedValueOnce({ text: "QA Automation Engineer Senior" });
    await expect(readWithGemini(png, "image/png")).resolves.toBe("QA Automation Engineer Senior");
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1][0].model).not.toBe(generateContent.mock.calls[0][0].model);
  });

  it("si todos los modelos fallan, devuelve AI_BUSY", async () => {
    generateContent.mockRejectedValue(timeout());
    await expect(readWithGemini(png, "image/png")).rejects.toMatchObject({ code: "AI_BUSY" });
  });

  it("un 400 (archivo ilegible) no prueba otro modelo y da JD_UNREADABLE", async () => {
    generateContent.mockRejectedValue(apiError(400));
    await expect(readWithGemini(png, "image/png")).rejects.toMatchObject({ code: "JD_UNREADABLE" });
    expect(generateContent).toHaveBeenCalledOnce();
  });
});

describe("generateJson: fallback entre modelos", () => {
  it("si el primer modelo da timeout, usa el siguiente", async () => {
    generateContent.mockRejectedValueOnce(timeout()).mockResolvedValueOnce({ text: '{"ok":true}' });
    await expect(generateJson("prompt", z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});

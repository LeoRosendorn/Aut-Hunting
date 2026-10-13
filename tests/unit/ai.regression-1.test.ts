import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const generateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@google/genai")>()),
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const { readJdWithAi, generateJson } = await import("@/lib/providers/ai");

const png = new Uint8Array([1, 2, 3]);
const okSchema = z.object({ ok: z.boolean() });
const timeout = () => new DOMException("This operation was aborted", "AbortError");
const apiError = (status: number) => new ApiError({ message: `error ${status}`, status });
const modelsCalled = () => generateContent.mock.calls.map(([req]) => req.model as string);

const groqFetch = vi.fn();
function groqReplies(content: string, status = 200) {
  groqFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status }),
  );
}

// Cada test arranca una hora después del anterior: las pausas (cooldown) de un test no afectan al siguiente.
let clock = Date.UTC(2026, 9, 13);

beforeEach(() => {
  clock += 60 * 60 * 1000;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(clock);
  vi.stubEnv("GEMINI_API_KEY", "clave-de-prueba");
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubGlobal("fetch", groqFetch);
  generateContent.mockReset();
  groqFetch.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Regression: ISSUE-001 — si gemini-flash-latest tardaba más de 30 s, el timeout cortaba sin probar
// el modelo lite y la captura de la JD mostraba "La IA está saturada"
// Found by /qa on 2026-10-13
// Report: .gstack/qa-reports/run-20261013T000000Z/qa-report-gemini-2026-10-13.md
describe("readJdWithAi", () => {
  it("lee primero con el modelo lite (el rápido y con más cupo gratis)", async () => {
    generateContent.mockResolvedValueOnce({ text: "QA Automation Engineer Senior" });
    await expect(readJdWithAi(png, "image/png")).resolves.toBe("QA Automation Engineer Senior");
    expect(modelsCalled()).toEqual(["gemini-flash-lite-latest"]);
  });

  it.each([
    ["timeout", timeout()],
    ["503 saturado", apiError(503)],
    ["500 error interno", apiError(500)],
    ["429 cuota", apiError(429)],
  ])("si el primer modelo falla por %s, usa el siguiente", async (_caso, err) => {
    generateContent.mockRejectedValueOnce(err).mockResolvedValueOnce({ text: "QA Automation Engineer Senior" });
    await expect(readJdWithAi(png, "image/png")).resolves.toBe("QA Automation Engineer Senior");
    expect(modelsCalled()).toEqual(["gemini-flash-lite-latest", "gemini-flash-latest"]);
  });

  it("si todos los modelos fallan, devuelve AI_BUSY", async () => {
    generateContent.mockRejectedValue(timeout());
    await expect(readJdWithAi(png, "image/png")).rejects.toMatchObject({ code: "AI_BUSY" });
  });

  it("un 400 (archivo ilegible) no prueba otro modelo y da JD_UNREADABLE", async () => {
    generateContent.mockRejectedValue(apiError(400));
    await expect(readJdWithAi(png, "image/png")).rejects.toMatchObject({ code: "JD_UNREADABLE" });
    expect(generateContent).toHaveBeenCalledOnce();
  });

  it("sin clave de IA da AI_NOT_CONFIGURED", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(readJdWithAi(png, "image/png")).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
  });
});

describe("pausa (cooldown) de un modelo saturado", () => {
  it("después de un 503, los pedidos siguientes no esperan al modelo saturado", async () => {
    generateContent.mockRejectedValueOnce(apiError(503)).mockResolvedValue({ text: "texto" });
    await readJdWithAi(png, "image/png");
    generateContent.mockClear();

    await readJdWithAi(png, "image/png");
    expect(modelsCalled()).toEqual(["gemini-flash-latest"]);
  });

  it("pasada la pausa, vuelve a probar primero el modelo lite", async () => {
    generateContent.mockRejectedValueOnce(apiError(503)).mockResolvedValue({ text: "texto" });
    await readJdWithAi(png, "image/png");
    generateContent.mockClear();

    vi.setSystemTime(clock + 61_000);
    await readJdWithAi(png, "image/png");
    expect(modelsCalled()).toEqual(["gemini-flash-lite-latest"]);
  });

  it("si todos están en pausa, igual los prueba antes de rendirse", async () => {
    generateContent.mockRejectedValueOnce(apiError(429)).mockRejectedValueOnce(apiError(429));
    await expect(readJdWithAi(png, "image/png")).rejects.toMatchObject({ code: "AI_BUSY" });

    generateContent.mockResolvedValueOnce({ text: "texto" });
    await expect(readJdWithAi(png, "image/png")).resolves.toBe("texto");
  });
});

describe("generateJson", () => {
  it("si el primer modelo da timeout, usa el siguiente y avisa cuál respondió", async () => {
    generateContent.mockRejectedValueOnce(timeout()).mockResolvedValueOnce({ text: '{"ok":true}' });
    const onProvider = vi.fn();
    await expect(generateJson("prompt", okSchema, { onProvider })).resolves.toEqual({ ok: true });
    expect(onProvider).toHaveBeenCalledWith("gemini:gemini-flash-latest");
  });

  it("con Groq configurado, el orden es Gemini lite → Groq → Gemini Flash", async () => {
    vi.stubEnv("GROQ_API_KEY", "clave-groq");
    generateContent.mockRejectedValueOnce(apiError(429));
    groqReplies('{"ok":true}');
    const onProvider = vi.fn();

    await expect(generateJson("prompt", okSchema, { onProvider })).resolves.toEqual({ ok: true });
    expect(modelsCalled()).toEqual(["gemini-flash-lite-latest"]);
    expect(onProvider).toHaveBeenCalledWith("groq:openai/gpt-oss-120b");
    const [url, init] = groqFetch.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(JSON.parse(init.body).response_format.type).toBe("json_schema");
  });

  it("un JSON inválido se reintenta una vez con el mismo modelo", async () => {
    generateContent.mockResolvedValueOnce({ text: "no es json" }).mockResolvedValueOnce({ text: '{"ok":true}' });

    await expect(generateJson("prompt", okSchema)).resolves.toEqual({ ok: true });
    expect(modelsCalled()).toEqual(["gemini-flash-lite-latest", "gemini-flash-lite-latest"]);
  });

  it("si un modelo devuelve dos veces JSON que no cumple el esquema, pasa al siguiente proveedor", async () => {
    vi.stubEnv("GROQ_API_KEY", "clave-groq");
    generateContent.mockResolvedValueOnce({ text: '{"ok":"si"}' }).mockResolvedValueOnce({ text: '{"ok":"si"}' });
    groqReplies("no es json");
    groqReplies("{}");
    generateContent.mockResolvedValueOnce({ text: '{"ok":false}' });

    await expect(generateJson("prompt", okSchema)).resolves.toEqual({ ok: false });
    expect(modelsCalled()).toEqual(["gemini-flash-lite-latest", "gemini-flash-lite-latest", "gemini-flash-latest"]);
    expect(groqFetch).toHaveBeenCalledTimes(2);
  });

  it("un error de Groq (clave inválida) no corta el hunting: sigue con Gemini", async () => {
    vi.stubEnv("GROQ_API_KEY", "clave-mala");
    generateContent.mockRejectedValueOnce(apiError(503)).mockResolvedValueOnce({ text: '{"ok":true}' });
    groqReplies("", 401);

    await expect(generateJson("prompt", okSchema)).resolves.toEqual({ ok: true });
  });

  it("si todos fallan, devuelve AI_BUSY", async () => {
    generateContent.mockResolvedValue({ text: "{}" });
    await expect(generateJson("prompt", okSchema)).rejects.toMatchObject({ code: "AI_BUSY" });
  });

  it("50 pedidos simultáneos con el lite saturado terminan todos bien", async () => {
    generateContent.mockImplementation(async ({ model }: { model: string }) => {
      if (model === "gemini-flash-lite-latest") throw apiError(429);
      return { text: '{"ok":true}' };
    });
    const results = await Promise.all(Array.from({ length: 50 }, () => generateJson("prompt", okSchema)));
    expect(results.every((r) => r.ok)).toBe(true);
  });
});

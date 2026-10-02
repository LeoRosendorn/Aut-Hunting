import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HuntError } from "@/lib/hunting/errors";
import { extractJdText } from "@/lib/hunting/extract";
import { defaultTitle, detectSource, normalizeJd } from "@/lib/hunting/jd-input";

const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/jd/${name}`));

describe("extractJdText", () => {
  it.each([
    ["txt", "jd-qa-senior.txt"],
    ["docx", "jd-qa-senior.docx"],
    ["pdf", "jd-qa-senior.pdf"],
  ] as const)("lee %s localmente, sin IA", async (source, file) => {
    const text = await extractJdText(source, fixture(file), "");
    expect(text).toContain("QA Automation Engineer Senior");
    expect(text).toContain("Playwright");
    expect(text.length).toBeGreaterThan(200);
  });

  it("rechaza una JD de menos de 200 caracteres", async () => {
    await expect(extractJdText("txt", fixture("jd-corta.txt"), "")).rejects.toMatchObject({ code: "JD_UNREADABLE" });
  });

  it("rechaza un archivo roto en vez de explotar", async () => {
    const roto = new TextEncoder().encode("esto no es un pdf");
    await expect(extractJdText("pdf", roto, "")).rejects.toBeInstanceOf(HuntError);
  });

  it("sin clave de Gemini, una imagen da AI_NOT_CONFIGURED", async () => {
    const prev = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    await expect(extractJdText("image", new Uint8Array([1, 2, 3]), "image/png")).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
    if (prev) process.env.GEMINI_API_KEY = prev;
  });
});

describe("jd-input", () => {
  it.each([
    ["JD.PDF", "pdf"],
    ["oferta.docx", "docx"],
    ["notas.md", "txt"],
    ["captura.JPEG", "image"],
    ["viejo.doc", null],
    ["sin-extension", null],
  ])("detectSource(%s) = %s", (name, expected) => {
    expect(detectSource(name)).toBe(expected);
  });

  it("normaliza espacios y saltos de línea", () => {
    expect(normalizeJd("  Hola\r\n\r\n\r\n\tmundo   QA  ")).toBe("Hola\n\nmundo QA");
  });

  it("título por defecto desde el archivo o la primera línea", () => {
    expect(defaultTitle("x", "JD_QA-Senior.pdf")).toBe("JD QA Senior");
    expect(defaultTitle("\n\nQA Senior\nresto")).toBe("QA Senior");
    expect(defaultTitle("a".repeat(100)).length).toBe(78);
  });
});

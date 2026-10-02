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

  // Regression: ISSUE-001 — el título salía del nombre del archivo ("jd qa senior") en vez del puesto
  // Found by /qa on 2026-10-01
  // Report: .gstack/qa-reports/run-20261002T013757Z/qa-report-localhost-2026-10-01.md
  it.each([
    ["primera línea de la JD aunque haya archivo", "QA Automation Engineer Senior\nEmpresa: fintech", "jd-qa-senior.pdf", "QA Automation Engineer Senior"],
    ["primera línea si no hay archivo", "\n\nQA Senior\nresto", undefined, "QA Senior"],
    ["nombre del archivo si la primera línea es un párrafo largo", `${"Buscamos una persona ".repeat(6)}\nmás`, "JD_QA-Senior.pdf", "JD QA Senior"],
  ])("título por defecto: %s", (_caso, text, file, expected) => {
    expect(defaultTitle(text, file)).toBe(expected);
  });

  it("recorta títulos largos sin archivo", () => {
    expect(defaultTitle("a".repeat(100)).length).toBe(78);
  });
});

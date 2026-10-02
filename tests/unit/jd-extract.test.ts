import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HuntError } from "@/lib/hunting/errors";
import { extractJdText } from "@/lib/hunting/extract";
import { charLength, defaultTitle, detectSource, mimeTypeFor, normalizeJd } from "@/lib/hunting/jd-input";

const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/jd/${name}`));
const noAi = { mimeType: "", reserveAiCall: async () => true };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("extractJdText", () => {
  it.each([
    ["txt", "jd-qa-senior.txt"],
    ["docx", "jd-qa-senior.docx"],
    ["pdf", "jd-qa-senior.pdf"],
  ] as const)("lee %s localmente, sin IA", async (source, file) => {
    const text = await extractJdText(source, fixture(file), noAi);
    expect(text).toContain("QA Automation Engineer Senior");
    expect(text).toContain("Playwright");
    expect(text.length).toBeGreaterThan(200);
  });

  it("rechaza una JD de menos de 200 caracteres", async () => {
    await expect(extractJdText("txt", fixture("jd-corta.txt"), noAi)).rejects.toMatchObject({ code: "JD_UNREADABLE" });
  });

  it("rechaza un archivo roto en vez de explotar", async () => {
    const roto = new TextEncoder().encode("esto no es un pdf");
    await expect(extractJdText("pdf", roto, noAi)).rejects.toBeInstanceOf(HuntError);
  });

  it("sin clave de Gemini, una imagen da AI_NOT_CONFIGURED", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(extractJdText("image", new Uint8Array([1, 2, 3]), { ...noAi, mimeType: "image/png" })).rejects.toMatchObject({
      code: "AI_NOT_CONFIGURED",
    });
  });

  // Regression: review 2026-10-01 — las imágenes que fallaban no gastaban cupo y permitían usar Gemini sin límite
  it("sin cupo de IA no llama a Gemini y devuelve AI_LIMIT", async () => {
    vi.stubEnv("GEMINI_API_KEY", "clave-de-prueba");
    const reserveAiCall = vi.fn(async () => false);
    await expect(extractJdText("image", new Uint8Array([1, 2, 3]), { mimeType: "image/png", reserveAiCall })).rejects.toMatchObject({
      code: "AI_LIMIT",
    });
    expect(reserveAiCall).toHaveBeenCalledOnce();
  });

  // Regression: review 2026-10-01 — un .docx "zip bomb" podía agotar la memoria del servidor
  it("rechaza un .docx que se inflaría a más de 20 MB sin descomprimirlo", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "0".repeat(25 * 1024 * 1024));
    const bomb = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    expect(bomb.byteLength).toBeLessThan(1024 * 1024);
    await expect(extractJdText("docx", bomb, noAi)).rejects.toMatchObject({ code: "JD_UNREADABLE" });
  });

  // Regression: review 2026-10-01 — un PDF con miles de páginas trababa la función hasta el timeout
  it("rechaza un PDF de más de 50 páginas", async () => {
    await expect(extractJdText("pdf", fixture("jd-60-paginas.pdf"), noAi)).rejects.toMatchObject({ code: "JD_UNREADABLE" });
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

  it("el MIME para Gemini sale de la extensión, no del navegador", () => {
    expect(mimeTypeFor("captura.WEBP")).toBe("image/webp");
    expect(mimeTypeFor("foto.jpg")).toBe("image/jpeg");
    expect(mimeTypeFor("raro.exe")).toBe("application/octet-stream");
  });

  it("cuenta caracteres como Postgres (los emojis valen 1)", () => {
    expect(charLength("🔥".repeat(150))).toBe(150);
    expect("🔥".repeat(150).length).toBe(300);
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

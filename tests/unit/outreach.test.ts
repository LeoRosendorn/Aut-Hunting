import { describe, expect, it } from "vitest";
import { fitMessage, LONG_MAX, outreachPrompt, SHORT_MAX } from "@/lib/hunting/outreach";
import { candidatePatchSchema, countByStage } from "@/lib/hunting/pipeline-stages";

const plan = {
  role_title: "QA Automation Senior",
  seniority: "senior" as const,
  must_have_skills: ["Playwright", "SQL"],
  location: "Buenos Aires",
  country_code: "AR",
};
const candidate = {
  name: "María José Pérez",
  headline: "QA Automation · Playwright",
  snippet: "5 años automatizando pruebas end-to-end",
  match_reasons: ["Usa Playwright"],
};

describe("fitMessage", () => {
  it("deja igual un texto que entra en el límite", () => {
    expect(fitMessage("Hola María, ¿charlamos?", SHORT_MAX)).toBe("Hola María, ¿charlamos?");
  });

  it("recorta en la última frase completa", () => {
    const text = "Primera frase con bastante texto para ocupar lugar. ".repeat(4) + "Esta frase final no entra completa en el límite.";
    const out = fitMessage(text, 160);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith(".")).toBe(true);
  });

  it("sin puntos cerca, corta en un espacio y agrega puntos suspensivos", () => {
    const out = fitMessage("palabra ".repeat(100), 50);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.endsWith("palabra…")).toBe(true);
  });

  it("nunca supera el máximo de la base", () => {
    for (const max of [SHORT_MAX, LONG_MAX]) {
      expect(fitMessage("x".repeat(max * 2), max).length).toBeLessThanOrEqual(max + 1);
    }
  });
});

describe("outreachPrompt", () => {
  it("usa el nombre de pila, la firma de la reclutadora y voseo para Argentina", () => {
    const prompt = outreachPrompt({ plan, language: "es", recruiterName: "Flor Gómez", candidate });
    expect(prompt).toContain("nombre de pila: María.");
    expect(prompt).toContain("Flor Gómez");
    expect(prompt).toContain("voseo");
  });

  it("escribe en inglés y sin firma si no hay nombre de reclutadora", () => {
    const prompt = outreachPrompt({ plan: { ...plan, country_code: "US" }, language: "en", recruiterName: null, candidate });
    expect(prompt).toContain("Escribí en inglés");
    expect(prompt).toContain("No firmes");
  });
});

describe("candidatePatchSchema", () => {
  it("acepta mover de etapa y rechaza campos que no se pueden editar", () => {
    expect(candidatePatchSchema.safeParse({ stage: "interview" }).success).toBe(true);
    expect(candidatePatchSchema.safeParse({ stage: "hired" }).success).toBe(false);
    expect(candidatePatchSchema.safeParse({ score: 100 }).success).toBe(false);
    expect(candidatePatchSchema.safeParse({ outreach_short: "x".repeat(SHORT_MAX + 1) }).success).toBe(false);
  });

  it("cuenta candidatos por etapa", () => {
    const counts = countByStage([{ stage: "found" }, { stage: "contacted" }, { stage: "contacted" }]);
    expect(counts).toEqual({ found: 1, contacted: 2, replied: 0, interview: 0, discarded: 0 });
  });
});

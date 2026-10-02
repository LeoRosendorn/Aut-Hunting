import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HuntPlan } from "@/lib/hunting/ai-schemas";
import { HuntError } from "@/lib/hunting/errors";

const mocks = vi.hoisted(() => ({
  generateJson: vi.fn(),
  searchLinkedin: vi.fn(),
  remainingSearches: vi.fn(async () => 900),
  exaConfigured: vi.fn(() => false),
  searchPeople: vi.fn(),
}));

vi.mock("@/lib/providers/gemini", () => ({ generateJson: mocks.generateJson }));
vi.mock("@/lib/providers/tavily", () => ({ searchLinkedin: mocks.searchLinkedin }));
vi.mock("@/lib/providers/exa", () => ({ isExaConfigured: mocks.exaConfigured, searchPeople: mocks.searchPeople }));
vi.mock("@/lib/hunting/usage", () => ({ recordUsage: vi.fn(), remainingSearchesThisMonth: mocks.remainingSearches }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { runHunt } = await import("@/lib/hunting/pipeline");

/** Admin de Supabase en memoria: registra updates y upserts para verificarlos. */
function fakeAdmin(initialStatus = "pending") {
  const hunt = { id: "h1", user_id: "u1", jd_text: "JD...", country: "auto", profile_language: "es", status: initialStatus };
  const updates: Record<string, unknown>[] = [];
  const upserts: Record<string, unknown>[][] = [];
  const admin = {
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          const filters: Record<string, unknown> = {};
          const chain = {
            eq(col: string, val: unknown) {
              filters[col] = val;
              return chain;
            },
            select: () => chain,
            async maybeSingle() {
              const ok = filters.status === undefined || filters.status === hunt.status;
              if (!ok) return { data: null };
              Object.assign(hunt, values);
              updates.push(values);
              return { data: { ...hunt } };
            },
            then(resolve: (v: { error: null }) => void) {
              if (filters.status === undefined || filters.status === hunt.status) {
                Object.assign(hunt, values);
                updates.push(values);
              }
              resolve({ error: null });
            },
          };
          return chain;
        },
        async upsert(rows: Record<string, unknown>[]) {
          expect(table).toBe("candidates");
          upserts.push(rows);
          return { error: null };
        },
      };
    },
  };
  return { admin, hunt, updates, upserts };
}

const plan: HuntPlan = {
  role_title: "QA Automation Engineer",
  seniority: "senior",
  must_have_skills: ["Playwright"],
  nice_to_have_skills: [],
  years_min: 5,
  languages: ["Inglés"],
  location: "Buenos Aires",
  country_code: "AR",
  queries: ["QA Automation Playwright Buenos Aires", "SDET Argentina", "QA Engineer Cypress"],
  boolean_string: '("QA Automation" OR SDET) AND Playwright',
};

const result = (slug: string, title: string) => ({ url: `https://ar.linkedin.com/in/${slug}`, title, content: "QA en fintech" });

beforeEach(() => {
  mocks.generateJson.mockReset();
  mocks.searchLinkedin.mockReset();
  mocks.remainingSearches.mockResolvedValue(900);
  mocks.exaConfigured.mockReturnValue(false);
  mocks.searchPeople.mockReset();
});

describe("runHunt", () => {
  it("lee la JD, busca, puntúa y guarda los perfiles ordenados (sin duplicados ni puntaje 0)", async () => {
    mocks.generateJson.mockResolvedValueOnce(plan).mockResolvedValueOnce({
      scores: [
        { index: 0, score: 72, headline: "QA · Playwright", reasons: ["Playwright"], gaps: [] },
        { index: 1, score: 91, reasons: ["Lidera QA"], gaps: ["Sin inglés"] },
        { index: 1, score: 50, reasons: [], gaps: [] }, // índice repetido por la IA
        { index: 2, score: 0, reasons: [], gaps: [] }, // no es una persona
        { index: 99, score: 99, reasons: [], gaps: [] }, // índice inventado
      ],
    });
    mocks.searchLinkedin
      .mockResolvedValueOnce([result("ana", "Ana Paz - QA | LinkedIn"), result("beto", "Beto Ruiz - SDET | LinkedIn")])
      .mockResolvedValueOnce([result("ana", "Ana Paz - QA | LinkedIn"), { url: "https://www.linkedin.com/company/x", title: "X", content: "" }])
      .mockResolvedValue([result("carla", "Carla Sol - Recruiter | LinkedIn")]);

    const { admin, hunt, upserts } = fakeAdmin();
    await runHunt("h1", { admin: admin as never });

    expect(hunt.status).toBe("done");
    expect(upserts).toHaveLength(1);
    expect(upserts[0].map((r) => [r.name, r.score])).toEqual([
      ["Beto Ruiz", 91],
      ["Ana Paz", 72],
    ]);
    expect(upserts[0][0].linkedin_url).toBe("https://www.linkedin.com/in/beto");
    // Tavily recibe el país en inglés (deducido por la IA porque el hunting era "auto").
    expect(mocks.searchLinkedin).toHaveBeenCalledWith(plan.queries[0], "argentina");
  });

  it("no busca más de 8 veces aunque haya pocos resultados", async () => {
    mocks.generateJson
      .mockResolvedValueOnce({ ...plan, queries: ["a1", "a2", "a3", "a4", "a5", "a6"] })
      .mockResolvedValueOnce({ scores: [{ index: 0, score: 80, reasons: [], gaps: [] }] });
    mocks.searchLinkedin.mockResolvedValue([result("ana", "Ana Paz - QA | LinkedIn")]);

    await runHunt("h1", { admin: fakeAdmin().admin as never });
    expect(mocks.searchLinkedin.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it("si no hay perfiles termina en failed/NO_RESULTS y no llama a la IA para puntuar", async () => {
    mocks.generateJson.mockResolvedValueOnce(plan);
    mocks.searchLinkedin.mockResolvedValue([]);
    const { admin, hunt } = fakeAdmin();
    await runHunt("h1", { admin: admin as never });
    expect(hunt.status).toBe("failed");
    expect((hunt as Record<string, unknown>).error_code).toBe("NO_RESULTS");
    expect(mocks.generateJson).toHaveBeenCalledTimes(1);
  });

  it("sin cupo mensual de búsquedas falla con SEARCH_QUOTA_EXHAUSTED sin llamar al buscador", async () => {
    mocks.generateJson.mockResolvedValueOnce(plan);
    mocks.remainingSearches.mockResolvedValue(0);
    const { admin, hunt } = fakeAdmin();
    await runHunt("h1", { admin: admin as never });
    expect((hunt as Record<string, unknown>).error_code).toBe("SEARCH_QUOTA_EXHAUSTED");
    expect(mocks.searchLinkedin).not.toHaveBeenCalled();
  });

  it("un error del proveedor queda registrado con su código", async () => {
    mocks.generateJson.mockRejectedValueOnce(new HuntError("AI_BUSY"));
    const { admin, hunt } = fakeAdmin();
    await runHunt("h1", { admin: admin as never });
    expect(hunt.status).toBe("failed");
    expect((hunt as Record<string, unknown>).error_code).toBe("AI_BUSY");
  });

  it("no corre si el hunting ya no está pending (dos ejecuciones no se pisan)", async () => {
    const { admin } = fakeAdmin("searching");
    await runHunt("h1", { admin: admin as never });
    expect(mocks.generateJson).not.toHaveBeenCalled();
  });

  it("con Exa configurado usa Exa y solo cae a Tavily si Exa falla", async () => {
    mocks.exaConfigured.mockReturnValue(true);
    mocks.generateJson.mockResolvedValueOnce(plan).mockResolvedValueOnce({
      scores: [
        { index: 0, score: 88, reasons: [], gaps: [] },
        { index: 1, score: 70, reasons: [], gaps: [] },
      ],
    });
    mocks.searchPeople
      .mockResolvedValueOnce([result("ana", "Ana Paz - QA | LinkedIn")])
      .mockRejectedValueOnce(new HuntError("SEARCH_QUOTA_EXHAUSTED"));
    mocks.searchLinkedin.mockResolvedValue([result("beto", "Beto Ruiz - SDET | LinkedIn")]);

    const { admin, hunt, upserts } = fakeAdmin();
    await runHunt("h1", { admin: admin as never });

    expect(hunt.status).toBe("done");
    expect(mocks.searchPeople).toHaveBeenCalledTimes(2); // la 2.ª falló: ya no se vuelve a intentar Exa
    expect(mocks.searchPeople).toHaveBeenCalledWith(plan.queries[0], "AR");
    expect(mocks.searchLinkedin).toHaveBeenCalled();
    expect(upserts[0].map((r) => r.name)).toEqual(["Ana Paz", "Beto Ruiz"]);
  });
});

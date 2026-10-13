import { describe, expect, it } from "vitest";
import { searchCacheKey } from "@/lib/hunting/search-cache";
import { dailySearchAllowance } from "@/lib/hunting/usage";

describe("dailySearchAllowance", () => {
  const day = (d: number) => new Date(Date.UTC(2026, 9, d, 15)); // octubre: 31 días

  it("reparte el cupo del mes entre los días que faltan", () => {
    expect(dailySearchAllowance({ cap: 930, usedBeforeToday: 0, usedToday: 0, now: day(1) })).toBe(30);
  });

  it("descuenta lo usado hoy", () => {
    expect(dailySearchAllowance({ cap: 930, usedBeforeToday: 0, usedToday: 30, now: day(1) })).toBe(0);
  });

  it("lo que no se usó en días anteriores se suma a los que quedan", () => {
    // Día 31, nada usado en el mes: todo el cupo está disponible hoy.
    expect(dailySearchAllowance({ cap: 950, usedBeforeToday: 0, usedToday: 0, now: day(31) })).toBe(950);
  });

  it("un día con mucho uso no deja sin búsquedas al resto del mes", () => {
    // El 1 se gastaron 600 de 950: quedan 350 para 30 días → 11 por día, no 0.
    expect(dailySearchAllowance({ cap: 950, usedBeforeToday: 600, usedToday: 0, now: day(2) })).toBe(11);
  });

  it("si el mes ya se pasó del tope, hoy no queda nada", () => {
    expect(dailySearchAllowance({ cap: 950, usedBeforeToday: 980, usedToday: 0, now: day(20) })).toBe(0);
  });
});

describe("searchCacheKey", () => {
  it("ignora mayúsculas, tildes y espacios de más", () => {
    expect(searchCacheKey("  Consultor  SAP CAR Bogotá ", "CO")).toBe(searchCacheKey("consultor sap car bogota", "CO"));
  });

  it("la misma consulta en otro país es otra búsqueda", () => {
    expect(searchCacheKey("QA Senior", "AR")).not.toBe(searchCacheKey("QA Senior", "MX"));
  });
});

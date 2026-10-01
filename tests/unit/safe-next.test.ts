import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-next";

describe("safeNextPath", () => {
  it("acepta rutas internas", () => {
    expect(safeNextPath("/en/app?x=1", "/es/app")).toBe("/en/app?x=1");
  });

  it.each([null, undefined, "", "https://evil.com", "//evil.com", "/\\evil.com", "app"])(
    "rechaza %s y usa el fallback (evita open redirect)",
    (input) => {
      expect(safeNextPath(input, "/es/app")).toBe("/es/app");
    },
  );
});

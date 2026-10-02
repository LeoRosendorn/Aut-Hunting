import { describe, expect, it } from "vitest";
import { normalizeLinkedinUrl, parseProfileTitle } from "@/lib/hunting/linkedin";

describe("normalizeLinkedinUrl", () => {
  it.each([
    ["https://www.linkedin.com/in/lucia-fernandez", "https://www.linkedin.com/in/lucia-fernandez"],
    ["https://ar.linkedin.com/in/Lucia-Fernandez/", "https://www.linkedin.com/in/lucia-fernandez"],
    ["https://linkedin.com/in/lucia-fernandez?trk=public_profile", "https://www.linkedin.com/in/lucia-fernandez"],
    ["https://uy.linkedin.com/in/martin-gomez-12ab34/details/experience/", "https://www.linkedin.com/in/martin-gomez-12ab34"],
    ["http://br.linkedin.com/in/jo%C3%A3o-silva", "https://www.linkedin.com/in/jo%C3%A3o-silva"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeLinkedinUrl(raw)).toBe(expected);
  });

  it.each([
    "https://www.linkedin.com/company/globant",
    "https://www.linkedin.com/jobs/view/123",
    "https://www.linkedin.com/posts/lucia_qa-activity-1",
    "https://www.linkedin.com/pub/dir/Lucia/Fernandez",
    "https://evil-linkedin.com/in/lucia",
    "https://linkedin.com.evil.io/in/lucia",
    "javascript:alert(1)//linkedin.com/in/x",
    "no es una url",
  ])("rechaza lo que no es un perfil: %s", (raw) => {
    expect(normalizeLinkedinUrl(raw)).toBeNull();
  });
});

describe("parseProfileTitle", () => {
  it.each([
    ["Lucía Fernández - QA Automation Lead - Mercado Libre | LinkedIn", "Lucía Fernández", "QA Automation Lead · Mercado Libre"],
    ["Martín Gómez – SDET Senior · LinkedIn", "Martín Gómez", "SDET Senior"],
    ["Valentina Ruiz | LinkedIn", "Valentina Ruiz", null],
    // Formato de Exa (category "people")
    ["Emiliana Corbatta | Senior QA Automation Engineer | Cypress & Playwright", "Emiliana Corbatta", "Senior QA Automation Engineer · Cypress & Playwright"],
  ])("%s", (title, name, headline) => {
    expect(parseProfileTitle(title)).toEqual({ name, headline });
  });
});

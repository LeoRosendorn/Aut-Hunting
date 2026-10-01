// Verifica que es/en/pt tengan exactamente las mismas claves y ningún valor vacío (criterio 15).
import { readFileSync } from "node:fs";

const LOCALES = ["es", "en", "pt"];

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
}

const maps = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    new Map(flatten(JSON.parse(readFileSync(`messages/${l}.json`, "utf8")))),
  ]),
);
const allKeys = new Set(LOCALES.flatMap((l) => [...maps[l].keys()]));

const problems = [];
for (const key of allKeys) {
  for (const l of LOCALES) {
    const value = maps[l].get(key);
    if (value === undefined) problems.push(`${l}: falta "${key}"`);
    else if (typeof value === "string" && value.trim() === "")
      problems.push(`${l}: "${key}" vacío`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`i18n OK: ${allKeys.size} claves × ${LOCALES.length} idiomas`);

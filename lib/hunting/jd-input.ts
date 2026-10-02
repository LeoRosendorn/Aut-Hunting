/** Reglas de entrada de la JD, compartidas por el formulario (cliente) y la API (servidor). */

// Vercel Hobby corta los request bodies en 4,5 MB; dejamos margen para el resto del formulario.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MIN_JD_CHARS = 200;
export const MAX_JD_CHARS = 30_000;

export type JdSource = "text" | "pdf" | "docx" | "txt" | "image";

const BY_EXTENSION: Record<string, Exclude<JdSource, "text">> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "txt",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
};

export const ACCEPT_ATTR = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp";

/** Tipo de archivo por extensión: el MIME que manda el navegador no es confiable (Windows suele mandar vacío para .md/.docx). */
export function detectSource(fileName: string): Exclude<JdSource, "text"> | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return BY_EXTENSION[ext] ?? null;
}

/** Colapsa espacios y saltos de línea repetidos que dejan los PDF y Word. */
export function normalizeJd(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Título por defecto: la primera línea de la JD, que casi siempre es el puesto.
 * El nombre del archivo ("JD_final_v2.pdf") solo se usa si esa línea es un párrafo largo.
 */
export function defaultTitle(text: string, fileName?: string) {
  const firstLine = text.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  const base = fileName?.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const title = firstLine.length <= 80 || !base ? firstLine : base;
  return title.length > 80 ? `${title.slice(0, 77)}…` : title;
}

export const COUNTRIES = [
  "auto",
  "AR", "UY", "CL", "PY", "BO", "PE", "CO", "EC", "VE", "MX",
  "CR", "PA", "GT", "DO", "BR", "ES", "US", "PT",
] as const;
export type CountryCode = (typeof COUNTRIES)[number];

export const PROFILE_LANGUAGES = ["es", "en", "pt"] as const;
export type ProfileLanguage = (typeof PROFILE_LANGUAGES)[number];

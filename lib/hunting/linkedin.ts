/**
 * Normaliza un perfil público de LinkedIn a `https://www.linkedin.com/in/<slug>`.
 * Acepta subdominios de país (ar.linkedin.com), barras finales, query strings y rutas extra
 * (/in/slug/details/...). Devuelve null si no es un perfil (/company, /jobs, /posts, /pub/dir...).
 */
export function normalizeLinkedinUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;

  const match = url.pathname.match(/^\/in\/([^/?#]+)/i);
  if (!match) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(match[1]).toLowerCase();
  } catch {
    return null;
  }
  if (!/^[\p{L}\p{N}_-]{3,100}$/u.test(slug)) return null;
  return `https://www.linkedin.com/in/${encodeURIComponent(slug)}`;
}

export type ParsedProfile = { name: string; headline: string | null };

/**
 * Los buscadores titulan los perfiles así: "Nombre Apellido - Titular - Empresa | LinkedIn"
 * (o con "–" / "·"). Se separa el nombre del resto.
 */
export function parseProfileTitle(title: string): ParsedProfile {
  const clean = title.replace(/\s*[|·]\s*LinkedIn\s*$/i, "").trim();
  const [name, ...rest] = clean.split(/\s+[-–—]\s+/);
  const headline = rest.join(" · ").trim();
  return { name: (name ?? clean).trim().slice(0, 120), headline: headline ? headline.slice(0, 300) : null };
}

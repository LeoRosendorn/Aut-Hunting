/** Acepta solo rutas internas ("/es/app"), nunca URLs absolutas ni "//host", para evitar open redirects. */
export function safeNextPath(next: string | null | undefined, fallback: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}

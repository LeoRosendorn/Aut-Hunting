import "server-only";
import { headers } from "next/headers";

/** URL pública de la app: NEXT_PUBLIC_SITE_URL si está, si no el origen del request (útil en previews de Vercel). */
export async function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

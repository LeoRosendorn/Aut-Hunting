import { after, NextResponse, type NextRequest } from "next/server";
import { HuntError, type HuntErrorCode } from "@/lib/hunting/errors";
import { extractJdText } from "@/lib/hunting/extract";
import { runHunt } from "@/lib/hunting/pipeline";
import {
  charLength,
  COUNTRIES,
  defaultTitle,
  detectSource,
  MAX_FILE_BYTES,
  MAX_JD_CHARS,
  MIN_JD_CHARS,
  mimeTypeFor,
  normalizeJd,
  PROFILE_LANGUAGES,
  type JdSource,
} from "@/lib/hunting/jd-input";
import { consumeAiCall, huntQuota, isDailyLimitError } from "@/lib/hunting/quota";
import { remainingSearchesToday } from "@/lib/hunting/usage";
import { isExaConfigured } from "@/lib/providers/exa";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// La respuesta sale enseguida; la búsqueda sigue en segundo plano con after() hasta 300 s (Vercel Hobby).
export const maxDuration = 300;

// Margen para los campos de texto del formulario además del archivo.
const MAX_BODY_BYTES = MAX_FILE_BYTES + 64 * 1024;

const STATUS: Partial<Record<HuntErrorCode, number>> = {
  DAILY_LIMIT: 429,
  AI_LIMIT: 429,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE: 415,
  INTERNAL: 500,
  AI_NOT_CONFIGURED: 503,
  AI_BUSY: 503,
  SEARCH_QUOTA_EXHAUSTED: 503,
};

function fail(code: HuntErrorCode) {
  return NextResponse.json({ error: code }, { status: STATUS[code] ?? 400 });
}

/** Crea un hunting a partir de una JD pegada o de un archivo y lanza la búsqueda de perfiles en segundo plano. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // Se corta antes de leer el cuerpo en memoria.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return fail("FILE_TOO_LARGE");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("INVALID_INPUT");
  }

  const country = String(form.get("country") ?? "auto");
  const profileLanguage = String(form.get("profileLanguage") ?? "es");
  if (!(COUNTRIES as readonly string[]).includes(country)) return fail("INVALID_INPUT");
  if (!(PROFILE_LANGUAGES as readonly string[]).includes(profileLanguage)) return fail("INVALID_INPUT");

  try {
    // Chequeo rápido para no leer archivos ni gastar IA en vano. El límite real lo aplica
    // el trigger de la base al insertar (también frente a pedidos simultáneos).
    if ((await huntQuota(supabase)).remaining <= 0) return fail("DAILY_LIMIT");
    // Sin Exa, toda búsqueda nueva sale del cupo diario de Tavily: si ya no queda, se avisa antes
    // de descontarle el hunting a la usuaria. (Con Exa, el pipeline cae a Tavily solo si Exa falla.)
    if (!isExaConfigured() && (await remainingSearchesToday(createAdminClient())) <= 0) {
      return fail("SEARCH_QUOTA_EXHAUSTED");
    }

    const file = form.get("file");
    let jdText: string;
    let source: JdSource;
    let fileName: string | undefined;

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) return fail("FILE_TOO_LARGE");
      const detected = detectSource(file.name);
      if (!detected) return fail("UNSUPPORTED_FILE");
      source = detected;
      fileName = file.name;
      jdText = await extractJdText(detected, new Uint8Array(await file.arrayBuffer()), {
        mimeType: mimeTypeFor(file.name),
        reserveAiCall: () => consumeAiCall(supabase),
      });
    } else {
      source = "text";
      jdText = normalizeJd(String(form.get("text") ?? ""));
    }

    const length = charLength(jdText);
    if (length < MIN_JD_CHARS) return fail("JD_TOO_SHORT");
    if (length > MAX_JD_CHARS) return fail("JD_TOO_LONG");

    const title = String(form.get("title") ?? "").trim().slice(0, 120) || defaultTitle(jdText, fileName);

    const { data, error } = await supabase
      .from("hunts")
      .insert({
        user_id: auth.user.id,
        title,
        jd_text: jdText,
        jd_source: source,
        country,
        profile_language: profileLanguage,
      })
      .select("id")
      .single();
    if (isDailyLimitError(error)) return fail("DAILY_LIMIT");
    if (error) throw error;

    after(() => runHunt(data.id));
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    if (err instanceof HuntError) return fail(err.code);
    console.error("POST /api/hunts", err);
    return fail("INTERNAL");
  }
}

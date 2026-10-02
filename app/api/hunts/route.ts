import { NextResponse, type NextRequest } from "next/server";
import { HuntError, type HuntErrorCode } from "@/lib/hunting/errors";
import { extractJdText } from "@/lib/hunting/extract";
import {
  COUNTRIES,
  defaultTitle,
  detectSource,
  MAX_FILE_BYTES,
  MAX_JD_CHARS,
  MIN_JD_CHARS,
  normalizeJd,
  PROFILE_LANGUAGES,
  type JdSource,
} from "@/lib/hunting/jd-input";
import { remainingHuntsToday } from "@/lib/hunting/quota";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const STATUS: Partial<Record<HuntErrorCode, number>> = {
  DAILY_LIMIT: 429,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE: 415,
  INTERNAL: 500,
  AI_NOT_CONFIGURED: 503,
};

function fail(code: HuntErrorCode) {
  return NextResponse.json({ error: code }, { status: STATUS[code] ?? 400 });
}

/** Crea un hunting a partir de una JD pegada o de un archivo. Por ahora queda en estado "pending". */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

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
    // El cupo se revisa antes de leer el archivo: no gastamos IA en un hunting que no se va a crear.
    if ((await remainingHuntsToday(supabase)) <= 0) return fail("DAILY_LIMIT");

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
      jdText = await extractJdText(detected, new Uint8Array(await file.arrayBuffer()), file.type);
    } else {
      source = "text";
      jdText = normalizeJd(String(form.get("text") ?? ""));
    }

    if (jdText.length < MIN_JD_CHARS) return fail("JD_TOO_SHORT");
    if (jdText.length > MAX_JD_CHARS) return fail("JD_TOO_LONG");

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
    if (error) throw error;

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    if (err instanceof HuntError) return fail(err.code);
    console.error("POST /api/hunts", err);
    return fail("INTERNAL");
  }
}

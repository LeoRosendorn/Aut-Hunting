import "server-only";
import { ApiError, createPartFromBase64, GoogleGenAI } from "@google/genai";
import { HuntError } from "@/lib/hunting/errors";

// "gemini-flash-latest" apunta siempre al Flash vigente de la capa gratuita; se puede fijar con GEMINI_MODEL.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const GEMINI_TIMEOUT_MS = 30_000;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function gemini() {
  if (!isGeminiConfigured()) throw new HuntError("AI_NOT_CONFIGURED");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

/** Transcribe el texto de una imagen o PDF escaneado de una JD. */
export async function readWithGemini(bytes: Uint8Array, mimeType: string) {
  const ai = gemini();
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            createPartFromBase64(Buffer.from(bytes).toString("base64"), mimeType),
            {
              text:
                "Transcribí textualmente la descripción de puesto (Job Description) de este archivo. " +
                "Devolvé solo el texto, sin comentarios ni formato Markdown. " +
                "Si no contiene una descripción de puesto legible, devolvé una cadena vacía.",
            },
          ],
        },
      ],
      config: { abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS) },
    });
    return response.text ?? "";
  } catch (err) {
    // 400: Gemini no pudo leer el archivo. 429/5xx/timeout: la capa gratuita está saturada.
    if (err instanceof ApiError && err.status === 400) throw new HuntError("JD_UNREADABLE");
    console.error("Gemini readWithGemini", err instanceof ApiError ? err.status : err);
    throw new HuntError("AI_BUSY");
  }
}

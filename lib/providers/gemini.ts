import "server-only";
import { ApiError, createPartFromBase64, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { HuntError } from "@/lib/hunting/errors";

// "gemini-flash-latest" apunta siempre al Flash vigente de la capa gratuita; se puede fijar con GEMINI_MODEL.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const GEMINI_TIMEOUT_MS = 30_000;
// Puntuar 40 perfiles de una sola vez tarda más que leer una imagen.
const GEMINI_PIPELINE_TIMEOUT_MS = 90_000;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function gemini() {
  if (!isGeminiConfigured()) throw new HuntError("AI_NOT_CONFIGURED");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

/**
 * Pide JSON con el esquema dado y lo valida con Zod (la salida de un LLM nunca se guarda sin validar).
 * Si el JSON no cumple, reintenta una vez; si vuelve a fallar → AI_BUSY.
 */
export async function generateJson<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  const ai = gemini();
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string;
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema),
          temperature: 0.2,
          abortSignal: AbortSignal.timeout(GEMINI_PIPELINE_TIMEOUT_MS),
        },
      });
      text = response.text ?? "";
    } catch (err) {
      console.error("Gemini generateJson", err instanceof ApiError ? err.status : err);
      throw new HuntError("AI_BUSY");
    }
    try {
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
    } catch {
      // JSON inválido: se reintenta.
    }
  }
  throw new HuntError("AI_BUSY");
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

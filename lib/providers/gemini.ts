import "server-only";
import { ApiError, createPartFromBase64, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { HuntError } from "@/lib/hunting/errors";

// Alias que Google mantiene apuntando al Flash vigente de la capa gratuita (los nombres con versión
// se retiran: gemini-2.5-flash ya devuelve 404). Si el primero está saturado (429/503) se usa el siguiente.
export const GEMINI_MODELS = (process.env.GEMINI_MODELS || "gemini-flash-latest,gemini-flash-lite-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

function isOverloaded(err: unknown) {
  return err instanceof ApiError && (err.status === 429 || err.status === 503);
}

/** Llama a Gemini probando cada modelo de GEMINI_MODELS mientras el anterior esté saturado. */
async function withModelFallback<T>(call: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      return await call(model);
    } catch (err) {
      lastError = err;
      if (!isOverloaded(err)) break;
    }
  }
  throw lastError;
}
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

// Restricciones que Gemini acepta de a una pero rechaza combinadas ("schema too complex" → 400).
const CONSTRAINT_KEYS = new Set([
  "$schema", "minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum", "pattern", "format",
]);

/** Esquema para Gemini: solo la estructura (campos y tipos). Los límites los valida Zod después. */
export function toGeminiSchema(schema: z.ZodType): unknown {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    return Object.fromEntries(
      Object.entries(node).filter(([key]) => !CONSTRAINT_KEYS.has(key)).map(([key, value]) => [key, strip(value)]),
    );
  };
  return strip(z.toJSONSchema(schema));
}

/**
 * Pide JSON con el esquema dado y lo valida con Zod (la salida de un LLM nunca se guarda sin validar).
 * Si el JSON no cumple, reintenta una vez; si vuelve a fallar → AI_BUSY.
 */
export async function generateJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  { temperature = 0.2 }: { temperature?: number } = {},
): Promise<T> {
  const ai = gemini();
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string;
    try {
      const response = await withModelFallback((model) => ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: toGeminiSchema(schema),
          temperature,
          abortSignal: AbortSignal.timeout(GEMINI_PIPELINE_TIMEOUT_MS),
        },
      }));
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
    const response = await withModelFallback((model) => ai.models.generateContent({
      model,
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
    }));
    return response.text ?? "";
  } catch (err) {
    // 400: Gemini no pudo leer el archivo. 429/5xx/timeout: la capa gratuita está saturada.
    if (err instanceof ApiError && err.status === 400) throw new HuntError("JD_UNREADABLE");
    console.error("Gemini readWithGemini", err instanceof ApiError ? err.status : err);
    throw new HuntError("AI_BUSY");
  }
}

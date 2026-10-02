import "server-only";
import { createPartFromBase64, GoogleGenAI } from "@google/genai";
import { HuntError } from "@/lib/hunting/errors";

// "gemini-flash-latest" apunta siempre al Flash vigente de la capa gratuita; se puede fijar con GEMINI_MODEL.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function gemini() {
  if (!isGeminiConfigured()) throw new HuntError("AI_NOT_CONFIGURED");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

/** Transcribe el texto de una imagen o PDF escaneado de una JD. */
export async function readWithGemini(bytes: Uint8Array, mimeType: string) {
  const response = await gemini().models.generateContent({
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
  });
  return response.text ?? "";
}

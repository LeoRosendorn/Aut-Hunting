import "server-only";
import { createPartFromBase64, GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Alias que Google mantiene apuntando al modelo vigente de la capa gratuita (los nombres con versión
// se retiran: gemini-2.5-flash ya devuelve 404). El lite responde en 1-8 s y tiene mucho más cupo
// gratis por día; el Flash tarda 10-30 s con demanda alta y su cupo gratis se agota enseguida.
export const GEMINI_LITE = "gemini-flash-lite-latest";
export const GEMINI_FLASH = "gemini-flash-latest";

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function gemini() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// Restricciones que Gemini acepta de a una pero rechaza combinadas ("schema too complex" → 400).
const CONSTRAINT_KEYS = new Set([
  "$schema", "minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum", "pattern", "format",
]);

/** Esquema para la IA: solo la estructura (campos y tipos). Los límites los valida Zod después. */
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

/** Pide JSON con el esquema dado y devuelve el texto crudo (lo valida el router con Zod). */
export async function geminiJson(
  model: string,
  prompt: string,
  jsonSchema: unknown,
  { temperature, abortSignal }: { temperature: number; abortSignal: AbortSignal },
) {
  const response = await gemini().models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json", responseJsonSchema: jsonSchema, temperature, abortSignal },
  });
  return response.text ?? "";
}

/** Transcribe el texto de una imagen o PDF escaneado de una JD. */
export async function geminiRead(model: string, bytes: Uint8Array, mimeType: string, abortSignal: AbortSignal) {
  const response = await gemini().models.generateContent({
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
    config: { abortSignal },
  });
  return response.text ?? "";
}

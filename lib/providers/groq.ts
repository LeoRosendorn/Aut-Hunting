import "server-only";

// Capa gratuita de Groq: cupo propio (independiente de Gemini) y respuestas muy rápidas.
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

/** Error HTTP de Groq, con el status para que el router decida si probar otro proveedor. */
export class GroqApiError extends Error {
  constructor(readonly status: number) {
    super(`Groq respondió ${status}`);
    this.name = "GroqApiError";
  }
}

/** Pide JSON con el esquema dado y devuelve el texto crudo (lo valida el router con Zod). */
export async function groqJson(
  prompt: string,
  jsonSchema: unknown,
  { temperature, abortSignal }: { temperature: number; abortSignal: AbortSignal },
) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature,
      // Sin strict: Groq solo lo acepta en algunos modelos. La forma final la garantiza Zod.
      response_format: { type: "json_schema", json_schema: { name: "respuesta", schema: jsonSchema } },
    }),
    signal: abortSignal,
  });
  if (!res.ok) throw new GroqApiError(res.status);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  return body.choices?.[0]?.message?.content ?? "";
}

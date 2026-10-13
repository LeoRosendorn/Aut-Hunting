import "server-only";
import { ApiError } from "@google/genai";
import type { z } from "zod";
import { HuntError } from "@/lib/hunting/errors";
import { GEMINI_FLASH, GEMINI_LITE, geminiJson, geminiRead, isGeminiConfigured, toGeminiSchema } from "./gemini";
import { GROQ_MODEL, GroqApiError, groqJson, isGroqConfigured } from "./groq";

/**
 * Router de IA sobre las capas gratuitas: prueba los proveedores en orden y salta al siguiente si
 * uno falla. El que está saturado (429, 5xx o timeout) queda en pausa unos minutos, así los pedidos
 * siguientes no vuelven a esperarlo. Cada intento tiene su timeout y todos juntos un tope total
 * (las funciones de Vercel tienen un maxDuration).
 */

type Budget = { perAttemptMs: number; totalMs: number };
// Lectura de imágenes: el lite tarda 1-2 s.
const READ_BUDGET: Budget = { perAttemptMs: 25_000, totalMs: 45_000 };
// Plan y puntaje de 40 perfiles: el lite tarda 2-10 s.
export const PIPELINE_BUDGET: Budget = { perAttemptMs: 60_000, totalMs: 120_000 };
// La ruta del mensaje de contacto tiene maxDuration = 60.
export const OUTREACH_BUDGET: Budget = { perAttemptMs: 20_000, totalMs: 45_000 };

type JsonOptions = { temperature: number; abortSignal: AbortSignal };
type Provider<Run> = { id: string; configured: () => boolean; run: Run };

const JSON_PROVIDERS: Provider<(prompt: string, jsonSchema: unknown, options: JsonOptions) => Promise<string>>[] = [
  { id: `gemini:${GEMINI_LITE}`, configured: isGeminiConfigured, run: (...args) => geminiJson(GEMINI_LITE, ...args) },
  { id: `groq:${GROQ_MODEL}`, configured: isGroqConfigured, run: groqJson },
  { id: `gemini:${GEMINI_FLASH}`, configured: isGeminiConfigured, run: (...args) => geminiJson(GEMINI_FLASH, ...args) },
];

const READ_PROVIDERS: Provider<(bytes: Uint8Array, mimeType: string, abortSignal: AbortSignal) => Promise<string>>[] = [
  { id: `gemini:${GEMINI_LITE}`, configured: isGeminiConfigured, run: (...args) => geminiRead(GEMINI_LITE, ...args) },
  { id: `gemini:${GEMINI_FLASH}`, configured: isGeminiConfigured, run: (...args) => geminiRead(GEMINI_FLASH, ...args) },
];

/** Hasta cuándo (epoch ms) cada proveedor queda en pausa. Vive en la instancia (Fluid Compute la reutiliza). */
const cooldownUntil = new Map<string, number>();

function statusOf(err: unknown) {
  if (err instanceof ApiError || err instanceof GroqApiError) return err.status;
  return undefined;
}

function isOverloaded(err: unknown) {
  const status = statusOf(err);
  if (status !== undefined) return status === 429 || status >= 500;
  return err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
}

/** Los disponibles primero; los que están en pausa quedan al final como último recurso. */
function byAvailability<T extends Provider<unknown>>(providers: T[]) {
  const now = Date.now();
  const configured = providers.filter((p) => p.configured());
  const resting = (p: T) => (cooldownUntil.get(p.id) ?? 0) > now;
  return [...configured.filter((p) => !resting(p)), ...configured.filter(resting)];
}

class InvalidJsonError extends Error {
  name = "InvalidJsonError";
}

async function runChain<T, P extends Provider<unknown>>(
  providers: P[],
  budget: Budget,
  attempt: (provider: P, abortSignal: AbortSignal) => Promise<T>,
  isFatal: (err: unknown) => boolean = () => false,
): Promise<{ value: T; provider: string }> {
  const ordered = byAvailability(providers);
  if (ordered.length === 0) throw new HuntError("AI_NOT_CONFIGURED");

  const deadline = AbortSignal.timeout(budget.totalMs);
  let lastError: unknown;
  for (const provider of ordered) {
    try {
      const signal = AbortSignal.any([AbortSignal.timeout(budget.perAttemptMs), deadline]);
      return { value: await attempt(provider, signal), provider: provider.id };
    } catch (err) {
      if (isFatal(err)) throw err;
      lastError = err;
      console.error("IA", provider.id, statusOf(err) ?? (err instanceof Error ? err.name : err));
      if (deadline.aborted) break;
      if (isOverloaded(err)) cooldownUntil.set(provider.id, Date.now() + (statusOf(err) === 429 ? 120_000 : 60_000));
    }
  }
  throw lastError;
}

/**
 * Pide JSON con el esquema dado y lo valida con Zod (la salida de un LLM nunca se guarda sin validar).
 * Si un proveedor falla o devuelve JSON inválido, prueba el siguiente; si fallan todos → AI_BUSY.
 * `onProvider` recibe el proveedor que respondió, para medir el consumo.
 */
export async function generateJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  {
    temperature = 0.2,
    budget = PIPELINE_BUDGET,
    onProvider,
  }: { temperature?: number; budget?: Budget; onProvider?: (provider: string) => void } = {},
): Promise<T> {
  const jsonSchema = toGeminiSchema(schema);
  try {
    const { value, provider } = await runChain(JSON_PROVIDERS, budget, async (p, abortSignal) => {
      const text = await p.run(prompt, jsonSchema, { temperature, abortSignal });
      let parsed: z.ZodSafeParseResult<T>;
      try {
        parsed = schema.safeParse(JSON.parse(text));
      } catch {
        throw new InvalidJsonError();
      }
      if (!parsed.success) throw new InvalidJsonError();
      return parsed.data;
    });
    onProvider?.(provider);
    return value;
  } catch (err) {
    if (err instanceof HuntError) throw err;
    throw new HuntError("AI_BUSY");
  }
}

/** Transcribe el texto de una imagen o PDF escaneado de una JD. */
export async function readJdWithAi(bytes: Uint8Array, mimeType: string) {
  try {
    const { value } = await runChain(
      READ_PROVIDERS,
      READ_BUDGET,
      (p, abortSignal) => p.run(bytes, mimeType, abortSignal),
      // 400: el archivo no se puede leer; otro modelo tampoco va a poder.
      (err) => statusOf(err) === 400,
    );
    return value;
  } catch (err) {
    if (err instanceof HuntError) throw err;
    if (statusOf(err) === 400) throw new HuntError("JD_UNREADABLE");
    throw new HuntError("AI_BUSY");
  }
}

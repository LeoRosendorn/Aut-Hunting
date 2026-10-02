import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { readWithGemini } from "@/lib/providers/gemini";
import { HuntError } from "./errors";
import { MIN_JD_CHARS, normalizeJd, type JdSource } from "./jd-input";

/**
 * Devuelve el texto de la JD. PDF con texto, DOCX y TXT se leen localmente (sin costo de IA);
 * las imágenes y los PDF escaneados (sin capa de texto) se le pasan a Gemini.
 */
export async function extractJdText(source: Exclude<JdSource, "text">, bytes: Uint8Array, mimeType: string) {
  let text = "";

  if (source === "txt") {
    text = new TextDecoder("utf-8").decode(bytes);
  } else if (source === "docx") {
    try {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } catch {
      throw new HuntError("JD_UNREADABLE");
    }
  } else if (source === "pdf") {
    try {
      const pdf = await getDocumentProxy(bytes.slice());
      text = (await extractText(pdf, { mergePages: true })).text as string;
    } catch {
      throw new HuntError("JD_UNREADABLE");
    }
    // PDF escaneado: no tiene capa de texto, hay que leerlo como imagen.
    if (normalizeJd(text).length < MIN_JD_CHARS) text = await readWithGemini(bytes, "application/pdf");
  } else {
    text = await readWithGemini(bytes, mimeType || "image/png");
  }

  const normalized = normalizeJd(text);
  if (normalized.length < MIN_JD_CHARS) throw new HuntError("JD_UNREADABLE");
  return normalized;
}

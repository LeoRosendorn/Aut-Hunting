import "server-only";
import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { readWithGemini } from "@/lib/providers/gemini";
import { HuntError } from "./errors";
import { MIN_JD_CHARS, normalizeJd, type JdSource } from "./jd-input";

/** Un .docx de 4 MB que se descomprime a más que esto es un "zip bomb", no una JD. */
export const MAX_DOCX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
/** Una JD real tiene 1-5 páginas; un PDF con miles de páginas solo sirve para trabar el servidor. */
export const MAX_PDF_PAGES = 50;
const LOCAL_EXTRACTION_TIMEOUT_MS = 20_000;

type ExtractOptions = {
  mimeType: string;
  /** Reserva un uso de IA antes de cada llamada a Gemini; false = ya usó los de hoy. */
  reserveAiCall: () => Promise<boolean>;
};

/**
 * Devuelve el texto de la JD. PDF con texto, DOCX y TXT se leen localmente (sin costo de IA);
 * las imágenes y los PDF escaneados (sin capa de texto) se le pasan a Gemini.
 */
export async function extractJdText(source: Exclude<JdSource, "text">, bytes: Uint8Array, options: ExtractOptions) {
  let text = "";

  if (source === "txt") {
    text = new TextDecoder("utf-8").decode(bytes);
  } else if (source === "docx") {
    await assertDocxSize(bytes);
    text = await withTimeout(mammoth.extractRawText({ buffer: Buffer.from(bytes) }).then((r) => r.value));
  } else if (source === "pdf") {
    text = await withTimeout(readPdfText(bytes));
    // PDF escaneado: no tiene capa de texto, hay que leerlo como imagen.
    if (normalizeJd(text).length < MIN_JD_CHARS) text = await readWithAi(bytes, "application/pdf", options);
  } else {
    text = await readWithAi(bytes, options.mimeType, options);
  }

  const normalized = normalizeJd(text);
  if (normalized.length < MIN_JD_CHARS) throw new HuntError("JD_UNREADABLE");
  return normalized;
}

async function readWithAi(bytes: Uint8Array, mimeType: string, options: ExtractOptions) {
  if (!(await options.reserveAiCall())) throw new HuntError("AI_LIMIT");
  return readWithGemini(bytes, mimeType);
}

async function readPdfText(bytes: Uint8Array) {
  // pdf.js se queda con el buffer que recibe: se le pasa una copia.
  const pdf = await getDocumentProxy(bytes.slice()).catch(() => {
    throw new HuntError("JD_UNREADABLE");
  });
  if (pdf.numPages > MAX_PDF_PAGES) throw new HuntError("JD_UNREADABLE");
  return (await extractText(pdf, { mergePages: true })).text as string;
}

/** Lee solo el índice del zip (sin descomprimir) y rechaza el archivo si se inflaría demasiado. */
async function assertDocxSize(bytes: Uint8Array) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new HuntError("JD_UNREADABLE");
  }
  let total = 0;
  zip.forEach((_path, entry) => {
    // `_data.uncompressedSize` sale del directorio central del zip; JSZip no lo expone tipado.
    total += (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
  });
  if (total > MAX_DOCX_UNCOMPRESSED_BYTES) throw new HuntError("JD_UNREADABLE");
}

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new HuntError("JD_UNREADABLE")), LOCAL_EXTRACTION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } catch (err) {
    throw err instanceof HuntError ? err : new HuntError("JD_UNREADABLE");
  } finally {
    clearTimeout(timer);
  }
}

/** Códigos de error de un hunting; cada uno tiene su texto en `newHunt.errors.*` de messages/*.json. */
export type HuntErrorCode =
  | "JD_TOO_SHORT"
  | "JD_TOO_LONG"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE"
  | "JD_UNREADABLE"
  | "AI_NOT_CONFIGURED"
  | "DAILY_LIMIT"
  | "INVALID_INPUT"
  | "INTERNAL";

export class HuntError extends Error {
  constructor(public code: HuntErrorCode) {
    super(code);
  }
}

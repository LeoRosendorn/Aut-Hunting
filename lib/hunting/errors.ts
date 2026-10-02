/** Códigos de error de un hunting; cada uno tiene su texto en `newHunt.errors.*` de messages/*.json. */
export type HuntErrorCode =
  | "JD_TOO_SHORT"
  | "JD_TOO_LONG"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE"
  | "JD_UNREADABLE"
  | "AI_NOT_CONFIGURED"
  | "AI_LIMIT"
  | "AI_BUSY"
  | "SEARCH_NOT_CONFIGURED"
  | "SEARCH_BUSY"
  | "SEARCH_QUOTA_EXHAUSTED"
  | "NO_RESULTS"
  | "DAILY_LIMIT"
  | "INVALID_INPUT"
  | "INTERNAL";

export class HuntError extends Error {
  constructor(public code: HuntErrorCode) {
    super(code);
  }
}

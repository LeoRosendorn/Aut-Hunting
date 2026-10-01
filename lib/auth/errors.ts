/** Claves de `auth.errors.*` en messages/*.json. */
export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "weakPassword"
  | "invalidEmail"
  | "nameRequired"
  | "userExists"
  | "rateLimited"
  | "callback"
  | "generic";

/** Traduce el `code` de un AuthError de Supabase a una clave de mensaje propia. */
export function mapSupabaseAuthError(code: string | undefined): AuthErrorKey {
  switch (code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "weak_password":
      return "weakPassword";
    case "email_address_invalid":
    case "validation_failed":
      return "invalidEmail";
    case "user_already_exists":
    case "email_exists":
      return "userExists";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rateLimited";
    default:
      return "generic";
  }
}

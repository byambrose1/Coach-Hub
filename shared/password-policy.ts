// Matches the Supabase project's configured password strength requirement
// (Authentication -> Policies -> Password Requirements): 8+ characters with
// at least one lowercase, one uppercase, one digit and one symbol. Keeping
// this in one place means the client hint and the server validation can
// never drift apart again.
export const PASSWORD_POLICY_HINT = "8+ characters, with uppercase, lowercase, a number and a symbol";

export function passwordMeetsPolicy(password: string): boolean {
  return password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

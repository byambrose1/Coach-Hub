export const socialAuthProviders = ["google", "apple"] as const;
export type SocialAuthProvider = typeof socialAuthProviders[number];
export type AuthProviders = Record<SocialAuthProvider | "email", boolean>;
export const socialAuthLabels: Record<SocialAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
};
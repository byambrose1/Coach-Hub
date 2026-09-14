export type OnboardingProgress = Record<string, boolean>;

export function parseOnboardingProgress(value?: string | null): OnboardingProgress {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

export function serializeOnboardingProgress(progress: OnboardingProgress): string {
  return JSON.stringify(progress);
}

export function toggleOnboardingStep(
  progress: OnboardingProgress,
  id: string,
): OnboardingProgress {
  return { ...progress, [id]: !progress[id] };
}
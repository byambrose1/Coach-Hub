import { useQuery } from "@tanstack/react-query";
import type { Settings } from "@shared/schema";
import { hasFeature, type FeatureName } from "@shared/subscription-features";

export function useFeatureAccess() {
  const query = useQuery<Settings>({ queryKey: ["/api/settings"] });
  return {
    settings: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    hasFeature: (feature: FeatureName) => !query.isError && hasFeature(query.data, feature),
  };
}
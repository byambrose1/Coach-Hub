const STORAGE_KEY = "practably_attribution";

// Captures utm_source/utm_campaign/utm_medium from the URL once, on first
// load, and keeps it in sessionStorage - so a visitor who clicks an ad,
// browses around the SPA, then opens the waitlist dialog from a different
// page still gets correctly attributed. Falls back silently if storage is
// unavailable (private browsing etc).
export function captureAttributionFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("utm_source");
    if (!source) return;
    const campaign = params.get("utm_campaign");
    const medium = params.get("utm_medium");
    const label = [source, medium, campaign].filter(Boolean).join(" / ");
    sessionStorage.setItem(STORAGE_KEY, label);
  } catch {
    // ignore - attribution is a nice-to-have, never block the app on it
  }
}

export function getAttribution(): string | undefined {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function permissionMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "status" in error && error.status === 403) {
    return fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

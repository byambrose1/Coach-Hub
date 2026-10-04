export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function responseError(response: Response): Promise<ApiError> {
  const body = await response.text();
  try {
    const data = JSON.parse(body);
    if (typeof data?.message === "string" && data.message.trim()) {
      return new ApiError(data.message, response.status, typeof data.code === "string" ? data.code : undefined);
    }
  } catch {
    // Do not expose proxy HTML, raw JSON, or provider internals in a toast.
  }
  const message = response.status === 401
    ? "Please sign in again to continue."
    : response.status === 403
      ? "You do not have permission to perform this action."
      : response.status === 429
        ? "Too many requests. Please wait a moment and try again."
        : "This request could not be completed. Please try again.";
  return new ApiError(message, response.status);
}
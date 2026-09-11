import { ApiError } from "./queryClient";

export function isUnauthorizedError(error: Error): boolean {
  if (error instanceof ApiError) return error.status === 401;
  // Fallback for any error not raised through apiRequest/getQueryFn.
  return /^401: .*Unauthorized/.test(error.message);
}

// Redirect to login with a toast notification
export function redirectToLogin(toast?: (options: { title: string; description: string; variant: string }) => void) {
  if (toast) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
  }
  setTimeout(() => {
    window.location.href = "/api/login";
  }, 500);
}

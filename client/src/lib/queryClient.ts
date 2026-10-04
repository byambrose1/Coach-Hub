import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { responseError } from "./api-error";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    throw await responseError(res);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    cache: "no-store",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      cache: "no-store",
      signal,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Use the confirmed server response immediately; cancel an older read so it
// cannot overwrite the newly saved row. Reconcile with the server afterwards.
export async function cacheSavedRecord<T extends { id: string }>(url: string, saved: T) {
  const queryKey = [url];
  await queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData<T[]>(queryKey, previous => {
    const records = previous || [];
    return records.some(record => record.id === saved.id)
      ? records.map(record => record.id === saved.id ? saved : record)
      : [...records, saved];
  });
  void queryClient.invalidateQueries({ queryKey });
}

import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // User is authenticated if the API returned a non-null user object
  // The endpoint returns null for unauthenticated users
  // If there's an error (other than 401), treat as not authenticated
  const isAuthenticated = !error && user !== null && user !== undefined;

  return {
    user: user || null,
    isLoading,
    isAuthenticated,
  };
}

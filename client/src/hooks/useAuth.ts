import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // User is authenticated if the API returned a non-null user object
  // The endpoint returns null for unauthenticated users
  const isAuthenticated = user !== null && user !== undefined;

  return {
    user: user || null,
    isLoading,
    isAuthenticated,
  };
}

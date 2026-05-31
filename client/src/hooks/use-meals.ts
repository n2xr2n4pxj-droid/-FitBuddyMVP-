import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Meal, InsertMeal } from "@shared/schema";
import { createQueryFn, apiRequest } from "@/lib/queryClient";

// Get all meals
export function useMeals() {
  return useQuery<Meal[]>({
    queryKey: ["/api/meals"],
    queryFn: createQueryFn<Meal[]>(),
  });
}

// Get today's meals
export function useTodaysMeals() {
  const today = format(new Date(), "yyyy-MM-dd");
  
  return useQuery<Meal[]>({
    queryKey: ["/api/meals", today],
    queryFn: createQueryFn<Meal[]>(),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // 數據立即過期，確保總是獲取最新數據
  });
}

// Delete meal
export function useDeleteMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mealId: string) => {
      console.log(`[useDeleteMeal] Deleting meal ${mealId}`);
      return await apiRequest("DELETE", `/api/meals/${mealId}`);
    },
    onSuccess: (data) => {
      console.log("[useDeleteMeal] Delete successful, invalidating queries...");

      // 強制重新獲取所有餐點數據
      const today = format(new Date(), "yyyy-MM-dd");
      queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meals", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/daily", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/tdee/today-progress"] });

      console.log("[useDeleteMeal] Queries invalidated");
    },
    onError: (error) => {
      console.error("[useDeleteMeal] Mutation error:", error);
    },
  });
}

// Update meal
export function useUpdateMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, meal }: { id: string; meal: Partial<InsertMeal> }) => {
      console.log(`[useUpdateMeal] Updating meal ${id}:`, meal);
      return await apiRequest<Meal>("PATCH", `/api/meals/${id}`, meal);
    },
    onSuccess: (data) => {
      console.log("[useUpdateMeal] Update successful, invalidating queries...");

      // 強制重新獲取所有餐點數據
      const today = format(new Date(), "yyyy-MM-dd");
      queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meals", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/daily", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/tdee/today-progress"] });

      console.log("[useUpdateMeal] Queries invalidated");
    },
    onError: (error) => {
      console.error("[useUpdateMeal] Mutation error:", error);
    },
  });
}


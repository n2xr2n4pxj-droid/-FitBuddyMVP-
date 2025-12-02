import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Meal, InsertMeal } from "@shared/schema";

// Get all meals
export function useMeals() {
  return useQuery<Meal[]>({
    queryKey: ["/api/meals"],
    queryFn: async () => {
      const response = await fetch("/api/meals", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch meals");
      }

      const data = await response.json();
      console.log("[useMeals] Fetched meals:", data);

      return data as Meal[];
    },
  });
}

// Get today's meals
export function useTodaysMeals() {
  const today = format(new Date(), "yyyy-MM-dd");
  
  return useQuery<Meal[]>({
    queryKey: ["/api/meals", today],
    queryFn: async () => {
      console.log(`[useTodaysMeals] Fetching meals for date: ${today}`);
      const response = await fetch(`/api/meals/${today}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[useTodaysMeals] Failed to fetch: ${response.status} ${errorText}`);
        throw new Error("Failed to fetch today's meals");
      }

      const data = await response.json();
      console.log(`[useTodaysMeals] Fetched ${data.length} meals for ${today}:`, data);

      return data as Meal[];
    },
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

      const response = await fetch(`/api/meals/${mealId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to delete meal" }));
        console.error("[useDeleteMeal] Error:", error);
        throw new Error(error.message || "Failed to delete meal");
      }

      const result = await response.json();
      console.log(`[useDeleteMeal] Meal ${mealId} deleted successfully:`, result);

      return result;
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

      const response = await fetch(`/api/meals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meal),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[useUpdateMeal] Error:", error);
        throw new Error("Failed to update meal");
      }

      const updated = await response.json();
      console.log(`[useUpdateMeal] Meal ${id} updated successfully:`, updated);

      return updated;
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


import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface TDEEProfile {
  age: number | null;
  gender: 'male' | 'female' | null;
  height: number | null;
  weight: number | null;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'heavy' | 'athlete' | null;
  goal: 'extreme_loss' | 'weight_loss' | 'mild_loss' | 'maintain' | 'mild_gain' | 'weight_gain' | 'extreme_gain' | null;
  bmr: number | null;
  tdee: number | null;
  bmi: number | null;
  targetCalories: number | null;
  targetProtein: number | null;
  targetCarbs: number | null;
  targetFat: number | null;
  proteinRatio: number;
  carbsRatio: number;
  fatRatio: number;
}

export interface TDEECalculateParams {
  age: number;
  gender: 'male' | 'female';
  height: number;
  weight: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'heavy' | 'athlete';
  goal: 'extreme_loss' | 'weight_loss' | 'mild_loss' | 'maintain' | 'mild_gain' | 'weight_gain' | 'extreme_gain';
  proteinRatio?: number;
  carbsRatio?: number;
  fatRatio?: number;
}

export interface TodayProgress {
  target: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  consumed: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  remaining: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  percentage: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

// Get TDEE Profile
export function useTDEEProfile() {
  return useQuery<TDEEProfile>({
    queryKey: ["/api/tdee/profile"],
    retry: false,
  });
}

// Calculate and Save TDEE
export function useCalculateTDEE() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: TDEECalculateParams) => {
      const response = await fetch("/api/tdee/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to calculate TDEE");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tdee/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tdee/today-progress"] });
    },
  });
}

// Get Today's Progress
export function useTodayProgress() {
  return useQuery<TodayProgress>({
    queryKey: ["/api/tdee/today-progress"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}


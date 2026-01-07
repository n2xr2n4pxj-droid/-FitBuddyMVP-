import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Utensils, Activity, TrendingUp, Trash2 } from "lucide-react";
import type { Meal, Workout, DailySummary } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { WeeklyChart } from "@/components/weekly-chart";
import { WorkoutList } from "@/components/workout-list";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createQueryFn, apiRequest } from "@/lib/queryClient";
import { apiClient } from "@/lib/api-client";

export default function TodaysMeals() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const [mealForm, setMealForm] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    mealType: 'BREAKFAST',
    date: today
  });

  const createMealMutation = useMutation({
    mutationFn: async (formData: typeof mealForm) => {
      console.log('🔴 [Frontend] About to submit meal:', formData);
      
      const data = await apiRequest("POST", "/api/meals", {
        name: formData.name,
        calories: parseFloat(formData.calories),
        protein: parseFloat(formData.protein) || 0,
        carbs: parseFloat(formData.carbs) || 0,
        fat: parseFloat(formData.fat) || 0,
        mealType: formData.mealType,
        consumedAt: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString()
      });
      console.log('🔴 [Frontend] Response data:', data);
      return data;
    },
    onSuccess: () => {
      console.log('✅ [Frontend] Meal created successfully!');
      setMealForm({ name: '', calories: '', protein: '', carbs: '', fat: '', mealType: 'BREAKFAST', date: today });
      queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/daily"] });
      // 強制重新獲取今天的餐點
      queryClient.refetchQueries({ queryKey: ["/api/meals", today] });
    },
    onError: (error: any) => {
      console.error('❌ [Frontend] Error:', error);
      alert(error.message || 'Failed to create meal');
    }
  });

  const handleAddMeal = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 驗證必填欄位
    if (!mealForm.name || !mealForm.name.trim()) {
      alert('請輸入食物名稱');
      return;
    }
    
    if (!mealForm.calories || parseFloat(mealForm.calories) <= 0) {
      alert('請輸入有效的熱量值');
      return;
    }
    
    console.log('🟢 [Frontend] Submitting meal form:', mealForm);
    createMealMutation.mutate(mealForm);
  };

  const { data: meals = [], isLoading: mealsLoading } = useQuery<Meal[]>({
    queryKey: ["/api/meals", today],
    queryFn: async ({ queryKey }) => {
      const url = `/api/meals/${today}`;
      console.log('🔵 [Frontend] Fetching meals from:', url);
      try {
        const response = await apiClient.get(url);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          return [];
        }
        throw error;
      }
      console.log('🔵 [Frontend] Meals fetched:', data);
      return data;
    },
    enabled: isAuthenticated,
  });

  const { data: workouts = [], isLoading: workoutsLoading } = useQuery<Workout[]>({
    queryKey: ["/api/workouts", today],
    queryFn: createQueryFn<Workout[]>({ on401: "returnNull" }),
    enabled: isAuthenticated,
  });

  const { data: todaySummary } = useQuery<DailySummary>({
    queryKey: ["/api/summary/daily", today],
    queryFn: createQueryFn<Workout[]>({ on401: "returnNull" }),
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: async (mealId: string) => {
      return await apiRequest("DELETE", `/api/meals/${mealId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/daily"] });
    },
    onError: (error) => {
      console.error("[TodaysMeals] Delete error:", error);
      alert(`刪除失敗：${error.message}`);
    },
  });

  const handleDelete = (event: React.MouseEvent, mealId: string, foodName: string) => {
    event.stopPropagation();
    event.preventDefault();
    
    if (confirm(`確定要刪除 ${foodName || '這筆記錄'} 嗎？`)) {
      deleteMutation.mutate(mealId);
    }
  };

  const totalCalories = meals.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);
  const totalProtein = meals.reduce((sum, meal) => sum + (Number(meal.protein) || 0), 0);
  const totalCarbs = meals.reduce((sum, meal) => sum + (Number(meal.carbs) || 0), 0);
  const totalFat = meals.reduce((sum, meal) => sum + (Number(meal.fat) || 0), 0);

  const totalWorkoutMinutes = workouts.reduce((sum, workout) => sum + (workout.durationMinutes || 0), 0);

  // 獲取 meal type 的顏色
  const getMealTypeColor = (mealType: string) => {
    const colors: Record<string, string> = {
      breakfast: "bg-orange-100 text-orange-800 border-orange-200",
      lunch: "bg-green-100 text-green-800 border-green-200",
      dinner: "bg-blue-100 text-blue-800 border-blue-200",
      snack: "bg-purple-100 text-purple-800 border-purple-200"
    };
    return colors[mealType.toLowerCase()] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Today's Progress
          </h1>
          <p className="text-gray-600">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Calories</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(totalCalories)}</p>
                </div>
                <Utensils className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Protein</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(totalProtein)}g</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-red-600 font-bold">P</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Carbs</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(totalCarbs)}g</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                  <span className="text-yellow-600 font-bold">C</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fat</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round(totalFat)}g</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 font-bold">F</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Meal Form */}
        <section className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Utensils className="h-6 w-6" />
            Log Meal
          </h2>
          
          <form onSubmit={handleAddMeal} className="space-y-4">
            <input
              type="text"
              placeholder="Meal name"
              value={mealForm.name}
              onChange={(e) => setMealForm({...mealForm, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <input
                type="number"
                placeholder="Calories"
                value={mealForm.calories}
                onChange={(e) => setMealForm({...mealForm, calories: e.target.value})}
                className="px-3 py-2 border rounded-lg"
                required
              />
              <input
                type="number"
                placeholder="Protein (g)"
                value={mealForm.protein}
                onChange={(e) => setMealForm({...mealForm, protein: e.target.value})}
                className="px-3 py-2 border rounded-lg"
              />
              <input
                type="number"
                placeholder="Carbs (g)"
                value={mealForm.carbs}
                onChange={(e) => setMealForm({...mealForm, carbs: e.target.value})}
                className="px-3 py-2 border rounded-lg"
              />
              <input
                type="number"
                placeholder="Fat (g)"
                value={mealForm.fat}
                onChange={(e) => setMealForm({...mealForm, fat: e.target.value})}
                className="px-3 py-2 border rounded-lg"
              />
            </div>
            
            <select
              value={mealForm.mealType}
              onChange={(e) => setMealForm({...mealForm, mealType: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="DINNER">Dinner</option>
              <option value="SNACK">Snack</option>
            </select>
            
            <button
              type="submit"
              disabled={createMealMutation.isPending}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createMealMutation.isPending ? 'Adding...' : 'Add Meal'}
            </button>
          </form>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Today's Meals - Card Style */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Utensils className="h-6 w-6" />
              Today's Meals
            </h2>
            
            {mealsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : meals.length === 0 ? (
              <div className="text-center py-8">
                <Utensils className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No meals logged today</p>
                <p className="text-sm text-gray-400 mt-2">Use the form above to log your first meal</p>
              </div>
            ) : (
              <div className="space-y-4">
                {meals.map((meal) => {
                  console.log('[TodaysMeals] Rendering meal:', meal.id, 'name:', meal.name, 'name type:', typeof meal.name, 'name truthy:', !!meal.name);
                  return (
                  <div key={meal.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    {/* Meal Header with Name and Type */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900">
                          {meal.name || "Unknown Food"}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-1 rounded-full border ${getMealTypeColor(meal.mealType || 'snack')}`}>
                            {(meal.mealType || 'snack').toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-500">
                            {meal.consumedAt ? format(new Date(meal.consumedAt), "h:mm a") : ""}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, meal.id, meal.name || '這筆記錄')}
                        disabled={deleteMutation.isPending}
                        className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="刪除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Nutrition Info */}
                    <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t">
                      <div>
                        <p className="text-xs text-gray-500">Calories</p>
                        <p className="font-semibold">{Math.round(Number(meal.calories) || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Protein</p>
                        <p className="font-semibold">{(Number(meal.protein) || 0).toFixed(1)}g</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Carbs</p>
                        <p className="font-semibold">{(Number(meal.carbs) || 0).toFixed(1)}g</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Fat</p>
                        <p className="font-semibold">{(Number(meal.fat) || 0).toFixed(1)}g</p>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Today's Workouts */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Activity className="h-6 w-6" />
              Today's Workouts
            </h2>
            
            {workoutsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <WorkoutList workouts={workouts} />
            )}
          </section>
        </div>

        {/* 7-Day Trends */}
        <section className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            7-Day Trends
          </h2>
          <WeeklyChart />
        </section>
      </div>
    </div>
  );
}

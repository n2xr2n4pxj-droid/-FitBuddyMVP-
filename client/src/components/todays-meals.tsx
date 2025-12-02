import { useState } from "react";
import { Trash2, Utensils, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTodaysMeals, useDeleteMeal } from "@/hooks/use-meals";
import { useTodayProgress } from "@/hooks/use-tdee";
import EditMealModal from "@/components/edit-meal-modal";
import type { Meal } from "@shared/schema";
import { isToday } from "date-fns";

export default function TodaysMeals() {
  const { data: meals = [], isLoading } = useTodaysMeals();
  const { data: progress } = useTodayProgress();
  const deleteMeal = useDeleteMeal();

  // Edit modal state
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // API 已經返回今天的餐點，直接使用
  // 為了安全起見，再次過濾確保只顯示今天的餐點
  const todaysMeals = meals.filter(meal => {
    if (!meal.consumedAt) return false;
    const mealDate = new Date(meal.consumedAt);
    return isToday(mealDate);
  });

  // 添加 console.log 來檢查數據
  console.log("[TodaysMeals] All meals from API:", meals);
  console.log("[TodaysMeals] Filtered today's meals:", todaysMeals);

  const handleEdit = (meal: Meal) => {
    setEditingMeal(meal);
    setIsEditModalOpen(true);
  };


  const getMealTypeColor = (type: string) => {
    const colors = {
      breakfast: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      lunch: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      dinner: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      snack: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    };
    return colors[type.toLowerCase() as keyof typeof colors] || colors.snack;
  };

  const formatTime = (date: string | Date) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProgressPercentage = (nutrient: 'protein' | 'carbs' | 'fat', amount: number) => {
    if (!progress?.target[nutrient]) return 0;
    return Math.round((amount / progress.target[nutrient]) * 100);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Today's Meals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Loading meals...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!todaysMeals || todaysMeals.length === 0) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Today's Meals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Utensils className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No meals logged today
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Use the form above to log your first meal
              </p>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Today's Meals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {todaysMeals.map((meal) => {
              console.log(`[TodaysMeals] Rendering meal ${meal.id}:`, meal);
              
              const mealType = (meal.mealType || 'snack').toLowerCase();
              const foodName = meal.name || meal.foodName || 'Unknown Food'; // 優先使用 name，向後兼容 foodName
              // 優先使用 userServingAmount，如果沒有則使用 servingSize
              const servingSize = meal.userServingAmount || meal.servingSize;
              const mealDate = meal.consumedAt || meal.date || meal.createdAt;
              
              console.log(`[TodaysMeals] Meal ${meal.id} - servingSize: ${meal.servingSize}, userServingAmount: ${meal.userServingAmount}, display: ${servingSize}g`);
              
              const proteinValue = Number(meal.protein || 0);
              const carbsValue = Number(meal.carbs || 0);
              const fatValue = Number(meal.fat || 0);

              return (
                <Card key={meal.id} className="mb-4">
                  <CardContent className="pt-6">
                    {/* 餐點標題 */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {foodName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMealTypeColor(mealType)}`}>
                            {mealType.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {formatTime(mealDate)}
                          </span>
                          {servingSize && (
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              份量: {Number(servingSize)}g
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 編輯和刪除按鈕 */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(meal)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          aria-label="Edit meal"
                        >
                          <Pencil className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`確定要刪除 ${foodName} 嗎？`)) {
                              deleteMeal.mutate(meal.id);
                            }
                          }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          aria-label="Delete meal"
                          disabled={deleteMeal.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* 營養成分顯示 */}
                    <div className="grid grid-cols-4 gap-4">
                      {/* Calories */}
                      <div className="text-center">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Calories
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {Math.round(Number(meal.calories) || 0)}
                        </p>
                        <p className="text-xs text-gray-500">kcal</p>
                      </div>

                      {/* Protein */}
                      <div className="text-center">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Protein
                        </p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {proteinValue.toFixed(1)}g
                        </p>
                        <p className="text-xs text-gray-500">
                          {getProgressPercentage('protein', proteinValue)}% of goal
                        </p>
                      </div>

                      {/* Carbs */}
                      <div className="text-center">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Carbs
                        </p>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {carbsValue.toFixed(1)}g
                        </p>
                        <p className="text-xs text-gray-500">
                          {getProgressPercentage('carbs', carbsValue)}% of goal
                        </p>
                      </div>

                      {/* Fat */}
                      <div className="text-center">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Fat
                        </p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {fatValue.toFixed(1)}g
                        </p>
                        <p className="text-xs text-gray-500">
                          {getProgressPercentage('fat', fatValue)}% of goal
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edit Meal Modal */}
      <EditMealModal
        meal={editingMeal}
        isOpen={!!editingMeal}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingMeal(null);
        }}
      />
    </>
  );
}

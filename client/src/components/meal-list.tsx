import { format } from "date-fns";
import type { Meal } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Utensils } from "lucide-react";

const MEAL_TYPE_COLORS = {
  breakfast: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  lunch: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  dinner: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  snack: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export function MealList({ meals }: { meals: Meal[] }) {
  if (meals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-meals">
        <Utensils className="w-12 h-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No meals logged today</p>
        <p className="text-sm text-muted-foreground">Use the form above to log your first meal</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {meals.map((meal) => (
        <div
          key={meal.id}
          className="p-4 rounded-lg border bg-card hover-elevate"
          data-testid={`meal-item-${meal.id}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold" data-testid={`meal-name-${meal.id}`}>
                  {meal.name || "Unknown Food"}
                </h4>
                <Badge 
                  className={MEAL_TYPE_COLORS[meal.mealType as keyof typeof MEAL_TYPE_COLORS]}
                  data-testid={`meal-type-${meal.id}`}
                >
                  {meal.mealType}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-sm font-mono">
                <span className="text-muted-foreground" data-testid={`meal-calories-${meal.id}`}>
                  {Math.round(parseFloat(meal.calories))} cal
                </span>
                {meal.protein && parseFloat(meal.protein) > 0 && (
                  <span className="text-muted-foreground">
                    {Math.round(parseFloat(meal.protein))}g protein
                  </span>
                )}
                {meal.carbs && parseFloat(meal.carbs) > 0 && (
                  <span className="text-muted-foreground">
                    {Math.round(parseFloat(meal.carbs))}g carbs
                  </span>
                )}
                {meal.fat && parseFloat(meal.fat) > 0 && (
                  <span className="text-muted-foreground">
                    {Math.round(parseFloat(meal.fat))}g fat
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(meal.consumedAt || meal.date), "h:mm a")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { NutritionLog } from "@/lib/api";

export interface LogFoodPrefill {
  mealType: string;
  description: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface MealSectionProps {
  meal: {
    id: string;
    mealType: string;
    name: string;
    description?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    coachTip?: string | null;
  };
  /** 當日該餐別已記錄的 log（可多筆） */
  dayLogs?: NutritionLog[];
  isLogged: boolean;
  onLogFood: (mealType: string, prefill: LogFoodPrefill) => void;
  readOnly?: boolean;
  onDeleteLog?: (logId: string) => void;
}

export const MEAL_ICONS: Record<string, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
  pre_workout: "⚡",
  post_workout: "💪",
};

export const MEAL_NAMES: Record<string, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "小食",
  pre_workout: "訓練前",
  post_workout: "訓練後",
};

export default function MealSection({
  meal,
  dayLogs = [],
  isLogged,
  onLogFood,
  readOnly = false,
  onDeleteLog,
}: MealSectionProps) {
  const icon = MEAL_ICONS[meal.mealType] ?? "🍽️";
  const mealName = MEAL_NAMES[meal.mealType] ?? meal.mealType;

  return (
    <section
      className={cn(
        "rounded-[20px] p-4 transition-all",
        isLogged
          ? "bg-emerald-50/80 border border-emerald-100"
          : "bg-white/90 backdrop-blur-md shadow-sm",
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-base font-bold text-gray-800">
          {icon} {mealName}
        </h4>
        {isLogged && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg">
            已打卡 ✅
          </span>
        )}
      </div>

      <div className="border-t border-gray-100 mt-3 pt-3 space-y-2">
        <p className="text-sm text-gray-700 leading-relaxed">
          {meal.description ?? meal.name}
        </p>

        <p className="text-xs text-gray-500">
          {(meal.calories ?? 0)} kcal | 蛋白 {(meal.protein ?? 0)}g 碳水 {(meal.carbs ?? 0)}g 脂{" "}
          {(meal.fat ?? 0)}g
        </p>

        {meal.coachTip && (
          <p className="text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
            💡 {meal.coachTip}
          </p>
        )}

        {dayLogs.length > 0 && (
          <ul className="space-y-2 pt-1">
            {dayLogs.map((log) => (
              <li
                key={log.id}
                className="rounded-xl border border-emerald-100/80 bg-white/80 px-3 py-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800">{log.description ?? log.name ?? "—"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {Math.round(log.calories ?? 0)} kcal · 蛋白 {Number(log.protein ?? 0)}g · 碳水{" "}
                      {Number(log.carbs ?? 0)}g · 脂 {Number(log.fat ?? 0)}g
                    </p>
                    {log.notes ? (
                      <p className="text-xs text-gray-400 mt-1">📝 {log.notes}</p>
                    ) : null}
                  </div>
                  {!readOnly && onDeleteLog ? (
                    <button
                      type="button"
                      onClick={() => onDeleteLog(log.id)}
                      className="shrink-0 text-xs text-rose-600 font-medium px-2 py-1 rounded-lg hover:bg-rose-50"
                    >
                      刪除
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!readOnly ? (
        <button
          type="button"
          onClick={() =>
            onLogFood(meal.mealType, {
              mealType: meal.mealType,
              description: meal.description ?? meal.name,
              calories: meal.calories,
              protein: meal.protein,
              carbs: meal.carbs,
              fat: meal.fat,
            })
          }
          className={cn(
            "mt-4 w-full rounded-xl py-2.5 text-sm font-semibold active:scale-[0.99] transition-all",
            isLogged
              ? "bg-emerald-100 text-emerald-700"
              : "bg-blue-600 text-white shadow-sm shadow-blue-100",
          )}
        >
          {isLogged ? "再加一筆 ✍️" : "打卡記錄 ✍️"}
        </button>
      ) : null}
    </section>
  );
}

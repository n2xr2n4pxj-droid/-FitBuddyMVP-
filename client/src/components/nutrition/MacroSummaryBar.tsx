import { cn } from "@/lib/utils";

interface MacroSummaryBarProps {
  consumed: { calories: number; protein: number; carbs: number; fat: number };
  target: { calories: number; protein: number; carbs: number; fat: number };
}

export default function MacroSummaryBar({ consumed, target }: MacroSummaryBarProps) {
  const calorieRawPercent =
    target.calories > 0 ? (consumed.calories / target.calories) * 100 : 0;
  const caloriePercent = Math.min(calorieRawPercent, 100);
  const isOver = consumed.calories > target.calories;

  return (
    <div className="sticky top-[56px] z-20 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-gray-800">
            {consumed.calories.toLocaleString()}
          </span>
          <span className="text-xs text-gray-400">
            / {target.calories.toLocaleString()} kcal
          </span>
        </div>
        <span
          className={cn(
            "text-xs font-semibold",
            isOver ? "text-rose-500" : "text-blue-600",
          )}
        >
          {Math.round(calorieRawPercent)}%
        </span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
        <div
          className={cn(
            "h-2 rounded-full transition-all",
            isOver ? "bg-rose-400" : "bg-blue-500",
          )}
          style={{ width: `${caloriePercent}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "蛋白質",
            consumed: consumed.protein,
            target: target.protein,
            color: "blue",
          },
          {
            label: "碳水化合物",
            consumed: consumed.carbs,
            target: target.carbs,
            color: "amber",
          },
          {
            label: "脂肪",
            consumed: consumed.fat,
            target: target.fat,
            color: "rose",
          },
        ].map((macro) => {
          const percent =
            macro.target > 0 ? Math.min((macro.consumed / macro.target) * 100, 100) : 0;
          return (
            <div key={macro.label}>
              <div className="flex justify-between mb-0.5">
                <span className="text-[10px] text-gray-500">{macro.label}</span>
                <span className="text-[10px] font-medium text-gray-700">
                  {macro.consumed}/{macro.target}g
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={cn(
                    "h-1.5 rounded-full",
                    macro.color === "blue" && "bg-blue-500",
                    macro.color === "amber" && "bg-amber-500",
                    macro.color === "rose" && "bg-rose-400",
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

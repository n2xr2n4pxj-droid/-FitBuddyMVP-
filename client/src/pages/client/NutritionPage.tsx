import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CoachTipBanner from "@/components/shared/CoachTipBanner";
import LogFoodModal from "@/components/nutrition/LogFoodModal";
import MacroSummaryBar from "@/components/nutrition/MacroSummaryBar";
import MealSection, {
  MEAL_NAMES,
  type LogFoodPrefill,
} from "@/components/nutrition/MealSection";
import { api, type NutritionLog, type NutritionLogBody, type NutritionPlan } from "@/lib/api";
import { cn } from "@/lib/utils";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type MockNutritionPlan = Omit<NutritionPlan, "meals"> & {
  meals: Array<
    Omit<NutritionPlan["meals"][number], "mealType" | "coachTip"> & {
      mealType: MealType;
      coachTip?: string | null;
    }
  >;
};

const MOCK_NUTRITION_PLAN: MockNutritionPlan = {
  id: "plan-1",
  name: "增肌飲食 Week 2",
  targetCalories: 2400,
  targetProtein: 180,
  targetCarbs: 250,
  targetFat: 70,
  coachTips:
    "訓練前 1 小時吃完，避免訓練後進食超過 11pm。飲食唔使追求完美，80% 足夠！",
  meals: [
    {
      id: "m1",
      mealType: "breakfast",
      order: 1,
      name: "雞蛋 3 隻 + 燕麥 80g + 低脂牛奶",
      calories: 420,
      protein: 32,
      carbs: 45,
      fat: 12,
      coachTip: "燕麥可加藍莓，GI 值較低，飽肚感更強",
    },
    {
      id: "m2",
      mealType: "lunch",
      order: 2,
      name: "雞胸肉 200g + 糙米 150g + 西蘭花",
      calories: 550,
      protein: 48,
      carbs: 60,
      fat: 8,
      coachTip: null,
    },
    {
      id: "m3",
      mealType: "dinner",
      order: 3,
      name: "三文魚 180g + 蔬菜沙律",
      calories: 480,
      protein: 42,
      carbs: 12,
      fat: 22,
      coachTip: "沙律醬選橄欖油或無醬，唔好用千島醬",
    },
    {
      id: "m4",
      mealType: "snack",
      order: 4,
      name: "乳清蛋白 1 勺 + 香蕉",
      calories: 280,
      protein: 28,
      carbs: 35,
      fat: 3,
      coachTip: null,
    },
  ],
};

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"] as const;
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildWeekDays(baseDate = new Date()): { date: string; label: string; dayName: string }[] {
  return Array.from({ length: 7 }, (_, idx) => {
    const current = new Date(baseDate);
    current.setDate(baseDate.getDate() - 3 + idx);
    return {
      date: toDateKey(current),
      label: String(current.getDate()),
      dayName: DAY_NAMES[current.getDay()],
    };
  });
}

function targetFromGoals(
  goals: { goalCalories: number; goalProtein: number; goalCarbs: number; goalFat: number } | undefined,
) {
  const g = goals ?? {
    goalCalories: 0,
    goalProtein: 0,
    goalCarbs: 0,
    goalFat: 0,
  };
  return {
    calories: g.goalCalories > 0 ? g.goalCalories : MOCK_NUTRITION_PLAN.targetCalories,
    protein: g.goalProtein > 0 ? g.goalProtein : MOCK_NUTRITION_PLAN.targetProtein,
    carbs: g.goalCarbs > 0 ? g.goalCarbs : MOCK_NUTRITION_PLAN.targetCarbs,
    fat: g.goalFat > 0 ? g.goalFat : MOCK_NUTRITION_PLAN.targetFat,
  };
}

export default function NutritionPage() {
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const weekDays = useMemo(() => buildWeekDays(new Date()), []);

  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logPrefill, setLogPrefill] = useState<LogFoodPrefill | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const nutritionQueryKey = ["nutrition", "day", selectedDate] as const;

  const { data, isLoading, isError } = useQuery({
    queryKey: nutritionQueryKey,
    queryFn: () => api.getTodayNutritionLogs(selectedDate),
  });

  const logsByMeal = useMemo(() => {
    const map: Record<string, NutritionLog[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const log of data?.logs ?? []) {
      const k = String(log.mealType ?? "").toLowerCase();
      if (!map[k]) map[k] = [];
      map[k].push(log);
    }
    return map;
  }, [data?.logs]);

  const consumed = useMemo(() => {
    const s = data?.summary;
    return {
      calories: s?.totalCalories ?? 0,
      protein: s?.totalProtein ?? 0,
      carbs: s?.totalCarbs ?? 0,
      fat: s?.totalFat ?? 0,
    };
  }, [data?.summary]);

  const target = useMemo(() => targetFromGoals(data?.goals), [data?.goals]);

  const logMutation = useMutation({
    mutationFn: (body: NutritionLogBody) => api.logNutrition(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: nutritionQueryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteNutritionLog(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: nutritionQueryKey });
    },
  });

  async function handleLogSubmit(log: NutritionLogBody) {
    await logMutation.mutateAsync({ ...log, logDate: selectedDate });
    setLogModalOpen(false);
    setToastMsg(`✅ ${MEAL_NAMES[log.mealType] ?? "飲食"}已記錄！`);
    window.setTimeout(() => setToastMsg(null), 2000);
  }

  function handleOpenLogFood(_mealType: string, prefill: LogFoodPrefill) {
    setLogPrefill(prefill);
    setLogModalOpen(true);
  }

  return (
    <div className="pb-24 bg-gradient-to-b from-slate-50/80 to-white min-h-full">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 bg-white border-b border-gray-100">
        {weekDays.map((day) => (
          <button
            key={day.date}
            type="button"
            onClick={() => setSelectedDate(day.date)}
            className={cn(
              "flex flex-col items-center min-w-[40px] py-1.5 px-2 rounded-xl",
              "active:scale-95 transition-transform",
              selectedDate === day.date ? "bg-blue-600 text-white" : "text-gray-500",
            )}
          >
            <span className="text-[10px]">{day.dayName}</span>
            <span className="text-sm font-semibold">{day.label}</span>
          </button>
        ))}
      </div>

      {isError && (
        <p className="px-4 py-2 text-sm text-rose-600 bg-rose-50 border-b border-rose-100">
          無法載入飲食紀錄，請檢查網路或稍後再試。
        </p>
      )}

      <MacroSummaryBar consumed={consumed} target={target} />

      <div className="px-4 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">今日飲食計劃（建議）</p>
            <h3 className="font-bold text-gray-800">{MOCK_NUTRITION_PLAN.name}</h3>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg font-medium">
            {isLoading ? "載入中…" : "進行中"}
          </span>
        </div>

        {MOCK_NUTRITION_PLAN.coachTips && (
          <CoachTipBanner tip={MOCK_NUTRITION_PLAN.coachTips} coachName="Coach" variant="green" />
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {MEAL_ORDER.map((mealType) => {
          const meal = MOCK_NUTRITION_PLAN.meals.find((item) => item.mealType === mealType);
          if (!meal) return null;
          const dayLogs = logsByMeal[mealType] ?? [];
          const isLogged = dayLogs.length > 0;
          return (
            <MealSection
              key={meal.id}
              meal={meal}
              dayLogs={dayLogs}
              isLogged={isLogged}
              onLogFood={handleOpenLogFood}
              onDeleteLog={(id) => deleteMutation.mutate(id)}
            />
          );
        })}
      </div>

      <LogFoodModal
        isOpen={logModalOpen}
        prefill={logPrefill}
        onClose={() => setLogModalOpen(false)}
        onSubmit={handleLogSubmit}
      />

      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg animate-pulse">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

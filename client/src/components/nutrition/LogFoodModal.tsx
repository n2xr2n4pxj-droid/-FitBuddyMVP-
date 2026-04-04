import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { type NutritionLogBody } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type LogFoodPrefill, MEAL_NAMES } from "./MealSection";

interface LogFoodModalProps {
  isOpen: boolean;
  prefill: LogFoodPrefill | null;
  onClose: () => void;
  onSubmit: (log: NutritionLogBody) => Promise<void>;
}

export default function LogFoodModal({
  isOpen,
  prefill,
  onClose,
  onSubmit,
}: LogFoodModalProps) {
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !prefill) return;
    setDescription(prefill.description ?? "");
    setCalories(prefill.calories != null ? String(prefill.calories) : "");
    setProtein(prefill.protein != null ? String(prefill.protein) : "");
    setCarbs(prefill.carbs != null ? String(prefill.carbs) : "");
    setFat(prefill.fat != null ? String(prefill.fat) : "");
    setNotes("");
  }, [isOpen, prefill]);

  const title = useMemo(() => {
    const mealLabel = prefill ? MEAL_NAMES[prefill.mealType] ?? "飲食" : "飲食";
    return `✍️ 記錄${mealLabel}`;
  }, [prefill]);

  async function handleSubmit() {
    if (!prefill || !description.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        logDate: new Date().toISOString().slice(0, 10),
        mealType: prefill.mealType,
        description: description.trim(),
        calories: Number(calories) || 0,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        notes: notes.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/30 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 bg-white",
          "transition-transform duration-300 flex flex-col",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-2 active:scale-95 transition-transform"
            disabled={isSubmitting}
          >
            <X size={20} className="text-gray-500" />
          </button>
          <h3 className="font-bold text-gray-800">{title}</h3>
          <div className="w-8" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">今日吃了什麼？</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-blue-400"
              placeholder="輸入食物內容..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">熱量（kcal）</label>
              <input
                value={calories}
                onChange={(e) => setCalories(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                type="text"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">蛋白質（g）</label>
              <input
                value={protein}
                onChange={(e) => setProtein(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                type="text"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">碳水化合物（g）</label>
              <input
                value={carbs}
                onChange={(e) => setCarbs(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                type="text"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">脂肪（g）</label>
              <input
                value={fat}
                onChange={(e) => setFat(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                type="text"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">備忘（選填）</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-blue-400"
              placeholder="例如：今晚較餓，加了一份水果"
            />
          </div>
        </div>

        <div className="px-4 pb-5 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
            className={cn(
              "w-full rounded-2xl py-3.5 font-bold text-white transition-all active:scale-95",
              isSubmitting || !description.trim()
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-600 shadow-lg shadow-blue-100",
            )}
          >
            {isSubmitting ? "記錄中..." : "確認打卡 ✅"}
          </button>
        </div>
      </div>
    </>
  );
}

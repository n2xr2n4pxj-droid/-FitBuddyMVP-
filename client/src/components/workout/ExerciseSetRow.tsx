import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SetEntry {
  weight: string;
  reps: string;
  isCompleted: boolean;
  isWarmup: boolean;
}

interface ExerciseSetRowProps {
  setIndex: number;
  targetReps: number;
  targetLoad: number;
  set: SetEntry;
  onUpdate: (field: keyof SetEntry, value: string | boolean) => void;
  onToggleComplete: () => void;
}

function normalizeNumericInput(value: string): string {
  return value.replace(/[^\d.]/g, "");
}

export default function ExerciseSetRow({
  setIndex,
  targetReps,
  targetLoad,
  set,
  onUpdate,
  onToggleComplete,
}: ExerciseSetRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[28px_50px_60px_1fr_1fr_36px] items-center gap-2 rounded-xl px-2 py-2",
        set.isCompleted
          ? "bg-emerald-50 border border-emerald-100"
          : "bg-gray-50 border border-transparent",
      )}
    >
      <span className="text-xs text-gray-500 text-center">{setIndex + 1}</span>
      <span className="text-xs text-gray-400 text-center">{targetLoad}kg</span>
      <span className="text-xs text-gray-400 text-center">
        {targetLoad}x{targetReps}
      </span>

      <input
        type="text"
        inputMode="decimal"
        value={set.weight}
        onFocus={(event) => event.target.select()}
        onChange={(event) => onUpdate("weight", normalizeNumericInput(event.target.value))}
        className="h-8 rounded-lg border border-gray-200 px-2 text-xs text-center text-gray-700 focus:outline-none focus:border-blue-400"
      />
      <input
        type="text"
        inputMode="decimal"
        value={set.reps}
        onFocus={(event) => event.target.select()}
        onChange={(event) => onUpdate("reps", normalizeNumericInput(event.target.value))}
        className="h-8 rounded-lg border border-gray-200 px-2 text-xs text-center text-gray-700 focus:outline-none focus:border-blue-400"
      />

      <button
        type="button"
        onClick={onToggleComplete}
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center active:scale-95 transition-transform",
          set.isCompleted
            ? "bg-emerald-500 text-white"
            : "bg-gray-200 text-gray-400",
        )}
      >
        <Check size={14} />
      </button>
    </div>
  );
}

import { Clock3, Zap, BarChart3 } from "lucide-react";

interface WorkoutSummaryCardProps {
  aiComment: string;
  elapsedSeconds: number;
  totalSets: number;
  totalVolume: number;
  overallRpe: number;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function WorkoutSummaryCard({
  aiComment,
  elapsedSeconds,
  totalSets,
  totalVolume,
  overallRpe,
  onClose,
}: WorkoutSummaryCardProps) {
  return (
    <div className="flex-1 bg-gradient-to-b from-blue-50 to-white px-4 py-6">
      <div className="bg-white rounded-[20px] p-5 shadow-sm">
        <h3 className="text-center text-xl font-bold text-gray-800">🏆 訓練完成！</h3>
        <p className="mt-4 text-center text-blue-700 italic leading-relaxed">「{aiComment}」</p>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-1 text-gray-500">
              <Clock3 size={14} />
              <span>時間</span>
            </div>
            <p className="mt-1 font-semibold text-gray-800">{formatTime(elapsedSeconds)}</p>
          </div>

          <div className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-1 text-gray-500">
              <BarChart3 size={14} />
              <span>組數</span>
            </div>
            <p className="mt-1 font-semibold text-gray-800">{totalSets} 組</p>
          </div>

          <div className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-1 text-gray-500">
              <Zap size={14} />
              <span>Volume</span>
            </div>
            <p className="mt-1 font-semibold text-gray-800">
              {totalVolume.toLocaleString()} kg
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-1 text-gray-500">
              <span>📊</span>
              <span>RPE</span>
            </div>
            <p className="mt-1 font-semibold text-gray-800">{overallRpe} / 10</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-[20px] bg-blue-600 text-white font-bold active:scale-95 transition-transform"
        >
          返回主頁
        </button>
      </div>
    </div>
  );
}

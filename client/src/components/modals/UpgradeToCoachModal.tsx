import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradeToCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrimaryAction: () => void;
}

export default function UpgradeToCoachModal({
  isOpen,
  onClose,
  onPrimaryAction,
}: UpgradeToCoachModalProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-200",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
      aria-hidden={!isOpen}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          "absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2",
          "rounded-t-[24px] border border-gray-200 bg-white p-5 shadow-2xl",
          "transition-transform duration-300",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-blue-50 p-2">
              <Sparkles size={18} className="text-blue-600" />
            </div>
            <p className="text-sm font-semibold text-gray-800">解鎖教練專業模式</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-500 transition-transform active:scale-95"
            aria-label="關閉"
          >
            <X size={18} />
          </button>
        </div>

        <h3 className="text-lg font-bold text-gray-900">想開始管理你的學員嗎？</h3>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          升級至教練專業模式，即可解鎖無限學員管理、即時進度監控與自定義排程工具。
        </p>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-transform active:scale-95"
          >
            免費試用 14 天
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-transform active:scale-95"
          >
            稍後再說
          </button>
        </div>
      </div>
    </div>
  );
}

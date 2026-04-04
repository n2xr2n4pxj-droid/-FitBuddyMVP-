import { Dumbbell, SwitchCamera } from "lucide-react";
import { cn } from "@/lib/utils";
import NotificationCenter from "@/components/notifications/NotificationCenter";

interface TopHeaderProps {
  activeView: "LEARNER" | "TRAINER";
  onSwitchMode: () => void;
  activeTab: string;
}

const CLIENT_TITLES: Record<string, string> = {
  dashboard: "今日概覽",
  workout: "訓練打卡",
  progress: "訓練進度",
  plans: "我的課表",
  food: "飲食日記",
  social: "社群動態",
  profile: "個人設定",
};

const COACH_TITLES: Record<string, string> = {
  dashboard: "教練控制台",
  workout: "學員訓練記錄",
  "client-progress": "學員進度",
  clients: "學員管理",
  schedule: "排表中心",
  analytics: "數據分析",
  profile: "帳號設定",
};

export default function TopHeader({
  activeView,
  onSwitchMode,
  activeTab,
}: TopHeaderProps) {
  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-30 mx-auto h-14 w-full max-w-md",
        "flex items-center justify-between px-4",
        activeView === "LEARNER"
          ? "bg-white/90 backdrop-blur-md border-b border-gray-100"
          : "bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-700/60",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Dumbbell
          size={20}
          className={activeView === "LEARNER" ? "text-blue-600" : "text-amber-400"}
        />
        <span
          className={cn(
            "font-bold text-base",
            activeView === "LEARNER" ? "text-blue-600" : "text-amber-400",
          )}
        >
          FitBuddy
        </span>
      </div>

      <span
        className={cn(
          "font-semibold text-base",
          activeView === "LEARNER" ? "text-gray-800" : "text-slate-100",
        )}
      >
        {activeView === "LEARNER"
          ? CLIENT_TITLES[activeTab] ?? "今日概覽"
          : COACH_TITLES[activeTab] ?? "教練控制台"}
      </span>

      <div className="w-24 flex justify-end items-center">
        <NotificationCenter activeView={activeView} />
        <button
          type="button"
          onClick={onSwitchMode}
          className={cn(
            "p-2 rounded-full active:scale-95 transition-transform",
            activeView === "LEARNER"
              ? "bg-blue-50 text-blue-600"
              : "bg-amber-400/10 text-amber-400",
          )}
          title={activeView === "LEARNER" ? "切換模式" : "切換模式"}
        >
          <SwitchCamera size={18} />
        </button>
      </div>
    </header>
  );
}

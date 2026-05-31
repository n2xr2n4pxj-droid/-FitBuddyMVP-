import {
  Apple,
  BarChart2,
  Calendar,
  ClipboardList,
  Dumbbell,
  Home,
  LayoutDashboard,
  Settings,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeView: "LEARNER" | "TRAINER";
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNav({
  activeView,
  activeTab,
  onTabChange,
}: BottomNavProps) {
  const CLIENT_TABS = [
    { key: "dashboard", label: "主頁", Icon: Home },
    { key: "workout", label: "訓練", Icon: Dumbbell },
    { key: "progress", label: "進度", Icon: TrendingUp },
    { key: "plans", label: "課表", Icon: ClipboardList },
    { key: "food", label: "飲食", Icon: Apple },
    { key: "social", label: "社群", Icon: Users },
    { key: "profile", label: "我", Icon: User },
  ];

  const COACH_TABS = [
    { key: "dashboard", label: "主頁", Icon: LayoutDashboard },
    { key: "workout", label: "訓練", Icon: Dumbbell },
    { key: "clients", label: "學員", Icon: Users },
    { key: "schedule", label: "排表", Icon: Calendar },
    { key: "analytics", label: "數據", Icon: BarChart2 },
    { key: "profile", label: "設定", Icon: Settings },
  ];

  const tabs = activeView === "LEARNER" ? CLIENT_TABS : COACH_TABS;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-md",
        "flex items-center justify-around h-16 pb-4",
        activeView === "LEARNER"
          ? "bg-white/95 backdrop-blur-md border-t border-gray-100"
          : "bg-[#0f172a]/95 backdrop-blur-md border-t border-slate-700/60",
      )}
    >
      {tabs.map(({ key, label, Icon }) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 active:scale-95 transition-transform relative"
          >
            <Icon
              size={22}
              className={cn(
                "transition-colors",
                isActive
                  ? activeView === "LEARNER"
                    ? "text-blue-600"
                    : "text-amber-400"
                  : activeView === "LEARNER"
                    ? "text-gray-400"
                    : "text-slate-500",
              )}
              strokeWidth={isActive ? 2.5 : 1.5}
            />
            <span
              className={cn(
                "text-[10px] transition-colors",
                isActive
                  ? activeView === "LEARNER"
                    ? "text-blue-600 font-medium"
                    : "text-amber-400 font-medium"
                  : activeView === "LEARNER"
                    ? "text-gray-400"
                    : "text-slate-500",
              )}
            >
              {label}
            </span>
            {isActive && (
              <span
                className={cn(
                  "absolute -bottom-1 w-1 h-1 rounded-full",
                  activeView === "LEARNER" ? "bg-blue-600" : "bg-amber-400",
                )}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

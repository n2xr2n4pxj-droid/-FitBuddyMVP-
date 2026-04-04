import CoachDashboard from "@/pages/coach/CoachDashboard";
import LearnerWorkoutHistory from "@/components/workout/LearnerWorkoutHistory";
import NotificationSettings from "@/components/settings/NotificationSettings";

type CoachTab = "dashboard" | "workout" | "clients" | "schedule" | "analytics" | "profile";

interface CoachRouterProps {
  tab: CoachTab;
  onOpenRoutineBuilder: (clientId: string | null) => void;
  onOpenClientProgress?: (clientId: string, clientName?: string) => void;
}

export default function CoachRouter({
  tab,
  onOpenRoutineBuilder,
  onOpenClientProgress,
}: CoachRouterProps) {
  switch (tab) {
    case "dashboard":
      return <CoachDashboard onOpenRoutineBuilder={onOpenRoutineBuilder} />;
    case "workout":
      return <LearnerWorkoutHistory onOpenClientProgress={onOpenClientProgress} />;
    case "clients":
      return <div className="px-4 text-slate-100">學員列表（開發中）</div>;
    case "schedule":
      return <div className="px-4 text-slate-100">排表頁面（開發中）</div>;
    case "analytics":
      return <div className="px-4 text-slate-100">數據分析（開發中）</div>;
    case "profile":
      return <NotificationSettings />;
    default:
      return null;
  }
}

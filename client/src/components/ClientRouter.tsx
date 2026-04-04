import ClientDashboard from "@/pages/client/ClientDashboard";
import NutritionPage from "@/pages/client/NutritionPage";
import WorkoutHistory from "@/components/workout/WorkoutHistory";
import LearnerPlansTab from "@/components/plans/LearnerPlansTab";
import NotificationSettings from "@/components/settings/NotificationSettings";
import ProgressPage from "@/pages/client/ProgressPage";

type ClientTab = "dashboard" | "workout" | "progress" | "plans" | "food" | "social" | "profile";

interface ClientRouterProps {
  tab: ClientTab;
  onStartWorkout?: (routineId?: string) => void;
  onOpenWorkoutTab?: () => void;
  onOpenPlansTab?: () => void;
  onOpenProgress?: () => void;
  onOpenSessionDetail?: (sessionId: string) => void;
  initialSessionId?: string;
  onInitialSessionHandled?: () => void;
  onStartCustomWorkout?: () => void;
  onLogFood?: () => void;
}

export default function ClientRouter({
  tab,
  onStartWorkout,
  onOpenWorkoutTab,
  onOpenPlansTab,
  onOpenProgress,
  onOpenSessionDetail,
  initialSessionId,
  onInitialSessionHandled,
  onStartCustomWorkout,
  onLogFood,
}: ClientRouterProps) {
  switch (tab) {
    case "dashboard":
      return (
        <ClientDashboard
          onStartWorkout={onStartWorkout}
          onOpenWorkoutTab={onOpenWorkoutTab}
          onOpenPlansTab={onOpenPlansTab}
          onOpenProgress={onOpenProgress}
          onOpenSessionDetail={onOpenSessionDetail}
          onStartCustomWorkout={onStartCustomWorkout}
          onLogFood={onLogFood}
        />
      );
    case "workout":
      return (
        <WorkoutHistory
          initialSessionId={initialSessionId}
          onInitialSessionHandled={onInitialSessionHandled}
        />
      );
    case "progress":
      return <ProgressPage />;
    case "plans":
      return (
        <LearnerPlansTab
          onStartWorkout={onStartWorkout}
          onOpenWorkoutTab={onOpenWorkoutTab}
        />
      );
    case "food":
      return <NutritionPage />;
    case "social":
      return <div className="px-4 text-gray-700">社交頁面（開發中）</div>;
    case "profile":
      return <NotificationSettings />;
    default:
      return null;
  }
}

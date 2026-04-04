import LearnerDashboard from "@/components/dashboard/LearnerDashboard";

interface ClientDashboardProps {
  onStartWorkout?: (routineId?: string) => void;
  onOpenWorkoutTab?: () => void;
  onOpenPlansTab?: () => void;
  onOpenProgress?: () => void;
  onOpenSessionDetail?: (sessionId: string) => void;
  onStartCustomWorkout?: () => void;
  onLogFood?: () => void;
}

export default function ClientDashboard({
  onStartWorkout,
  onOpenWorkoutTab,
  onOpenPlansTab,
  onOpenProgress,
  onOpenSessionDetail,
}: ClientDashboardProps) {
  return (
    <LearnerDashboard
      actions={{
        onStartWorkout: (routineId?: string) => onStartWorkout?.(routineId),
        onOpenWorkoutTab: () => onOpenWorkoutTab?.(),
        onOpenPlansTab: () => onOpenPlansTab?.(),
        onOpenProgress: () => onOpenProgress?.(),
        onOpenSessionDetail: (sessionId: string) =>
          onOpenSessionDetail?.(sessionId),
      }}
    />
  );
}

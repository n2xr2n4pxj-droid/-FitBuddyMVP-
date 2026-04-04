import { useAuth } from "@/hooks/useAuth";
import ProgressDashboard from "@/components/progress/ProgressDashboard";

export default function ProgressPage() {
  const { user } = useAuth();
  if (!user?.id) return null;
  return <ProgressDashboard targetUserId={user.id} variant="learner" />;
}

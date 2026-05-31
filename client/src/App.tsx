import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import useAuthStore from "@/store/auth.store";
import SplashScreen from "@/components/SplashScreen";
import UnauthenticatedRoutes from "@/routes/UnauthenticatedRoutes";
import ClientRouter from "@/components/ClientRouter";
import CoachRouter from "@/components/CoachRouter";
import TopHeader from "@/components/layout/TopHeader";
import BottomNav from "@/components/layout/BottomNav";
import WorkoutLoggerModal from "@/components/workout/WorkoutLoggerModal";
import RoutineBuilderModal from "@/components/coach/RoutineBuilderModal";
import UpgradeToCoachModal from "@/components/modals/UpgradeToCoachModal";
import { Toaster } from "@/components/ui/toaster";
import ProgressDashboard from "@/components/progress/ProgressDashboard";

export type AppViewMode = "LEARNER" | "TRAINER";
export type ClientTab = "dashboard" | "workout" | "progress" | "plans" | "food" | "social" | "profile";
export type CoachTab =
  | "dashboard"
  | "workout"
  | "clients"
  | "schedule"
  | "analytics"
  | "profile";

const FREE_WORKOUT_ROUTINE_ID = "free-workout";

export default function App() {
  const { user, isLoggedIn, isLoading } = useAuth();
  const { registrationComplete, nextStep } = useAuthStore();
  const [, setLocation] = useLocation();
  const [activeView, setActiveView] = useState<AppViewMode>("LEARNER");
  const [clientTab, setClientTab] = useState<ClientTab>("dashboard");
  const [coachTab, setCoachTab] = useState<CoachTab>("dashboard");
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
  const [initialSessionId, setInitialSessionId] = useState<string | null>(null);
  const [isRoutineBuilderOpen, setIsRoutineBuilderOpen] = useState(false);
  const [builderTargetClientId, setBuilderTargetClientId] = useState<string | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [coachProgressClientId, setCoachProgressClientId] = useState<string | null>(null);
  const [coachProgressClientName, setCoachProgressClientName] = useState<string | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void useAuthStore.getState().initializeAuth();
  }, []);

  useEffect(() => {
    setActiveView(user?.role === "COACH" ? "TRAINER" : "LEARNER");
  }, [user]);

  // 已登入但尚未完成注冊流程 → 確保 URL 指向 /register-flow?step=X
  useEffect(() => {
    if (!isLoading && isLoggedIn && !registrationComplete) {
      const step = nextStep ?? 3;
      if (!window.location.pathname.startsWith("/register-flow")) {
        setLocation(`/register-flow?step=${step}`);
      }
    }
  }, [isLoading, isLoggedIn, registrationComplete, nextStep, setLocation]);

  useEffect(() => {
    if (activeView !== "LEARNER" || clientTab !== "workout") return;

    // 主內容捲動在 <main> 上，需重置該容器而非 window
    window.requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [activeView, clientTab]);

  const handleModeSwitch = () => {
    if (user?.role === "COACH") {
      setActiveView((prev) => (prev === "LEARNER" ? "TRAINER" : "LEARNER"));
      return;
    }
    setIsUpgradeModalOpen(true);
  };

  const handleOpenWorkoutTab = () => {
    setClientTab("workout");
  };

  const handleOpenSessionDetail = (sessionId: string) => {
    setInitialSessionId(sessionId);
    setClientTab("workout");
  };

  const handleStartCustomWorkout = () => {
    setActiveRoutineId(FREE_WORKOUT_ROUTINE_ID);
    setIsWorkoutModalOpen(true);
  };

  const openCoachClientProgress = (clientId: string, clientName?: string) => {
    setCoachProgressClientId(clientId);
    setCoachProgressClientName(clientName?.trim() || null);
  };

  const closeCoachClientProgress = () => {
    setCoachProgressClientId(null);
    setCoachProgressClientName(null);
  };

  const headerActiveTab =
    activeView === "TRAINER" && coachProgressClientId
      ? "client-progress"
      : activeView === "LEARNER"
        ? clientTab
        : coachTab;

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!isLoggedIn) {
    return (
      <>
        <UnauthenticatedRoutes />
        <Toaster />
      </>
    );
  }

  // 已登入但尚未完成注冊流程（TDEE / 角色選擇未完成）
  // → 顯示 UnauthenticatedRoutes（包含 /register-flow），useEffect 會負責跳轉 URL
  if (!registrationComplete) {
    return (
      <>
        <UnauthenticatedRoutes />
        <Toaster />
      </>
    );
  }

  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-neutral-950 md:bg-neutral-900">
      <div
        className={`relative flex min-h-[100dvh] w-full max-w-md flex-col overflow-x-hidden shadow-2xl md:border-x md:border-neutral-800 ${
          activeView === "LEARNER" ? "bg-gray-50" : "bg-[#0f172a]"
        }`}
      >
        <TopHeader
          activeView={activeView}
          activeTab={headerActiveTab}
          onSwitchMode={handleModeSwitch}
        />

        <main
          ref={mainScrollRef}
          className="min-h-0 flex-1 overflow-y-auto pb-24 pt-16"
        >
          {activeView === "LEARNER" ? (
            <ClientRouter
              tab={clientTab}
              onStartWorkout={(routineId) => {
                if (!routineId) {
                  handleStartCustomWorkout();
                  return;
                }
                setActiveRoutineId(routineId);
                setIsWorkoutModalOpen(true);
              }}
              onOpenWorkoutTab={handleOpenWorkoutTab}
              onOpenPlansTab={() => setClientTab("plans")}
              onOpenProgress={() => setClientTab("progress")}
              onOpenSessionDetail={handleOpenSessionDetail}
              initialSessionId={initialSessionId ?? undefined}
              onInitialSessionHandled={() => setInitialSessionId(null)}
              onStartCustomWorkout={handleStartCustomWorkout}
              onLogFood={() => {
                console.log("TODO: open food logging modal");
              }}
            />
          ) : coachProgressClientId ? (
            <ProgressDashboard
              targetUserId={coachProgressClientId}
              viewerTitle={coachProgressClientName ?? undefined}
              onBack={closeCoachClientProgress}
              variant="coach"
            />
          ) : (
            <CoachRouter
              tab={coachTab}
              onOpenRoutineBuilder={(clientId) => {
                setBuilderTargetClientId(clientId);
                setIsRoutineBuilderOpen(true);
              }}
              onOpenClientProgress={(clientId, clientName) =>
                openCoachClientProgress(clientId, clientName)
              }
            />
          )}
        </main>

        {coachProgressClientId ? null : (
          <BottomNav
            activeView={activeView}
            activeTab={activeView === "LEARNER" ? clientTab : coachTab}
            onTabChange={(tab) => {
              if (activeView === "LEARNER") {
                setClientTab(tab as ClientTab);
              } else {
                setCoachTab(tab as CoachTab);
              }
            }}
          />
        )}

        <WorkoutLoggerModal
          isOpen={isWorkoutModalOpen}
          routineId={activeRoutineId}
          onClose={() => setIsWorkoutModalOpen(false)}
          onComplete={(sessionId) => {
            console.log("Workout completed:", sessionId);
          }}
        />

        <RoutineBuilderModal
          isOpen={isRoutineBuilderOpen}
          targetClientId={builderTargetClientId}
          onClose={() => setIsRoutineBuilderOpen(false)}
          onRoutineCreated={(id) => {
            console.log("Routine created:", id);
            setIsRoutineBuilderOpen(false);
          }}
        />

        <UpgradeToCoachModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          onPrimaryAction={() => setIsUpgradeModalOpen(false)}
        />
        <Toaster />
      </div>
    </div>
  );
}

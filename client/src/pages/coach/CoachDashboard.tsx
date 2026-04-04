import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  MessageCircle,
  QrCode,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ClientCard, { type CoachClientCardData } from "@/components/coach/ClientCard";
import RevenueStatsCard from "@/components/coach/RevenueStatsCard";
import { invitationService } from "@/services/invitationService";

interface CoachDashboardProps {
  onOpenRoutineBuilder: (clientId: string | null) => void;
}

const MOCK_CLIENTS: CoachClientCardData[] = [
  {
    id: "client-1",
    name: "Amy Chan",
    avatarInitial: "A",
    latestRpe: 9,
    lastWorkout: "2026-03-20",
    weeklyProgress: 3,
    weeklyTarget: 4,
    phone: "85291234567",
  },
  {
    id: "client-2",
    name: "Ben Lau",
    avatarInitial: "B",
    latestRpe: 6,
    lastWorkout: "2026-03-19",
    weeklyProgress: 2,
    weeklyTarget: 3,
    phone: "85298765432",
  },
  {
    id: "client-3",
    name: "Chloe Wong",
    avatarInitial: "C",
    latestRpe: 7,
    lastWorkout: "2026-03-18",
    weeklyProgress: 4,
    weeklyTarget: 4,
    phone: "85261234567",
  },
];

const MOCK_STATS = {
  monthlyRevenue: 12800,
  activeClients: 8,
  sessionsThisMonth: 24,
  avgClientRpe: 7.2,
};

const MOCK_EXERCISE_LIBRARY = [
  { id: "ex-1", name: "Barbell Bench Press", muscleGroup: "胸部" },
  { id: "ex-2", name: "Squat", muscleGroup: "腿部" },
  { id: "ex-3", name: "Deadlift", muscleGroup: "背部" },
  { id: "ex-4", name: "Overhead Press", muscleGroup: "肩部" },
  { id: "ex-5", name: "Pull Up", muscleGroup: "背部" },
  { id: "ex-6", name: "Incline Dumbbell Press", muscleGroup: "胸部" },
  { id: "ex-7", name: "Romanian Deadlift", muscleGroup: "腿部" },
  { id: "ex-8", name: "Tricep Pushdown", muscleGroup: "手臂" },
];

const TODAY_SCHEDULE = [
  { time: "10:00", client: "Amy Chan", routine: "Push Day A" },
  { time: "14:00", client: "Ben Lau", routine: "Leg Day B" },
  { time: "18:00", client: "Chloe Wong", routine: "Pull Day C" },
];

export default function CoachDashboard({ onOpenRoutineBuilder }: CoachDashboardProps) {
  const overdueClients = MOCK_CLIENTS.filter((client) => client.latestRpe >= 8);
  const recentClients = MOCK_CLIENTS.slice(0, 3);
  const [shareToken, setShareToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const result = await invitationService.getCoachShareToken();
        if (!active) return;
        setShareToken(result.token);
      } catch (error) {
        // 失敗時保留 fallback 邀請連結，避免 UI 功能中斷
        console.error("[CoachDashboard] Failed to get coach share token:", error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const inviteUrl = useMemo(() => {
    const appBaseUrl =
      typeof window !== "undefined" ? window.location.origin : "https://fitbuddy.app";
    const base = `${appBaseUrl.replace(/\/$/, "")}/register-flow`;
    if (!shareToken) {
      return base;
    }
    return `${base}?coach_ref=${encodeURIComponent(shareToken)}`;
  }, [shareToken]);

  return (
    <section className="min-h-screen bg-[#0f172a] px-4 py-4 space-y-3">
      <RevenueStatsCard
        monthlyRevenue={MOCK_STATS.monthlyRevenue}
        activeClients={MOCK_STATS.activeClients}
        sessionsThisMonth={MOCK_STATS.sessionsThisMonth}
      />

      {overdueClients.length > 0 && (
        <div className="bg-rose-500/10 backdrop-blur-xl rounded-[20px] border border-rose-500/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-rose-400" />
            <span className="text-sm font-semibold text-rose-400">過度訓練預警</span>
          </div>
          {overdueClients.map((client) => (
            <div
              key={client.id}
              className="flex items-center justify-between py-2 border-t border-rose-500/10"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <span className="text-rose-300 text-sm font-bold">{client.avatarInitial}</span>
                </div>
                <div>
                  <p className="text-sm text-slate-200">{client.name}</p>
                  <p className="text-xs text-slate-500">
                    最近 RPE：<span className="text-rose-400 font-bold">{client.latestRpe}</span>/10
                  </p>
                </div>
              </div>
              <a
                href={`https://wa.me/${client.phone}?text=${encodeURIComponent(
                  `Hi ${client.name}，今日訓練 RPE 好高，記得好好休息同拉伸 💪`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-xl border border-emerald-500/30 active:scale-95 transition-transform"
              >
                <MessageCircle size={12} />
                WhatsApp
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(
            `加入 FitBuddy，跟我一起訓練！點擊連結：${inviteUrl}`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-[20px] p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <MessageCircle size={20} className="text-emerald-400" />
          </div>
          <span className="text-xs text-emerald-400 font-medium text-center">WhatsApp 邀請學員</span>
        </a>

        <button
          type="button"
          onClick={() => window.alert("QR Code 功能即將上線")}
          className="bg-slate-800/80 border border-slate-700/50 rounded-[20px] p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center">
            <QrCode size={20} className="text-amber-400" />
          </div>
          <span className="text-xs text-slate-400 font-medium text-center">QR Code 邀請</span>
        </button>
      </div>

      <div className="bg-slate-800/80 backdrop-blur-xl rounded-[20px] border border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-amber-400" />
            <span className="text-sm font-semibold text-slate-200">今日排課</span>
          </div>
          <span className="text-xs text-slate-500">
            {new Date().toLocaleDateString("zh-HK", {
              month: "long",
              day: "numeric",
              weekday: "short",
            })}
          </span>
        </div>
        {TODAY_SCHEDULE.map((session) => (
          <div
            key={`${session.time}-${session.client}`}
            className="flex items-center gap-3 py-2 border-t border-slate-700/30"
          >
            <span className="text-xs font-mono text-amber-400 w-12">{session.time}</span>
            <div className="flex-1">
              <p className="text-sm text-slate-200">{session.client}</p>
              <p className="text-xs text-slate-500">{session.routine}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
        ))}
      </div>

      <div className="bg-slate-800/80 backdrop-blur-xl rounded-[20px] border border-slate-700/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">學員列表（最近 3 人）</p>
          <span className="text-xs text-slate-500">平均 RPE {MOCK_STATS.avgClientRpe}</span>
        </div>
        {recentClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onSchedule={(clientId) => onOpenRoutineBuilder(clientId)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onOpenRoutineBuilder(null)}
        className="w-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-[20px] p-5 flex items-center gap-4 active:scale-95 transition-transform"
      >
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center flex-shrink-0">
          <Sparkles size={24} className="text-blue-400" />
        </div>
        <div className="text-left">
          <p className="font-bold text-slate-100">AI 智能排表助手</p>
          <p className="text-xs text-slate-400 mt-0.5">
            輸入要求，AI 自動生成完整課表（{MOCK_EXERCISE_LIBRARY.length} 個動作庫）
          </p>
        </div>
        <ChevronRight size={18} className="text-slate-500 ml-auto" />
      </button>
    </section>
  );
}

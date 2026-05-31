import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CoachClientCardData {
  id: string;
  name: string;
  avatarInitial: string;
  latestRpe: number;
  lastWorkout: string;
  weeklyProgress: number;
  weeklyTarget: number;
  phone: string;
}

interface ClientCardProps {
  client: CoachClientCardData;
  onSchedule: (clientId: string) => void;
}

function getRpeClass(rpe: number): string {
  if (rpe <= 6) return "text-emerald-400";
  if (rpe <= 8) return "text-amber-400";
  return "text-rose-400";
}

export default function ClientCard({ client, onSchedule }: ClientCardProps) {
  const percent = Math.min((client.weeklyProgress / client.weeklyTarget) * 100, 100);
  const reachedTarget = client.weeklyProgress >= client.weeklyTarget;

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl rounded-[20px] border border-slate-700/50 p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-700/60 flex items-center justify-center">
          <span className="text-slate-100 font-bold text-sm">{client.avatarInitial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-100 font-semibold truncate">{client.name}</p>
          <p className="text-xs text-slate-500">上次：{client.lastWorkout}</p>
        </div>
        <button
          type="button"
          onClick={() => onSchedule(client.id)}
          className="bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl px-2.5 py-1.5 text-xs font-medium active:scale-95 transition-transform inline-flex items-center gap-1"
        >
          排表 <ChevronRight size={13} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className={cn("h-1.5 rounded-full", reachedTarget ? "bg-emerald-400" : "bg-amber-400")}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            本週：{client.weeklyProgress}/{client.weeklyTarget} 次
          </p>
        </div>
        <p className="text-xs text-slate-400 whitespace-nowrap">
          RPE: <span className={cn("font-bold", getRpeClass(client.latestRpe))}>{client.latestRpe}</span>
        </p>
      </div>
    </div>
  );
}

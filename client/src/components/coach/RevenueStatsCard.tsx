import { DollarSign, Users } from "lucide-react";

interface RevenueStatsCardProps {
  monthlyRevenue: number;
  activeClients: number;
  sessionsThisMonth: number;
}

export default function RevenueStatsCard({
  monthlyRevenue,
  activeClients,
  sessionsThisMonth,
}: RevenueStatsCardProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-slate-800/80 backdrop-blur-xl rounded-[20px] border border-slate-700/50 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <DollarSign size={14} className="text-amber-400" />
          <span className="text-xs text-slate-400">本月收入</span>
        </div>
        <p className="text-xl font-bold text-amber-400">${monthlyRevenue.toLocaleString()}</p>
        <p className="text-xs text-slate-500 mt-0.5">HKD</p>
      </div>

      <div className="bg-slate-800/80 backdrop-blur-xl rounded-[20px] border border-slate-700/50 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Users size={14} className="text-blue-400" />
          <span className="text-xs text-slate-400">活躍學員</span>
        </div>
        <p className="text-xl font-bold text-slate-100">{activeClients}</p>
        <p className="text-xs text-slate-500 mt-0.5">本月 {sessionsThisMonth} 堂課</p>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { api, type BodyCompositionLog } from "@/lib/api";
import {
  bodyLogsToSparkRows,
  BodyCompositionMetricChartsGrid,
} from "@/components/progress/BodyCompositionMetricCharts";

export interface ClientProgressCardProps {
  clientId: string;
  clientName?: string;
  onViewFull?: () => void;
}

export default function ClientProgressCard({
  clientId,
  clientName,
  onViewFull,
}: ClientProgressCardProps) {
  const [logs, setLogs] = useState<BodyCompositionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);
    const to = new Date();
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 30);
    void (async () => {
      try {
        const rows = await api.getBodyComposition(clientId, from.toISOString(), to.toISOString());
        if (!cancelled) setLogs(rows);
      } catch {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const chartData = useMemo(() => bodyLogsToSparkRows(logs), [logs]);

  return (
    <div className="mb-3 rounded-xl border border-neutral-700 bg-neutral-900/90 p-3">
      <p className="mb-2 text-xs font-medium text-neutral-200">
        體態趨勢（30 天）{clientName ? ` · ${clientName}` : ""}
      </p>

      {loading ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-lg bg-neutral-800" />
          ))}
        </div>
      ) : chartData.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-neutral-500">尚無體態紀錄</p>
      ) : (
        <BodyCompositionMetricChartsGrid
          data={chartData}
          size="compact"
          shell="coachEmbedded"
          remountKey={clientId}
        />
      )}

      {onViewFull ? (
        <button
          type="button"
          onClick={onViewFull}
          className="mt-3 w-full rounded-lg border border-neutral-600 bg-neutral-800/80 py-2 text-xs font-semibold text-blue-300 transition-colors hover:bg-neutral-800 active:scale-[0.99]"
        >
          查看完整進度
        </button>
      ) : null}
    </div>
  );
}

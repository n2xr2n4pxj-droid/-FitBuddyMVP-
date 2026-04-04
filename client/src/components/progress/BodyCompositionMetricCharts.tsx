import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BodyCompositionLog } from "@/lib/api";
import { cn } from "@/lib/utils";

export type BodyCompositionSparkRow = {
  label: string;
  weight: number;
  bodyFatPct: number | null;
  muscleMass: number | null;
};

export const BODY_METRIC_SERIES = [
  { key: "weight" as const, title: "體重 (kg)", stroke: "#3b82f6" },
  { key: "bodyFatPct" as const, title: "體脂率 (%)", stroke: "#f97316" },
  { key: "muscleMass" as const, title: "肌肉量 (kg)", stroke: "#22c55e" },
];

function formatHKTShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-HK", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Hong_Kong",
  });
}

export function bodyLogsToSparkRows(logs: BodyCompositionLog[]): BodyCompositionSparkRow[] {
  return logs.map((r) => ({
    label: formatHKTShort(r.measuredAt),
    weight: r.weight,
    bodyFatPct: r.bodyFatPct ?? null,
    muscleMass: r.muscleMass ?? null,
  }));
}

type Shell = "coachEmbedded" | "learner" | "coach";

function SingleMetricCard({
  data,
  metric,
  size,
  shell,
  remountKey,
}: {
  data: BodyCompositionSparkRow[];
  metric: (typeof BODY_METRIC_SERIES)[number];
  size: "compact" | "expanded";
  shell: Shell;
  remountKey: string;
}) {
  const chartH = size === "compact" ? 64 : 140;
  const expanded = size === "expanded";

  const cardClass =
    shell === "coachEmbedded"
      ? "rounded-lg border border-neutral-700 bg-neutral-950/50 p-2"
      : shell === "learner"
        ? "rounded-xl border border-gray-200 bg-gray-50/90 p-3 shadow-sm"
        : "rounded-xl border border-slate-600 bg-slate-950/50 p-3";

  const axisFill = shell === "learner" ? "#64748b" : "#94a3b8";
  const gridStroke = shell === "learner" ? "#e5e7eb" : "#334155";

  return (
    <div className={cardClass}>
      <p
        className={cn("mb-1 font-semibold", expanded ? "text-xs" : "text-[10px]")}
        style={{ color: metric.stroke }}
      >
        {metric.title}
      </p>
      <div className="w-full" style={{ height: chartH }} key={remountKey}>
        <ResponsiveContainer width="100%" height={chartH}>
          <LineChart
            data={data}
            margin={
              expanded
                ? { top: 8, right: 8, left: 0, bottom: 4 }
                : { top: 2, right: 2, left: -26, bottom: 0 }
            }
          >
            {expanded ? <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /> : null}
            <XAxis
              dataKey="label"
              hide={!expanded}
              tick={{ fontSize: 10, fill: axisFill }}
            />
            <YAxis
              hide={!expanded}
              tick={{ fontSize: 10, fill: axisFill }}
              width={36}
            />
            {expanded ? (
              <Tooltip
                contentStyle={{
                  background: shell === "learner" ? "#fff" : "#1e293b",
                  border: shell === "learner" ? "1px solid #e5e7eb" : "1px solid #334155",
                }}
                labelStyle={{ color: shell === "learner" ? "#111" : "#e2e8f0" }}
                formatter={(value) => [value == null ? "—" : String(value), metric.title]}
              />
            ) : null}
            {!expanded ? <YAxis hide domain={["auto", "auto"]} /> : null}
            <Line
              type="monotone"
              dataKey={metric.key}
              name={metric.title}
              stroke={metric.stroke}
              strokeWidth={2}
              dot={expanded}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BodyCompositionMetricChartsGrid({
  data,
  size,
  shell,
  remountKey,
}: {
  data: BodyCompositionSparkRow[];
  size: "compact" | "expanded";
  shell: Shell;
  /** 用於 Tab 切換時強制 Recharts 重算寬度 */
  remountKey: string;
}) {
  return (
    <div className="grid gap-2">
      {BODY_METRIC_SERIES.map((metric) => (
        <SingleMetricCard
          key={metric.key}
          data={data}
          metric={metric}
          size={size}
          shell={shell}
          remountKey={`${remountKey}-${metric.key}`}
        />
      ))}
    </div>
  );
}

import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoachTipBannerProps {
  tip: string;
  coachName?: string;
  variant?: "gold" | "blue" | "green";
}

export default function CoachTipBanner({
  tip,
  coachName,
  variant = "gold",
}: CoachTipBannerProps) {
  if (!tip?.trim()) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-[20px] p-4 border",
        variant === "gold" && "border-amber-400/40 bg-amber-50/60 text-amber-800 animate-pulse",
        variant === "blue" && "border-blue-400/40 bg-blue-50/60 text-blue-800",
        variant === "green" &&
          "border-emerald-400/40 bg-emerald-50/60 text-emerald-800",
      )}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Lightbulb size={14} />
        <span>來自 {coachName ?? "教練"} 的提示</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">「{tip}」</p>
    </div>
  );
}

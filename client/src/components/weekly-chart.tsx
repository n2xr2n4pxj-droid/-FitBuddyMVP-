import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import type { WeeklySummary } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { createQueryFn } from "@/lib/queryClient";

Chart.register(...registerables);

export function WeeklyChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const { data: weeklySummary, isLoading, isError } = useQuery<WeeklySummary>({
    queryKey: ["/api/summary/weekly"],
    queryFn: createQueryFn<WeeklySummary>(),
  });

  useEffect(() => {
    if (!canvasRef.current || !weeklySummary || isLoading) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const labels = weeklySummary.days.map((day) => 
      format(parseISO(day.date), "MMM d")
    );
    const calories = weeklySummary.days.map((day) => day.totalCalories);
    const workoutMinutes = weeklySummary.days.map((day) => day.totalWorkoutMinutes);

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Calories",
            data: calories,
            borderColor: "hsl(142, 76%, 42%)",
            backgroundColor: "hsla(142, 76%, 42%, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            yAxisID: "y",
          },
          {
            label: "Workout Minutes",
            data: workoutMinutes,
            borderColor: "hsl(197, 37%, 45%)",
            backgroundColor: "hsla(197, 37%, 45%, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                family: "Inter, sans-serif",
                size: 12,
              },
            },
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: 12,
            titleFont: {
              family: "Inter, sans-serif",
              size: 14,
            },
            bodyFont: {
              family: "JetBrains Mono, monospace",
              size: 13,
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                family: "Inter, sans-serif",
                size: 11,
              },
            },
          },
          y: {
            type: "linear",
            display: true,
            position: "left",
            title: {
              display: true,
              text: "Calories",
              font: {
                family: "Inter, sans-serif",
                size: 12,
              },
            },
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
            },
            ticks: {
              font: {
                family: "JetBrains Mono, monospace",
                size: 11,
              },
            },
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            title: {
              display: true,
              text: "Minutes",
              font: {
                family: "Inter, sans-serif",
                size: 12,
              },
            },
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              font: {
                family: "JetBrains Mono, monospace",
                size: 11,
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [weeklySummary, isLoading]);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !weeklySummary) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">Unable to load weekly trends</p>
        <p className="text-sm text-muted-foreground">Please try again later</p>
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="weekly-chart">
      <canvas ref={canvasRef} />
    </div>
  );
}

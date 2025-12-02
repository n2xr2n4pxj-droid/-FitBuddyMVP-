import { useState } from "react";
import { useMeals } from "@/hooks/use-meals";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { Card } from "@/components/ui/card";

type TimeRange = "7days" | "30days" | "all";

export default function History() {
  const { data: meals = [] } = useMeals();
  const [timeRange, setTimeRange] = useState<TimeRange>("7days");

  // 過濾日期範圍內的餐點
  const getFilteredMeals = () => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "7days":
        startDate = subDays(now, 7);
        break;
      case "30days":
        startDate = subDays(now, 30);
        break;
      case "all":
        return meals;
      default:
        startDate = subDays(now, 7);
    }

    return meals.filter(meal => {
      const mealDate = new Date(meal.date || meal.createdAt);
      return isWithinInterval(mealDate, {
        start: startOfDay(startDate),
        end: endOfDay(now)
      });
    });
  };

  // 按日期聚合數據
  const getChartData = () => {
    const filteredMeals = getFilteredMeals();
    const dataMap = new Map<string, {
      date: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>();

    filteredMeals.forEach(meal => {
      const mealDate = new Date(meal.date || meal.createdAt);
      const dateKey = format(mealDate, "yyyy-MM-dd");
      
      if (!dataMap.has(dateKey)) {
        dataMap.set(dateKey, {
          date: format(mealDate, "MM/dd"),
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        });
      }

      const dayData = dataMap.get(dateKey)!;
      dayData.calories += Number(meal.calories || 0);
      dayData.protein += Number(meal.protein || 0);
      dayData.carbs += Number(meal.carbs || 0);
      dayData.fat += Number(meal.fat || 0);
    });

    // 轉換為數組並排序
    return Array.from(dataMap.values()).sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const chartData = getChartData();

  // 計算統計數據
  const getStats = () => {
    if (chartData.length === 0) {
      return {
        avgCalories: 0,
        avgProtein: 0,
        avgCarbs: 0,
        avgFat: 0,
        maxCalories: 0,
        minCalories: 0
      };
    }

    const totalCalories = chartData.reduce((sum, day) => sum + day.calories, 0);
    const totalProtein = chartData.reduce((sum, day) => sum + day.protein, 0);
    const totalCarbs = chartData.reduce((sum, day) => sum + day.carbs, 0);
    const totalFat = chartData.reduce((sum, day) => sum + day.fat, 0);
    const days = chartData.length;

    const calories = chartData.map(d => d.calories);

    return {
      avgCalories: Math.round(totalCalories / days),
      avgProtein: Math.round(totalProtein / days),
      avgCarbs: Math.round(totalCarbs / days),
      avgFat: Math.round(totalFat / days),
      maxCalories: Math.max(...calories),
      minCalories: Math.min(...calories)
    };
  };

  const stats = getStats();

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        📊 Nutrition History
      </h1>

      {/* 時間範圍選擇器 */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setTimeRange("7days")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            timeRange === "7days"
              ? "bg-teal-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => setTimeRange("30days")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            timeRange === "30days"
              ? "bg-teal-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          Last 30 Days
        </button>
        <button
          onClick={() => setTimeRange("all")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            timeRange === "all"
              ? "bg-teal-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          All Time
        </button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Calories</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.avgCalories}
          </p>
          <p className="text-xs text-gray-500">kcal/day</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Protein</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {stats.avgProtein}g
          </p>
          <p className="text-xs text-gray-500">per day</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Carbs</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {stats.avgCarbs}g
          </p>
          <p className="text-xs text-gray-500">per day</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Fat</p>
          <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
            {stats.avgFat}g
          </p>
          <p className="text-xs text-gray-500">per day</p>
        </Card>
      </div>

      {/* 圖表區域 */}
      {chartData.length > 0 ? (
        <>
          {/* Calories 趨勢圖 */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              📈 Daily Calories Trend
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="calories"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  name="Calories (kcal)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Macronutrients 趨勢圖 */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              🍎 Macronutrients Trend
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="protein"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Protein (g)"
                />
                <Line
                  type="monotone"
                  dataKey="carbs"
                  stroke="#f97316"
                  strokeWidth={2}
                  name="Carbs (g)"
                />
                <Line
                  type="monotone"
                  dataKey="fat"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  name="Fat (g)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            No data available for the selected time range
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Start logging meals to see your nutrition trends
          </p>
        </Card>
      )}
    </div>
  );
}

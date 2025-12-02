import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Apple, Download, FileDown, Calendar, Target, TrendingDown, AlertCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { generateNutritionPDF } from "@/utils/pdfGenerator";
import NutritionInsights from "@/components/NutritionInsights";
import { useTDEEProfile } from "@/hooks/use-tdee";
import { useMeals } from "@/hooks/use-meals";
import type { Meal } from "@shared/schema";

type TimeRange = "today" | "7days" | "14days" | "30days" | "all";

interface DailyData {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function Trends() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7days");
  
  // Get TDEE Profile (which contains goals)
  const { data: profile, isLoading: profileLoading } = useTDEEProfile();
  
  // Get meals data
  const { data: meals = [], isLoading: mealsLoading } = useMeals();

  // Default goals if profile not set
  const goals = {
    dailyCalories: profile?.targetCalories || 2000,
    dailyProtein: profile?.targetProtein || 150,
    dailyCarbs: profile?.targetCarbs || 200,
    dailyFat: profile?.targetFat || 65,
  };

  const dateRange = useMemo(() => {
    const now = new Date();
    const startDate = new Date();

    if (timeRange === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === "7days") {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === "14days") {
      startDate.setDate(now.getDate() - 14);
    } else if (timeRange === "30days") {
      startDate.setDate(now.getDate() - 30);
    } else {
      startDate.setFullYear(now.getFullYear() - 1);
    }

    return { startDate, endDate: now };
  }, [timeRange]);

  const dailyData = useMemo(() => {
    const filteredMeals = meals.filter((meal) => {
      const mealDate = new Date(meal.date || meal.createdAt);
      return mealDate >= dateRange.startDate && mealDate <= dateRange.endDate;
    });

    const dataByDate: { [key: string]: DailyData } = {};

    filteredMeals.forEach((meal) => {
      const mealDate = new Date(meal.date || meal.createdAt);
      const date = mealDate.toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
      });

      if (!dataByDate[date]) {
        dataByDate[date] = {
          date,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        };
      }

      dataByDate[date].calories += Number(meal.calories || 0);
      dataByDate[date].protein += Number(meal.protein || 0);
      dataByDate[date].carbs += Number(meal.carbs || 0);
      dataByDate[date].fat += Number(meal.fat || 0);
    });

    return Object.values(dataByDate).sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }, [meals, dateRange]);

  const averages = useMemo(() => {
    if (dailyData.length === 0) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    const totals = dailyData.reduce(
      (acc, day) => ({
        calories: acc.calories + day.calories,
        protein: acc.protein + day.protein,
        carbs: acc.carbs + day.carbs,
        fat: acc.fat + day.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const days = dailyData.length;
    return {
      calories: Math.round(totals.calories / days),
      protein: Math.round(totals.protein / days),
      carbs: Math.round(totals.carbs / days),
      fat: Math.round(totals.fat / days),
    };
  }, [dailyData]);

  const achievementRates = useMemo(() => {
    return {
      calories: goals.dailyCalories > 0 ? Math.round((averages.calories / goals.dailyCalories) * 100) : 0,
      protein: goals.dailyProtein > 0 ? Math.round((averages.protein / goals.dailyProtein) * 100) : 0,
      carbs: goals.dailyCarbs > 0 ? Math.round((averages.carbs / goals.dailyCarbs) * 100) : 0,
      fat: goals.dailyFat > 0 ? Math.round((averages.fat / goals.dailyFat) * 100) : 0,
    };
  }, [averages, goals]);

  const trend = useMemo(() => {
    if (dailyData.length < 2) return { direction: "stable", change: 0 };

    const midpoint = Math.floor(dailyData.length / 2);
    const firstHalf = dailyData.slice(0, midpoint);
    const secondHalf = dailyData.slice(midpoint);

    const firstAvg = firstHalf.reduce((sum, d) => sum + d.calories, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.calories, 0) / secondHalf.length;

    const change = Math.round(((secondAvg - firstAvg) / firstAvg) * 100);

    return {
      direction: change > 5 ? "up" : change < -5 ? "down" : "stable",
      change: Math.abs(change),
    };
  }, [dailyData]);

  const exportToCSV = () => {
    const headers = ["Date", "Calories", "Protein (g)", "Carbs (g)", "Fat (g)"];
    const rows = dailyData.map((d) => [
      d.date,
      d.calories,
      d.protein.toFixed(1),
      d.carbs.toFixed(1),
      d.fat.toFixed(1),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nutrition-trends-${timeRange}.csv`;
    a.click();
  };

  const handleExportPDF = () => {
    if (!profile) {
      alert("Please set up your TDEE profile first in the Profile page");
      return;
    }

    const filteredMeals = meals.filter((meal) => {
      const mealDate = new Date(meal.date || meal.createdAt);
      return mealDate >= dateRange.startDate && mealDate <= dateRange.endDate;
    }).map(meal => {
      const mealDate = meal.date || meal.createdAt;
      const dateStr = typeof mealDate === 'string' 
        ? mealDate 
        : new Date(mealDate).toISOString();
      
      return {
        id: typeof meal.id === 'string' ? parseInt(meal.id, 10) || 0 : Number(meal.id) || 0,
        name: meal.foodName || 'Unknown Food',
        mealType: meal.mealType,
        calories: Number(meal.calories || 0),
        protein: Number(meal.protein || 0),
        carbs: Number(meal.carbs || 0),
        fat: Number(meal.fat || 0),
        createdAt: dateStr,
      };
    });

    generateNutritionPDF(
      filteredMeals,
      {
        averages,
        goals,
        achievement: achievementRates,
      },
      timeRangeLabels[timeRange]
    );
  };

  const timeRangeLabels: Record<TimeRange, string> = {
    today: "Today",
    "7days": "Last 7 Days",
    "14days": "Last 14 Days",
    "30days": "Last 30 Days",
    all: "All Time",
  };

  const isLoading = profileLoading || mealsLoading;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Nutrition Trends
        </h1>
        
        {dailyData.length > 0 && !profileLoading && (
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              <FileDown className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Time Range Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["today", "7days", "14days", "30days", "all"] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeRange === range
                ? "bg-teal-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {timeRangeLabels[range]}
          </button>
        ))}
      </div>

      {/* TDEE Not Set Warning */}
      {!profileLoading && !profile?.tdee && (
        <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-1">
                  Set up your TDEE profile
                </h3>
                <p className="text-sm text-orange-800 dark:text-orange-300 mb-3">
                  To see your personalized nutrition goals and insights, please complete your profile first.
                </p>
                <a
                  href="/profile"
                  className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
                >
                  Go to Profile →
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-teal-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading data...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && dailyData.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Calendar className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No data for this period
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Start logging your meals to see nutrition trends!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data View */}
      {!isLoading && dailyData.length > 0 && (
        <>
          {/* Trend Summary Card */}
          <Card className="mb-6 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 border-teal-200 dark:border-teal-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Trend Analysis
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {trend.direction === "up" && (
                      <>
                        <TrendingUp className="inline h-5 w-5 text-orange-500 mr-2" />
                        Calorie intake increased by <strong>{trend.change}%</strong> recently
                      </>
                    )}
                    {trend.direction === "down" && (
                      <>
                        <TrendingDown className="inline h-5 w-5 text-green-500 mr-2" />
                        Calorie intake decreased by <strong>{trend.change}%</strong> recently
                      </>
                    )}
                    {trend.direction === "stable" && (
                      <>
                        <Target className="inline h-5 w-5 text-teal-500 mr-2" />
                        Calorie intake is <strong>stable</strong>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Days tracked</div>
                  <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">{dailyData.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Stats with Goal Achievement */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Avg Calories
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {averages.calories}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  kcal/day · Goal: {goals.dailyCalories}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      achievementRates.calories >= 90 && achievementRates.calories <= 110
                        ? "bg-green-500"
                        : "bg-orange-500"
                    }`}
                    style={{ width: `${Math.min(achievementRates.calories, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {achievementRates.calories}% of goal
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Avg Protein
                </div>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {averages.protein}g
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  per day · Goal: {goals.dailyProtein}g
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`bg-red-500 h-2 rounded-full`}
                    style={{ width: `${Math.min(achievementRates.protein, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {achievementRates.protein}% of goal
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Avg Carbs
                </div>
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {averages.carbs}g
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  per day · Goal: {goals.dailyCarbs}g
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`bg-orange-500 h-2 rounded-full`}
                    style={{ width: `${Math.min(achievementRates.carbs, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {achievementRates.carbs}% of goal
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Avg Fat
                </div>
                <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                  {averages.fat}g
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  per day · Goal: {goals.dailyFat}g
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`bg-teal-500 h-2 rounded-full`}
                    style={{ width: `${Math.min(achievementRates.fat, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {achievementRates.fat}% of goal
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Calories Trend Chart with Goal Line */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Calories Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="date" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <ReferenceLine
                    y={goals.dailyCalories}
                    stroke="#999"
                    strokeDasharray="5 5"
                    label={{ value: "Goal", position: "right" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="calories"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    name="Calories (kcal)"
                    dot={{ fill: "#14b8a6", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Macronutrients Trend Chart with Goal Lines */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                Macronutrients Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="date" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <ReferenceLine
                    y={goals.dailyProtein}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                  <ReferenceLine
                    y={goals.dailyCarbs}
                    stroke="#f97316"
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                  <ReferenceLine
                    y={goals.dailyFat}
                    stroke="#10b981"
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="protein"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Protein (g)"
                    dot={{ fill: "#ef4444", r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="carbs"
                    stroke="#f97316"
                    strokeWidth={2}
                    name="Carbs (g)"
                    dot={{ fill: "#f97316", r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="fat"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Fat (g)"
                    dot={{ fill: "#10b981", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Nutrition Insights */}
          <NutritionInsights meals={meals} goals={goals} />
        </>
      )}
    </div>
  );
}

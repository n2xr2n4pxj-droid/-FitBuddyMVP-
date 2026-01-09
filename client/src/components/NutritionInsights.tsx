import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Target } from 'lucide-react';
import type { Meal } from '@shared/schema';

interface InsightsProps {
  meals: Meal[];
  goals: {
    dailyCalories: number;
    dailyProtein: number;
    dailyCarbs: number;
    dailyFat: number;
  };
}

export default function NutritionInsights({ meals, goals }: InsightsProps) {
  const insights = useMemo(() => {
    if (meals.length === 0) return null;
    
    // Calculate daily totals
    const dailyTotals: { [date: string]: { calories: number; protein: number; carbs: number; fat: number } } = {};
    
    meals.forEach(meal => {
      const mealDate = new Date(meal.consumedAt || meal.createdAt);
      const date = mealDate.toLocaleDateString();
      if (!dailyTotals[date]) {
        dailyTotals[date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }
      dailyTotals[date].calories += Number(meal.calories || 0);
      dailyTotals[date].protein += Number(meal.protein || 0);
      dailyTotals[date].carbs += Number(meal.carbs || 0);
      dailyTotals[date].fat += Number(meal.fat || 0);
    });
    
    const days = Object.values(dailyTotals);
    const daysCount = days.length;
    
    if (daysCount === 0) return null;
    
    // Calculate averages
    const avgCalories = days.reduce((sum, d) => sum + d.calories, 0) / daysCount;
    const avgProtein = days.reduce((sum, d) => sum + d.protein, 0) / daysCount;
    const avgCarbs = days.reduce((sum, d) => sum + d.carbs, 0) / daysCount;
    const avgFat = days.reduce((sum, d) => sum + d.fat, 0) / daysCount;
    
    // Calculate consistency (days meeting goals)
    const daysMetCalorieGoal = days.filter(d => 
      d.calories >= goals.dailyCalories * 0.9 && d.calories <= goals.dailyCalories * 1.1
    ).length;
    const daysMetProteinGoal = days.filter(d => d.protein >= goals.dailyProtein * 0.9).length;
    
    const consistency = Math.round((daysMetCalorieGoal / daysCount) * 100);
    const proteinConsistency = Math.round((daysMetProteinGoal / daysCount) * 100);
    
    // Calculate macro split
    const totalMacros = avgProtein * 4 + avgCarbs * 4 + avgFat * 9;
    const proteinPercent = totalMacros > 0 ? Math.round((avgProtein * 4 / totalMacros) * 100) : 0;
    const carbsPercent = totalMacros > 0 ? Math.round((avgCarbs * 4 / totalMacros) * 100) : 0;
    const fatPercent = totalMacros > 0 ? Math.round((avgFat * 9 / totalMacros) * 100) : 0;
    
    // Ideal macro split for comparison (40/30/30)
    const idealProtein = 30;
    const idealCarbs = 40;
    const idealFat = 30;
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (avgCalories < goals.dailyCalories * 0.8) {
      recommendations.push('⚠️ You\'re consistently under your calorie goal. Consider increasing portion sizes.');
    } else if (avgCalories > goals.dailyCalories * 1.2) {
      recommendations.push('⚠️ You\'re consistently over your calorie goal. Try smaller portions or lower-calorie options.');
    }
    
    if (avgProtein < goals.dailyProtein * 0.8) {
      recommendations.push('🥩 Increase protein intake with lean meats, fish, eggs, or protein supplements.');
    }
    
    if (proteinPercent < 20) {
      recommendations.push('🔄 Your protein percentage is low. Aim for 25-35% of calories from protein.');
    } else if (proteinPercent > 40) {
      recommendations.push('🔄 Your protein percentage is high. Balance with more carbs and healthy fats.');
    }
    
    if (consistency < 50) {
      recommendations.push('📊 Work on consistency! Try meal planning to hit your goals more regularly.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ Great job! You\'re on track with your nutrition goals.');
    }
    
    return {
      avgCalories: Math.round(avgCalories),
      avgProtein: Math.round(avgProtein),
      avgCarbs: Math.round(avgCarbs),
      avgFat: Math.round(avgFat),
      consistency,
      proteinConsistency,
      proteinPercent,
      carbsPercent,
      fatPercent,
      idealProtein,
      idealCarbs,
      idealFat,
      recommendations,
      daysCount,
    };
  }, [meals, goals]);
  
  if (!insights) {
    return null;
  }
  
  return (
    <div className="space-y-6">
      {/* Insights Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Nutrition Insights & Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Consistency Score */}
            <div className="p-4 bg-gradient-to-br from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Goal Consistency
                </span>
                {insights.consistency >= 70 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                )}
              </div>
              <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                {insights.consistency}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Days meeting calorie goal
              </div>
            </div>
            
            {/* Protein Consistency */}
            <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Protein Consistency
                </span>
                {insights.proteinConsistency >= 70 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                )}
              </div>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {insights.proteinConsistency}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Days meeting protein goal
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Macro Split Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Macro Split Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Protein */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700 dark:text-gray-300">Protein: {insights.proteinPercent}%</span>
                <span className="text-gray-500">Ideal: {insights.idealProtein}%</span>
              </div>
              <div className="relative w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-red-500 rounded-full"
                  style={{ width: `${insights.proteinPercent}%` }}
                ></div>
                <div
                  className="absolute h-full border-2 border-red-700 rounded-full"
                  style={{ width: `${insights.idealProtein}%`, opacity: 0.5 }}
                ></div>
              </div>
            </div>
            
            {/* Carbs */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700 dark:text-gray-300">Carbs: {insights.carbsPercent}%</span>
                <span className="text-gray-500">Ideal: {insights.idealCarbs}%</span>
              </div>
              <div className="relative w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-orange-500 rounded-full"
                  style={{ width: `${insights.carbsPercent}%` }}
                ></div>
                <div
                  className="absolute h-full border-2 border-orange-700 rounded-full"
                  style={{ width: `${insights.idealCarbs}%`, opacity: 0.5 }}
                ></div>
              </div>
            </div>
            
            {/* Fat */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700 dark:text-gray-300">Fat: {insights.fatPercent}%</span>
                <span className="text-gray-500">Ideal: {insights.idealFat}%</span>
              </div>
              <div className="relative w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-teal-500 rounded-full"
                  style={{ width: `${insights.fatPercent}%` }}
                ></div>
                <div
                  className="absolute h-full border-2 border-teal-700 rounded-full"
                  style={{ width: `${insights.idealFat}%`, opacity: 0.5 }}
                ></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Personalized Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {insights.recommendations.map((rec, index) => (
              <li
                key={index}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <span className="text-lg">{rec.split(' ')[0]}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                  {rec.substring(rec.indexOf(' ') + 1)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}


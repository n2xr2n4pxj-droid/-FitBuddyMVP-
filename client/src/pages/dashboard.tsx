import TodaysMeals from "@/components/todays-meals";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { LogOut, Activity, Utensils, Flame, TrendingUp, Target, Plus, Trash2, Edit2, Minus } from "lucide-react";
import { format } from "date-fns";
import type { DailySummary, Meal, Workout } from "@shared/schema";
import { MealForm } from "@/components/meal-form";
import { WeeklyChart } from "@/components/weekly-chart";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { queryClient, createQueryFn } from "@/lib/queryClient";
import { request, normalizeApiError } from "@/lib/api-client";
import { useLocation } from "wouter";
import { useTodayProgress, useTDEEProfile } from "@/hooks/use-tdee";

// Training Detail Sets - 動態行
interface TrainingSet {
  id: string;
  sets: string;
  reps: string;
  weight: string;
}

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("登出失敗");
      }

      // 清除所有 React Query 緩存
      queryClient.clear();
      
      toast({
        title: "已登出",
        description: "您已成功登出",
      });

      // 重定向到首頁
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "登出失敗",
        description: "無法完成登出，請稍後再試",
        variant: "destructive",
      });
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Redirecting to login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // 載入個人最佳紀錄
  useEffect(() => {
    if (isAuthenticated) {
      loadPersonalBests();
    }
  }, [isAuthenticated]);

  const loadPersonalBests = async () => {
    try {
      const data = await request.get<any[]>('/api/workouts/stats/personal-best');
      setPersonalBests(data);
    } catch (error) {
      console.error('Error loading personal bests:', error);
    }
  };

  const resetWorkoutForm = () => {
    setExerciseName('');
    setTrainingSets([{ id: '1', sets: '', reps: '', weight: '' }]);
    setWeightUnit('kg');
    setWorkoutNotes('');
    setCardioType('');
    setCardioDuration('');
    setCardioCustomType('');
    setEditingWorkoutId(null);
    setEditingWorkoutPerformedAt(null);
  };

  // 添加新的訓練行
  const addTrainingSet = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setTrainingSets([
      ...trainingSets,
      { id: newId, sets: '', reps: '', weight: '' }
    ]);
  };

  // 刪除訓練行
  const removeTrainingSet = (id: string) => {
    if (trainingSets.length > 1) {
      setTrainingSets(trainingSets.filter(set => set.id !== id));
    }
  };

  // 更新訓練行
  const updateTrainingSet = (id: string, field: 'sets' | 'reps' | 'weight', value: string) => {
    setTrainingSets(
      trainingSets.map(set =>
        set.id === id ? { ...set, [field]: value } : set
      )
    );
  };

  const handleSubmitWorkout = async (e: React.FormEvent) => {
    e.preventDefault();

    // 至少填寫一個運動類型
    if (!exerciseName && !cardioType) {
      toast({
        title: "Error",
        description: "Please fill in either Exercise Name or Cardio Type",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = editingWorkoutId ? `/api/workouts/${editingWorkoutId}` : '/api/workouts';
      const method = editingWorkoutId ? 'PUT' : 'POST';

      // 如果是力量訓練
      if (exerciseName) {
        // 保存 exercises 陣列（所有訓練組）
        const exercisesData = trainingSets
          .filter(set => set.sets || set.reps || set.weight) // 只包含至少有一個字段的組
          .map(set => ({
            exerciseName: exerciseName.trim(),
            sets: set.sets && set.sets.trim() ? parseInt(set.sets) : null,
            reps: set.reps && set.reps.trim() ? parseInt(set.reps) : null,
            weight: set.weight && set.weight.trim() ? parseFloat(set.weight) : null,
            weightUnit: weightUnit || 'kg',
          }));
        
        // 確保至少有一個訓練組
        if (exercisesData.length === 0) {
          toast({
            title: "Error",
            description: "Please enter at least one set of training data",
            variant: "destructive",
          });
          return;
        }

        console.log('Submitting exercises:', exercisesData); // 調試日誌

        // 計算摘要（用於主欄位顯示）
        const weights = exercisesData.filter(e => e.weight !== null && e.weight !== undefined).map(e => e.weight || 0);
        const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
        const totalSets = exercisesData.reduce((sum, e) => sum + (e.sets || 0), 0);
        const firstReps = exercisesData[0]?.reps || null;
        
        const requestBody = {
          workoutType: 'STRENGTH',
          exerciseName: exerciseName.trim(),
          duration: 30,
          calories: 0,
          exercises: exercisesData, // ✅ 發送完整陣列（不是字符串）
          sets: totalSets,
          reps: firstReps,
          weight: maxWeight > 0 ? maxWeight : null,
          weightUnit: 'kg',
          notes: workoutNotes || null,
          performedAt: editingWorkoutPerformedAt || new Date().toISOString(),
        };

        console.log('[Dashboard] Submitting STRENGTH workout with all sets:', requestBody);
        console.log('[Dashboard] Number of sets being saved:', exercisesData.length);
        console.log('[Dashboard] Max weight:', maxWeight, 'Total sets:', totalSets);

        const result = method === 'PUT'
          ? await request.put(url, requestBody)
          : await request.post(url, requestBody);
        console.log('Workout saved:', result);
      }
      // 有氧訓練邏輯
      else if (cardioType && cardioDuration) {
        // 如果選擇了 "Other"，使用自定義輸入；否則使用選擇的類型
        const finalCardioType = cardioType === 'Other' ? cardioCustomType : cardioType;
        
        if (!finalCardioType || !finalCardioType.trim()) {
          toast({
            title: "Error",
            description: "Please enter custom cardio type",
            variant: "destructive",
          });
          return;
        }

        const requestBody = {
          workoutType: 'CARDIO', // ✅ 確保是 'CARDIO' 不是其他值
          exerciseName: finalCardioType.trim(), // ✅ 使用最終的 cardio 類型
          duration: parseInt(cardioDuration) || 0, // ✅ 確保有 duration
          calories: 0,
          sets: null,
          reps: null,
          weight: null,
          weightUnit: 'kg',
          notes: workoutNotes || null,
          performedAt: editingWorkoutPerformedAt || new Date().toISOString(),
        };

        console.log('[Dashboard] Submitting CARDIO workout:', requestBody);

        const result = method === 'PUT'
          ? await request.put(url, requestBody)
          : await request.post(url, requestBody);
        console.log('✅ Cardio saved:', result);
      }

      await loadPersonalBests();
      // 立即刷新 workouts 查詢
      await queryClient.refetchQueries({ queryKey: ["/api/workouts", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/daily", today] });

      resetWorkoutForm();
      setShowWorkoutForm(false);

      toast({
        title: "Success",
        description: editingWorkoutId ? 'Workout updated successfully' : 'Workout logged successfully',
      });
    } catch (err) {
      const normalized = normalizeApiError(err);
      console.error('Error saving workout:', err);
      toast({
        title: "Error",
        description: normalized.message || 'Failed to save workout',
        variant: "destructive",
      });
    }
  };

  const handleDeleteWorkout = async (id: string | number) => {
    if (!confirm('確定要刪除這個訓練記錄嗎？')) return;

    try {
      await request.delete(`/api/workouts/${id}`);
      // Axios 會自動處理錯誤，如果到這裡說明刪除成功

      await loadPersonalBests();
      // 立即刷新 workouts 查詢
      await queryClient.refetchQueries({ queryKey: ["/api/workouts", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/daily", today] });

      toast({
        title: "成功",
        description: '訓練記錄已刪除',
      });
    } catch (err) {
      const normalized = normalizeApiError(err);
      console.error('Error deleting workout:', err);
      toast({
        title: "錯誤",
        description: normalized.message || 'Failed to delete workout',
        variant: "destructive",
      });
    }
  };

  const handleEditWorkout = (workout: any) => {
    // Workout schema 中沒有 exercises 字段，只使用 workoutType 和 durationMinutes
    const workoutType = workout.workoutType || '';

    if (workoutType === 'STRENGTH' || workoutType === 'Strength Training') {
      // 對於力量訓練，需要從 notes 或其他地方獲取信息
      // 暫時設置為空，因為 schema 中沒有這些字段
      setExerciseName('');
      setTrainingSets([{ id: '1', sets: '', reps: '', weight: '' }]);
      setWeightUnit('kg');
      setCardioType('');
      setCardioDuration('');
    } else if (workoutType === 'CARDIO' || workoutType === 'Cardio') {
      setExerciseName('');
      setTrainingSets([{ id: '1', sets: '', reps: '', weight: '' }]);
      setWeightUnit('kg');
      setCardioType('');
      setCardioCustomType('');
      setCardioDuration((workout.durationMinutes || 0).toString());
    }

    setWorkoutNotes(workout.notes || '');
    setEditingWorkoutId(workout.id);
    // 保存原始的 date
    const originalDate = workout.date;
    setEditingWorkoutPerformedAt(originalDate ? new Date(originalDate).toISOString() : null);
    setShowWorkoutForm(true);
  };

  const formatWorkoutDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todaySummary, isLoading: summaryLoading } = useQuery<DailySummary>({
    queryKey: ["/api/summary/daily", today],
    queryFn: createQueryFn<DailySummary>(),
    enabled: isAuthenticated,
  });

  const { data: meals = [], isLoading: mealsLoading } = useQuery<Meal[]>({
    queryKey: ["/api/meals", today],
    queryFn: createQueryFn<Meal[]>(),
    enabled: isAuthenticated,
  });

  const { data: workouts = [], isLoading: workoutsLoading } = useQuery<Workout[]>({
    queryKey: ["/api/workouts", today],
    enabled: isAuthenticated,
    queryFn: async () => {
      try {
        console.log('📋 Fetching workouts…');
        
        // 先獲取所有訓練
        const allWorkouts = await request.get<any[]>('/api/workouts');
        
        console.log(`✅ Fetched ${allWorkouts.length} total workouts`);
        
        // 顯示所有訓練的時間戳
        allWorkouts.forEach((w: any, idx: number) => {
          console.log(`  [${idx}] ${w.exercise_name || w.name} - ${w.performed_at}`);
        });
        
        // 前端篩選今日訓練
        const todayWorkouts = allWorkouts.filter((workout: any) => {
          if (!workout.performed_at) {
            console.warn('⚠️ Workout missing performed_at');
            return false;
          }
          
          const workoutDate = new Date(workout.performed_at);
          const workoutDateStr = format(workoutDate, 'yyyy-MM-dd');
          
          const matches = workoutDateStr === today;
          if (matches) {
            console.log(`✓ Match found: ${workoutDateStr}`);
          }
          
          return matches;
        });
        
        console.log(`🎯 Found ${todayWorkouts.length} workouts for today (${today})`);
        return todayWorkouts;
        
      } catch (error) {
        console.error('❌ Error fetching workouts:', error);
        return [];
      }
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // 訓練功能狀態
  const [personalBests, setPersonalBests] = useState<any[]>([]);
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | number | null>(null);
  const [editingWorkoutPerformedAt, setEditingWorkoutPerformedAt] = useState<string | null>(null);
  
  // Strength Training fields
  const [exerciseName, setExerciseName] = useState('');
  const [trainingSets, setTrainingSets] = useState<TrainingSet[]>([
    { id: '1', sets: '', reps: '', weight: '' }
  ]);
  const [weightUnit, setWeightUnit] = useState('kg');
  const [workoutNotes, setWorkoutNotes] = useState('');
  
  // Cardio fields
  const [cardioType, setCardioType] = useState('');
  const [cardioDuration, setCardioDuration] = useState('');
  const [cardioCustomType, setCardioCustomType] = useState('');

  // TDEE Progress Tracking
  const { data: progress } = useTodayProgress();
  const { data: tdeeProfile } = useTDEEProfile();
  const hasTDEE = tdeeProfile?.tdee !== null && tdeeProfile?.tdee !== undefined;

  if (authLoading) {
    return <DashboardSkeleton />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back, {user?.firstName || user?.email || 'User'}! 👋
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* TDEE Progress Section */}
      {hasTDEE && progress ? (
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Daily Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Calorie Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">Calories</span>
                  <span className="font-bold text-lg">
                    {progress.consumed.calories} / {progress.target.calories}
                  </span>
                </div>
                <Progress 
                  value={Math.min(100, progress.percentage.calories)} 
                  className="h-3"
                />
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>{progress.percentage.calories}% consumed</span>
                  <span className={progress.remaining.calories >= 0 ? "text-green-600" : "text-red-600"}>
                    {Math.abs(progress.remaining.calories)} kcal {progress.remaining.calories >= 0 ? 'remaining' : 'over'}
                  </span>
                </div>
              </div>

              {/* Macros Grid */}
              <div className="grid grid-cols-3 gap-4">
                {/* Protein */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Protein</span>
                    <span className="text-xs text-gray-500">{progress.percentage.protein}%</span>
                  </div>
                  <Progress 
                    value={Math.min(100, progress.percentage.protein)} 
                    className="h-2"
                  />
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-600">
                      {progress.consumed.protein}g
                    </div>
                    <div className="text-xs text-gray-500">/ {progress.target.protein}g</div>
                  </div>
                </div>

                {/* Carbs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Carbs</span>
                    <span className="text-xs text-gray-500">{progress.percentage.carbs}%</span>
                  </div>
                  <Progress 
                    value={Math.min(100, progress.percentage.carbs)} 
                    className="h-2"
                  />
                  <div className="text-center">
                    <div className="text-lg font-bold text-yellow-600">
                      {progress.consumed.carbs}g
                    </div>
                    <div className="text-xs text-gray-500">/ {progress.target.carbs}g</div>
                  </div>
                </div>

                {/* Fat */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Fat</span>
                    <span className="text-xs text-gray-500">{progress.percentage.fat}%</span>
                  </div>
                  <Progress 
                    value={Math.min(100, progress.percentage.fat)} 
                    className="h-2"
                  />
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      {progress.consumed.fat}g
                    </div>
                    <div className="text-xs text-gray-500">/ {progress.target.fat}g</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
      ) : (
        /* No TDEE Set - Prompt User */
        <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Set Your Daily Goals</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Calculate your TDEE to track your daily nutrition progress
                  </p>
                </div>
                <Button
                  onClick={() => setLocation("/profile")}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Calculate TDEE
                </Button>
              </div>
            </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Utensils className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Meals</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {mealsLoading ? "..." : meals.length}
                  </p>
                </div>
              </div>
            </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Workouts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {workoutsLoading ? "..." : workouts.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Flame className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Calories</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summaryLoading ? "..." : (progress?.consumed.calories ?? Math.round(todaySummary?.totalCalories || 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Goal</p>
                <p className="text-2xl font-bold text-gray-900">
                  {progress?.percentage.calories || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Add Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Add Meal</h3>
          <MealForm />
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">💪 Add Workout</h2>
            <button
              onClick={() => {
                resetWorkoutForm();
                setShowWorkoutForm(!showWorkoutForm);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-medium"
            >
              <Plus size={20} />
              {showWorkoutForm ? 'Cancel' : 'Add Workout'}
            </button>
          </div>

          {showWorkoutForm && (
            <form onSubmit={handleSubmitWorkout} className="mb-6 p-4 bg-green-50 rounded-lg space-y-4">
              {/* Strength Training Section */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  🏋️ Strength Training
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Exercise Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Bench Press, Squat..."
                      value={exerciseName}
                      onChange={(e) => setExerciseName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Strength Training Details - Dynamic Rows */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-600">
                      Training Details
                    </label>
                    <button
                      type="button"
                      onClick={addTrainingSet}
                      className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm flex items-center gap-1"
                    >
                      <Plus size={16} />
                      Add Set
                    </button>
                  </div>
                  <div className="space-y-3">
                    {trainingSets.map((set, index) => (
                      <div key={set.id} className="flex gap-2 items-end">
                        <div className="flex-1 grid grid-cols-4 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Sets
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              placeholder="3"
                              value={set.sets}
                              onChange={(e) =>
                                updateTrainingSet(set.id, 'sets', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Reps
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              placeholder="10"
                              value={set.reps}
                              onChange={(e) =>
                                updateTrainingSet(set.id, 'reps', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Weight
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="999"
                              placeholder="60"
                              value={set.weight}
                              onChange={(e) =>
                                updateTrainingSet(set.id, 'weight', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Unit
                            </label>
                            <select
                              value={weightUnit}
                              onChange={(e) => setWeightUnit(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                            >
                              <option value="kg">kg</option>
                              <option value="lbs">lbs</option>
                            </select>
                          </div>
                        </div>
                        {/* Remove button - 當行數 > 1 時顯示 */}
                        {trainingSets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTrainingSet(set.id)}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm flex items-center gap-1 h-fit"
                          >
                            <Minus size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <hr className="my-4" />

              {/* Cardio Section */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  🏃 Cardio
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <select
                      value={cardioType}
                      onChange={(e) => {
                        setCardioType(e.target.value);
                        if (e.target.value !== 'Other') {
                          setCardioCustomType('');  // 清除自定義欄位
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Select cardio type</option>
                      <option value="Running">Running</option>
                      <option value="Cycling">Cycling</option>
                      <option value="Swimming">Swimming</option>
                      <option value="Rowing">Rowing</option>
                      <option value="Jumping Rope">Jumping Rope</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      placeholder="30"
                      value={cardioDuration}
                      onChange={(e) => setCardioDuration(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Custom Cardio Type Input - 只在選擇 "Other" 時顯示 */}
                {cardioType === 'Other' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Type
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Mountain Biking, Stair Climbing..."
                      value={cardioCustomType}
                      onChange={(e) => setCardioCustomType(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  placeholder="How did it feel? Any achievements?"
                  value={workoutNotes}
                  onChange={(e) => setWorkoutNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={2}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-medium"
                >
                  {editingWorkoutId ? 'Update Workout' : 'Log Workout'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowWorkoutForm(false);
                    resetWorkoutForm();
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!showWorkoutForm && (
            <p className="text-sm text-muted-foreground">Click "Add Workout" to start logging</p>
          )}
        </Card>
      </div>

      {/* Today's Meals */}
      <div className="mb-8">
        <TodaysMeals />
      </div>

      {/* Personal Bests */}
      {personalBests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={24} />
            個人最佳紀錄
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {personalBests.map((best, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4 shadow-md"
              >
                <h3 className="font-semibold text-gray-800 mb-2">
                  {best.exercise_name}
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-700">
                    <span className="font-semibold text-lg text-red-600">
                      {best.max_weight}
                    </span>
                    <span className="text-gray-600 ml-2">{best.weight_unit}</span>
                  </p>
                  <p className="text-gray-600">
                    已執行: <span className="font-semibold">{best.times_performed || 0}</span> 次
                  </p>
                  {best.max_sets && (
                    <p className="text-gray-600">
                      最多: <span className="font-semibold">{best.max_sets}</span> 組 ×{' '}
                      <span className="font-semibold">{best.max_reps}</span> 次
                    </p>
                  )}
                  <p className="text-gray-500 text-xs">
                    最後: {formatWorkoutDate(best.last_performed)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          {/* Today's Workouts Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Today's Workouts</h3>
            {workoutsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
              </div>
            ) : workouts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">💪</div>
                <p className="text-gray-500 font-medium">No workouts logged today</p>
                <p className="text-gray-400 text-sm mt-1">Use the form above to log your first workout</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workouts.map((workout) => {
                  // Workout schema 中沒有 exercises 字段，只使用 workoutType 和 durationMinutes
                  const workoutType = workout.workoutType || '';
                  const duration = workout.durationMinutes || 0;
                  
                  // 定義變量以避免未定義錯誤
                  const exerciseName = '';
                  const allExercises: any[] = [];
                  const sets = undefined;
                  const reps = undefined;
                  const weight = undefined;
                  const weightUnit = 'kg';

                  // 檢查是否為力量訓練或 Cardio
                  const isStrength = workoutType === 'STRENGTH' || workoutType === 'Strength Training';
                  const isCardio = workoutType === 'CARDIO' || workoutType === 'Cardio';

                  return (
                    <div
                      key={workout.id}
                      className="bg-gray-50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">
                          {exerciseName || workoutType}
                        </h4>
                        <div className="mt-2 space-y-2">
                          {/* 顯示摘要 */}
                          {isStrength && (
                            <div className="text-sm text-gray-600 mt-2 flex gap-3">
                              {sets && <span>📊 {sets} sets</span>}
                              {reps && <span>🔄 {reps} reps</span>}
                              {weight && <span>⚖️ {weight} {weightUnit}</span>}
                            </div>
                          )}

                          {/* 顯示詳細訓練組（如果有多個） */}
                          {allExercises.length > 0 && (
                            <div className="mt-3 text-xs bg-white p-2 rounded border-l-2 border-blue-400">
                              <div className="font-semibold text-gray-700 mb-1">Training Sets:</div>
                              {allExercises.map((ex, idx) => (
                                <div key={idx} className="text-gray-600">
                                  Set {idx + 1}: {ex.sets || 0}×{ex.reps || 0} @ {ex.weight || 0}{ex.weightUnit || 'kg'}
                                </div>
                              ))}
                            </div>
                          )}

                          {isCardio && (
                            <div className="text-sm text-gray-600 mt-2 flex gap-3">
                              <span>🏃 {exerciseName}</span>
                              {duration && <span>⏱️ {duration} min</span>}
                            </div>
                          )}

                          {workout.notes && (
                            <p className="text-sm text-gray-500 mt-2">💭 {workout.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditWorkout(workout)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                        >
                          <Edit2 size={14} className="inline mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteWorkout(workout.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
                        >
                          <Trash2 size={14} className="inline mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Weekly Charts */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-6">7-Day Trends</h3>
        <WeeklyChart />
      </Card>
    </div>
  );
}

function MetricCard({ icon, label, value, unit, testId }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  unit: string;
  testId: string;
}) {
  return (
    <Card className="p-6 space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="text-primary">{icon}</div>
      </div>
      <div className="space-y-1">
        <div className="text-3xl font-bold font-mono" data-testid={`${testId}-value`}>{value}</div>
        <div className="text-sm text-muted-foreground">{unit}</div>
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </main>
    </div>
  );
}

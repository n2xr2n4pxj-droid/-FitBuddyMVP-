/**
 * @deprecated 此文件已不再使用
 * 訓練功能已集成到 Dashboard 主頁中 (client/src/pages/dashboard.tsx)
 * 此文件保留僅供參考，不會被導入或使用
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, TrendingUp } from 'lucide-react';

interface Workout {
  id: number | string;
  workout_type: string;
  exercise_name?: string | null;
  duration: number;
  calories?: number;
  calories_burned?: number;
  sets?: number | null;
  reps?: number | null;
  weight?: number | null;
  weight_unit?: string;
  notes?: string | null;
  performed_at: string;
  created_at?: string;
  exercises?: any; // JSON 欄位
}

interface PersonalBest {
  exercise_name: string;
  max_weight: number;
  weight_unit: string;
  times_performed: number;
  max_sets: number;
  max_reps: number;
  last_performed: string;
}

export function WorkoutPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [workoutType, setWorkoutType] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [duration, setDuration] = useState(30);
  const [calories, setCalories] = useState(0);
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [notes, setNotes] = useState('');
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadWorkouts();
    loadPersonalBests();
  }, []);

  const loadWorkouts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/workouts', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch workouts');
      const data = await response.json();
      setWorkouts(data);
    } catch (error) {
      console.error('Error loading workouts:', error);
      alert('Failed to load workouts');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPersonalBests = async () => {
    try {
      const response = await fetch('/api/workouts/stats/personal-best', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch personal bests');
      const data = await response.json();
      setPersonalBests(data);
    } catch (error) {
      console.error('Error loading personal bests:', error);
    }
  };

  const resetForm = () => {
    setWorkoutType('');
    setExerciseName('');
    setDuration(30);
    setCalories(0);
    setSets('');
    setReps('');
    setWeight('');
    setWeightUnit('kg');
    setNotes('');
    setPerformedAt(new Date().toISOString().split('T')[0]);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workoutType || !duration) {
      alert('Please fill in workout type and duration');
      return;
    }

    setIsLoading(true);

    try {
      const url = editingId ? `/api/workouts/${editingId}` : '/api/workouts';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workoutType,
          exerciseName: exerciseName || null,
          duration: parseInt(duration.toString()),
          calories: parseInt(calories.toString()) || 0,
          sets: sets ? parseInt(sets) : null,
          reps: reps ? parseInt(reps) : null,
          weight: weight ? parseFloat(weight) : null,
          weightUnit: weight ? weightUnit : 'kg',
          notes: notes || null,
          performedAt: `${performedAt}T00:00:00Z`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save workout');
      }

      await loadWorkouts();
      await loadPersonalBests();

      resetForm();
      setShowForm(false);

      alert(editingId ? 'Workout updated successfully' : 'Workout logged successfully');
    } catch (error) {
      console.error('Error saving workout:', error);
      alert('Failed to save workout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this workout?')) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/workouts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete workout');

      await loadWorkouts();
      await loadPersonalBests();

      alert('Workout deleted successfully');
    } catch (error) {
      console.error('Error deleting workout:', error);
      alert('Failed to delete workout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (workout: Workout) => {
    // 處理 exercises JSON（如果存在）
    let exerciseData = null;
    if (workout.exercises) {
      try {
        const exercises = typeof workout.exercises === 'string' 
          ? JSON.parse(workout.exercises) 
          : workout.exercises;
        if (Array.isArray(exercises) && exercises.length > 0) {
          exerciseData = exercises[0];
        }
      } catch (e) {
        console.error('Error parsing exercises:', e);
      }
    }

    setWorkoutType(workout.workout_type);
    setExerciseName(exerciseData?.exerciseName || workout.exercise_name || '');
    setDuration(workout.duration);
    setCalories(workout.calories || 0);
    setSets(exerciseData?.sets?.toString() || workout.sets?.toString() || '');
    setReps(exerciseData?.reps?.toString() || workout.reps?.toString() || '');
    setWeight(exerciseData?.weight?.toString() || workout.weight?.toString() || '');
    setWeightUnit(exerciseData?.weightUnit || workout.weight_unit || 'kg');
    setNotes(workout.notes || '');
    setPerformedAt(new Date(workout.performed_at).toISOString().split('T')[0]);
    setEditingId(typeof workout.id === 'number' ? workout.id : parseInt(workout.id, 10) || null);
    setShowForm(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4 sm:p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-3xl font-bold text-gray-800">💪 訓練課表</h1>
        </div>
        <p className="text-gray-600">記錄和追蹤你的訓練進度</p>
      </div>

      <div className="mb-6">
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all shadow-md"
        >
          <Plus size={20} />
          {showForm ? '取消' : '添加新訓練'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? '編輯訓練' : '添加新訓練'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  運動類型 *
                </label>
                <select
                  value={workoutType}
                  onChange={(e) => setWorkoutType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="">選擇運動類型</option>
                  <option value="STRENGTH">力量訓練 (Strength)</option>
                  <option value="CARDIO">有氧運動 (Cardio)</option>
                  <option value="FLEXIBILITY">柔韌性訓練 (Flexibility)</option>
                  <option value="SPORTS">運動 (Sports)</option>
                  <option value="OTHER">其他 (Other)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  具體運動名稱
                </label>
                <input
                  type="text"
                  placeholder="e.g., 臥推、硬舉、快走..."
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  訓練日期 *
                </label>
                <input
                  type="date"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  時長 (分鐘) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  卡路里消耗
                </label>
                <input
                  type="number"
                  min="0"
                  max="9999"
                  value={calories}
                  onChange={(e) => setCalories(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                訓練詳細資料 (可選)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    組數
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="3"
                    value={sets}
                    onChange={(e) => setSets(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    次數
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="10"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    重量
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="999"
                    placeholder="60"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    單位
                  </label>
                  <select
                    value={weightUnit}
                    onChange={(e) => setWeightUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  >
                    <option value="kg">公斤 (kg)</option>
                    <option value="lbs">磅 (lbs)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                備註
              </label>
              <textarea
                placeholder="e.g., 今天感覺很好，推起時沒有太多困難..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 font-medium"
              >
                {isLoading ? '保存中...' : editingId ? '更新訓練' : '記錄訓練'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

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
                    最後: {formatDate(best.last_performed)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">最近訓練</h2>

        {isLoading && !workouts.length ? (
          <div className="text-center py-8 text-gray-500">
            <p>載入中...</p>
          </div>
        ) : workouts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>還沒有訓練記錄。現在就開始記錄吧！💪</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workouts.map((workout) => {
              // 解析 exercises JSON（如果存在）
              let exerciseData = null;
              if (workout.exercises) {
                try {
                  const exercises = typeof workout.exercises === 'string' 
                    ? JSON.parse(workout.exercises) 
                    : workout.exercises;
                  if (Array.isArray(exercises) && exercises.length > 0) {
                    exerciseData = exercises[0];
                  }
                } catch (e) {
                  console.error('Error parsing exercises:', e);
                }
              }

              const displayName = exerciseData?.exerciseName || workout.exercise_name || workout.workout_type;
              const displaySets = exerciseData?.sets || workout.sets;
              const displayReps = exerciseData?.reps || workout.reps;
              const displayWeight = exerciseData?.weight || workout.weight;
              const displayWeightUnit = exerciseData?.weightUnit || workout.weight_unit || 'kg';

              return (
                <div
                  key={workout.id}
                  className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">
                          {workout.workout_type === 'STRENGTH' && '🏋️'}
                          {workout.workout_type === 'CARDIO' && '🏃'}
                          {workout.workout_type === 'FLEXIBILITY' && '🧘'}
                          {workout.workout_type === 'SPORTS' && '⚽'}
                          {!['STRENGTH', 'CARDIO', 'FLEXIBILITY', 'SPORTS'].includes(
                            workout.workout_type
                          ) && '💪'}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-800">
                            {displayName}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {formatDate(workout.performed_at)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        <div className="bg-blue-50 rounded-lg p-2">
                          <p className="text-xs text-gray-600">時長</p>
                          <p className="font-semibold text-blue-600">
                            {workout.duration}
                            <span className="text-xs">分鐘</span>
                          </p>
                        </div>

                        {workout.calories && workout.calories > 0 && (
                          <div className="bg-red-50 rounded-lg p-2">
                            <p className="text-xs text-gray-600">卡路里</p>
                            <p className="font-semibold text-red-600">
                              {workout.calories}
                              <span className="text-xs">kcal</span>
                            </p>
                          </div>
                        )}

                        {displaySets && (
                          <div className="bg-purple-50 rounded-lg p-2">
                            <p className="text-xs text-gray-600">組數</p>
                            <p className="font-semibold text-purple-600">
                              {displaySets}
                              <span className="text-xs">組</span>
                            </p>
                          </div>
                        )}

                        {displayWeight && (
                          <div className="bg-orange-50 rounded-lg p-2">
                            <p className="text-xs text-gray-600">重量</p>
                            <p className="font-semibold text-orange-600">
                              {displayWeight}
                              <span className="text-xs">{displayWeightUnit}</span>
                            </p>
                          </div>
                        )}
                      </div>

                      {workout.notes && (
                        <p className="text-sm text-gray-700 mt-2 italic bg-gray-50 p-2 rounded">
                          「{workout.notes}」
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 sm:flex-col">
                      <button
                        onClick={() => handleEdit(workout)}
                        className="flex-1 sm:flex-none px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit2 size={16} />
                        <span className="hidden sm:inline">編輯</span>
                      </button>
                      <button
                        onClick={() => handleDelete(typeof workout.id === 'number' ? workout.id : parseInt(String(workout.id), 10))}
                        className="flex-1 sm:flex-none px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 size={16} />
                        <span className="hidden sm:inline">刪除</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkoutPage;

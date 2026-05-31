import React, { useState, useEffect } from 'react';
import {
  Dumbbell,
  Utensils,
  Users,
  LayoutDashboard,
  UserCircle,
  Plus,
  Search,
  Camera,
  ChevronRight,
  MoreHorizontal,
  Timer,
  Check,
  X,
  Sparkles,
  Send,
  AlertTriangle,
  SwitchCamera,
  CalendarDays,
  Flame,
  Calendar,
  Info,
  Target,
  Mic,
  QrCode,
  MessageCircle,
  ThumbsUp,
} from 'lucide-react';

import type { ViewMode, ExerciseDef, RoutineSet, RoutineExercise, WorkoutRoutine } from '@/features/workouts/types';
import { MOCK_LIBRARY } from '@/features/workouts/mockData';
import { requestAiGeneratedRoutine, requestAiWorkoutSummary } from '@/features/workouts/aiHelpers';
import { useUpcomingRoutine } from '@/features/workouts/useUpcomingRoutine';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

// ---------------------------------------------------------------------------
// 營養／日曆／目標 UI（型別 + TODO：未來接後端）
// ---------------------------------------------------------------------------

interface NutritionRingProps {
  eaten: number;
  target: number;
  burned: number;
}

const NutritionRing: React.FC<NutritionRingProps> = ({ eaten, target, burned }) => {
  const net = eaten - burned;
  const remaining = target - net;
  const percentage = Math.min(100, Math.max(0, (net / target) * 100));
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-white p-5 rounded-[20px] shadow-sm border border-gray-100 flex items-center justify-between">
      <div className="flex-1 pr-4 space-y-2">
        <div className="flex justify-between text-xs"><span className="text-gray-500">攝取</span><span className="font-bold">{eaten}</span></div>
        <div className="flex justify-between text-xs"><span className="text-gray-500">消耗</span><span className="font-bold">{burned}</span></div>
      </div>
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="50%" cy="50%" r={radius} stroke="#f3f4f6" strokeWidth="8" fill="transparent" />
          <circle
            cx="50%" cy="50%" r={radius} stroke="#10b981" strokeWidth="8" fill="transparent"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-gray-800 tracking-tighter">{remaining}</span>
          <span className="text-[8px] text-gray-400">剩餘</span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 教練端：課表編輯器（接後端 AI generate-routine）
// ---------------------------------------------------------------------------

interface CoachRoutineBuilderProps {
  onClose: () => void;
  clientName: string;
  clientId?: string;
}

const CoachRoutineBuilder: React.FC<CoachRoutineBuilderProps> = ({ onClose, clientName, clientId }) => {
  const { toast } = useToast();
  const [routine, setRoutine] = useState<WorkoutRoutine>({
    id: Date.now().toString(),
    name: 'New Routine',
    notes: '',
    scheduledDate: '',
    isCompleted: false,
    clientId,
    clientName,
    exercises: [],
  });
  const [showLibrary, setShowLibrary] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const aiRoutine = await requestAiGeneratedRoutine({
        prompt: aiPrompt.trim(),
        clientId: routine.clientId,
        baseRoutine: routine,
      });
      setRoutine(aiRoutine);
      setAiPrompt('');
    } catch (e) {
      console.error('[CoachRoutineBuilder] AI generate error:', e);
      toast({
        variant: 'destructive',
        title: '智能排表失敗',
        description: e instanceof Error ? e.message : '請稍後再試。',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const addExercise = (def: ExerciseDef) => {
    const newEx: RoutineExercise = {
      id: Date.now().toString(),
      exerciseId: def.id,
      exerciseName: def.name,
      order: routine.exercises.length + 1,
      restTimerSeconds: 90,
      sets: [{
        id: Date.now().toString(),
        setIndex: 1,
        setType: 'normal',
        targetWeight: null,
        targetReps: null,
        targetRpe: null,
        actualWeight: null,
        actualReps: null,
        isCompleted: false,
      }],
    };
    setRoutine(prev => ({ ...prev, exercises: [...prev.exercises, newEx] }));
    setShowLibrary(false);
  };

  const addSet = (exId: string) => {
    setRoutine(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex => {
        if (ex.id !== exId) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet: RoutineSet = {
          id: Date.now().toString(),
          setIndex: ex.sets.length + 1,
          setType: 'normal',
          targetWeight: lastSet?.targetWeight ?? null,
          targetReps: lastSet?.targetReps ?? null,
          targetRpe: lastSet?.targetRpe ?? null,
          actualWeight: null,
          actualReps: null,
          isCompleted: false,
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      }),
    }));
  };

  const updateSetTarget = (exId: string, setId: string, field: 'targetWeight' | 'targetReps' | 'targetRpe', val: string) => {
    const num = val === '' ? null : (Number(val) || null);
    setRoutine(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex =>
        ex.id === exId
          ? { ...ex, sets: ex.sets.map(s => (s.id === setId ? { ...s, [field]: num } : s)) }
          : ex
      ),
    }));
  };

  const removeExercise = (exId: string) => {
    setRoutine(prev => ({ ...prev, exercises: prev.exercises.filter(e => e.id !== exId) }));
  };

  return (
    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0f172a] z-50 flex flex-col animate-in slide-in-from-bottom shadow-2xl text-slate-200">
      <div className="bg-[#1e293b] px-4 py-3 flex justify-between items-center shadow-md border-b border-slate-800">
        <button onClick={onClose}><X className="w-6 h-6 text-slate-400" /></button>
        <h2 className="font-bold text-white">分配給 {clientName}</h2>
        <button className="text-blue-400 font-bold text-sm" onClick={() => { toast({ title: '已發送', description: '課表已發送給學員。' }); onClose(); }}>發送</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 p-4 rounded-[20px] border border-blue-800/50 shadow-sm backdrop-blur-md">
          <div className="flex items-center space-x-2 mb-3 text-blue-300">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm">✨ AI 智能排表助手</h3>
          </div>
          <div className="flex space-x-2">
            <input
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              className="flex-1 bg-[#0f172a] p-2.5 rounded-lg text-sm border border-slate-700 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500 text-slate-200"
              placeholder="例：針對新手的45分鐘推胸訓練..."
            />
            <button
              onClick={handleAIGenerate}
              disabled={isGenerating || !aiPrompt.trim()}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center disabled:opacity-50 min-w-[80px] shadow-sm"
            >
              {isGenerating ? <Timer className="w-5 h-5 animate-spin" /> : '生成'}
            </button>
          </div>
        </div>

        <div className="bg-[#1e293b] p-4 rounded-[20px] shadow-sm border border-slate-800 space-y-3">
          <input
            className="w-full text-xl font-black outline-none placeholder-slate-600 bg-transparent text-white"
            placeholder="課表名稱 (例: Push Day)"
            value={routine.name}
            onChange={e => setRoutine(prev => ({ ...prev, name: e.target.value }))}
          />
          <div className="flex space-x-2">
            <input
              className="flex-1 bg-[#0f172a] text-slate-300 p-2 rounded text-sm outline-none border border-slate-800"
              type="date"
              value={routine.scheduledDate && routine.scheduledDate !== '今天' ? routine.scheduledDate : ''}
              onChange={e => setRoutine(prev => ({ ...prev, scheduledDate: e.target.value || '' }))}
            />
            <input
              className="flex-1 bg-[#0f172a] text-slate-300 p-2 rounded text-sm outline-none border border-slate-800"
              placeholder="給學員的備註..."
              value={routine.notes}
              onChange={e => setRoutine(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </div>

        {routine.exercises.map((ex, exIdx) => (
          <div key={ex.id} className="bg-[#1e293b] rounded-[20px] shadow-sm border border-slate-800 overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]/50">
              <h3 className="font-bold text-blue-400 flex items-center">
                <span className="w-6 h-6 bg-blue-900/50 rounded text-xs flex items-center justify-center mr-2">{exIdx + 1}</span>
                {ex.exerciseName}
              </h3>
              <button onClick={() => removeExercise(ex.id)}><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-2">
              <div className="grid grid-cols-12 gap-1 mb-1 px-1 text-[10px] font-bold text-slate-500 text-center">
                <div className="col-span-2">Set</div>
                <div className="col-span-3">Target KG</div>
                <div className="col-span-3">Target Reps</div>
                <div className="col-span-4">RPE</div>
              </div>
              {ex.sets.map((set, sIdx) => (
                <div key={set.id} className="grid grid-cols-12 gap-1 items-center py-1">
                  <div className="col-span-2 text-center text-xs font-bold text-slate-500">{sIdx + 1}</div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      placeholder="kg"
                      value={set.targetWeight ?? ''}
                      onChange={e => updateSetTarget(ex.id, set.id, 'targetWeight', e.target.value)}
                      className="w-full bg-[#0f172a] border border-slate-700 rounded text-center text-xs py-1.5 outline-none focus:ring-1 focus:ring-blue-500 text-white font-bold"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      placeholder="reps"
                      value={set.targetReps ?? ''}
                      onChange={e => updateSetTarget(ex.id, set.id, 'targetReps', e.target.value)}
                      className="w-full bg-[#0f172a] border border-slate-700 rounded text-center text-xs py-1.5 outline-none focus:ring-1 focus:ring-blue-500 text-white font-bold"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      type="number"
                      placeholder="8"
                      value={set.targetRpe ?? ''}
                      onChange={e => updateSetTarget(ex.id, set.id, 'targetRpe', e.target.value)}
                      className="w-full bg-[#0f172a] border border-slate-700 rounded text-center text-xs py-1.5 outline-none text-white"
                    />
                  </div>
                </div>
              ))}
              <button onClick={() => addSet(ex.id)} className="w-full mt-2 py-1.5 text-[10px] font-bold text-slate-400 bg-[#0f172a] rounded uppercase tracking-wide hover:bg-slate-800 transition-colors">
                + Add Set
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={() => setShowLibrary(true)}
          className="w-full py-4 rounded-[20px] border-2 border-dashed border-blue-800/50 text-blue-400 font-bold flex items-center justify-center space-x-2 bg-blue-900/10 hover:bg-blue-900/20 transition-all"
        >
          <Plus className="w-5 h-5" /><span>從動作庫新增動作</span>
        </button>
      </div>

      {showLibrary && (
        <div className="absolute inset-0 bg-[#0f172a] z-20 flex flex-col">
          <div className="px-4 py-3 flex items-center border-b border-slate-800 shadow-sm bg-[#1e293b]">
            <button onClick={() => setShowLibrary(false)}><X className="w-6 h-6 text-slate-400 mr-2" /></button>
            <input autoFocus placeholder="搜尋動作..." className="flex-1 outline-none font-medium bg-transparent text-white" />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800 p-2">
            {MOCK_LIBRARY.map(def => (
              <div key={def.id} onClick={() => addExercise(def)} className="p-4 flex justify-between items-center active:bg-slate-800 cursor-pointer rounded-lg">
                <div>
                  <p className="font-bold text-slate-200">{def.name}</p>
                  <p className="text-xs text-slate-500">{def.muscleGroup}</p>
                </div>
                <Plus className="w-5 h-5 text-blue-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 學員端：打卡器（接後端 AI workout-summary）
// ---------------------------------------------------------------------------

interface ClientWorkoutLoggerProps {
  routine: WorkoutRoutine;
  onClose: () => void;
}

const ClientWorkoutLogger: React.FC<ClientWorkoutLoggerProps> = ({ routine, onClose }) => {
  const { toast } = useToast();
  const [activeRoutine, setActiveRoutine] = useState<WorkoutRoutine>(routine);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const toggleSetComplete = (exId: string, setId: string) => {
    setActiveRoutine(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map(s => {
            if (s.id !== setId) return s;
            const willBeCompleted = !s.isCompleted;
            const autoKg = willBeCompleted && (s.actualWeight == null) ? s.targetWeight : s.actualWeight;
            const autoReps = willBeCompleted && (s.actualReps == null) ? s.targetReps : s.actualReps;
            return { ...s, isCompleted: willBeCompleted, actualWeight: autoKg, actualReps: autoReps };
          }),
        };
      }),
    }));
  };

  const updateActual = (exId: string, setId: string, field: 'actualWeight' | 'actualReps', val: string) => {
    const num = val === '' ? null : (Number(val) || null);
    setActiveRoutine(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex =>
        ex.id === exId ? { ...ex, sets: ex.sets.map(s => (s.id === setId ? { ...s, [field]: num } : s)) } : ex
      ),
    }));
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      const summary = await requestAiWorkoutSummary(activeRoutine);
      if (summary) setAiInsight(summary);
      else {
        toast({ title: '打卡成功', description: '已同步給教練。' });
        onClose();
      }
    } catch (e) {
      console.error('[ClientWorkoutLogger] AI summary error:', e);
      toast({
        variant: 'destructive',
        title: '無法取得 AI 總結',
        description: e instanceof Error ? e.message : '請稍後再試。',
      });
      toast({ title: '打卡成功', description: '已同步給教練。' });
      onClose();
    } finally {
      setIsFinishing(false);
    }
  };

  const fmt = (n: number | null) => (n != null ? String(n) : '-');

  return (
    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-gray-50 z-50 flex flex-col animate-in slide-in-from-bottom shadow-2xl">
      {aiInsight && (
        <div className="absolute inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-2 ring-4 ring-blue-50/50">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-xl text-gray-800 tracking-tight">✨ 訓練完成！</h3>
            <p className="text-gray-600 text-[15px] leading-relaxed py-2">{aiInsight}</p>
            <button
              onClick={() => { setAiInsight(null); onClose(); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold mt-2 shadow-lg shadow-blue-200 transition-all active:scale-95 text-sm"
            >
              確認並關閉
            </button>
          </div>
        </div>
      )}

      <div className="bg-white/95 backdrop-blur-md px-4 py-3 flex justify-between items-center shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-500"><ChevronRight className="w-6 h-6 rotate-180" /></button>
        <div className="text-center">
          <h2 className="font-bold text-gray-900">{activeRoutine.name}</h2>
          <p className="text-xs text-gray-500 font-mono">00:14:32</p>
        </div>
        <button
          disabled={isFinishing}
          className="text-white font-bold text-sm px-4 py-1.5 bg-blue-600 rounded-lg shadow-sm disabled:opacity-70 flex items-center min-w-[70px] justify-center"
          onClick={handleFinish}
        >
          {isFinishing ? <Timer className="w-4 h-4 animate-spin" /> : 'Finish'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {activeRoutine.notes && (
          <div className="bg-blue-50/50 border border-blue-100/50 p-3 rounded-xl flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed"><span className="font-bold">教練備註：</span>{activeRoutine.notes}</p>
          </div>
        )}

        {activeRoutine.exercises.map((ex, exIdx) => (
          <div key={ex.id} className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b border-gray-50 flex items-center space-x-3 bg-gray-50/50">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">{exIdx + 1}</div>
              <h3 className="font-bold text-gray-800">{ex.exerciseName}</h3>
            </div>
            <div className="p-2">
              <div className="grid grid-cols-10 gap-2 mb-2 px-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide text-center">
                <div className="col-span-1">Set</div>
                <div className="col-span-3 text-blue-400">Target</div>
                <div className="col-span-2 text-gray-700">KG</div>
                <div className="col-span-2 text-gray-700">Reps</div>
                <div className="col-span-2"><Check className="w-3 h-3 mx-auto" /></div>
              </div>
              {ex.sets.map((set, sIdx) => (
                <div key={set.id} className={`grid grid-cols-10 gap-2 items-center py-1.5 rounded ${set.isCompleted ? 'bg-green-50/60' : ''}`}>
                  <div className="col-span-1 text-center font-bold text-gray-400 text-xs">{sIdx + 1}</div>
                  <div className="col-span-3 text-center text-[10px] font-medium text-blue-500 bg-blue-50 rounded py-1">
                    {fmt(set.targetWeight)}kg x {fmt(set.targetReps)}
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={set.actualWeight ?? ''}
                      onChange={e => updateActual(ex.id, set.id, 'actualWeight', e.target.value)}
                      className={`w-full rounded text-center text-sm font-bold py-1 outline-none focus:ring-2 focus:ring-blue-500 ${set.isCompleted ? 'bg-transparent text-green-800' : 'bg-gray-100 text-gray-800'}`}
                      placeholder={fmt(set.targetWeight)}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={set.actualReps ?? ''}
                      onChange={e => updateActual(ex.id, set.id, 'actualReps', e.target.value)}
                      className={`w-full rounded text-center text-sm font-bold py-1 outline-none focus:ring-2 focus:ring-blue-500 ${set.isCompleted ? 'bg-transparent text-green-800' : 'bg-gray-100 text-gray-800'}`}
                      placeholder={fmt(set.targetReps)}
                    />
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <button
                      onClick={() => toggleSetComplete(ex.id, set.id)}
                      className={`w-8 h-8 rounded transition-colors flex items-center justify-center ${set.isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400 hover:bg-gray-300'}`}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 學員端：飲食紀錄（型別 + TODO：未來接後端營養／食物 AI）
// ---------------------------------------------------------------------------

interface ClientMealLoggerProps {
  onClose: () => void;
}

const ClientMealLogger: React.FC<ClientMealLoggerProps> = ({ onClose }) => {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAISearch = async () => {
    if (!searchInput.trim()) return;
    setIsAnalyzing(true);
    try {
      // TODO: 改為呼叫後端 endpoint（例如 POST /api/ai/food-analyze），由後端使用 Gemini 解析食物名稱並回傳營養估算，前端不再直接組 prompt。
      await new Promise(r => setTimeout(r, 1000));
      console.log('[ClientMealLogger] AI 食物解析 (stub):', searchInput);
      toast({
        title: 'AI 識別 (展示)',
        description: `已識別: ${searchInput}。卡路里估算: 450 kcal。未來將由後端 API 回傳真實營養數據。`,
      });
      onClose();
    } catch (e) {
      toast({ variant: 'destructive', title: '解析失敗', description: '請稍後再試。' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white z-50 flex flex-col animate-in slide-in-from-bottom shadow-2xl">
      <div className="bg-emerald-500 px-4 py-3 flex items-center justify-between shadow-sm text-white sticky top-0">
        <button onClick={onClose}><ChevronRight className="w-6 h-6 rotate-180" /></button>
        <h2 className="font-bold text-lg">新增食物</h2>
        <button><Camera className="w-6 h-6" /></button>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="relative mb-6">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
          <input
            autoFocus
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full bg-gray-100 rounded-xl py-3 pl-10 pr-12 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            placeholder="搜尋食物或輸入「菠蘿油」AI 識別"
          />
          <button
            onClick={handleAISearch}
            className="absolute right-2 top-2 p-1.5 bg-emerald-100 rounded-lg text-emerald-600 hover:bg-emerald-200 transition-colors"
          >
            {isAnalyzing ? <Timer className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          </button>
        </div>
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">最近記錄</h3>
            <div className="divide-y divide-gray-50 border-t border-b border-gray-50">
              {[
                { name: '譚仔雲南米線 (清湯)', portion: '1 碗', cals: 680 },
                { name: '雞胸肉 (去皮)', portion: '100 克', cals: 165 },
                { name: '烚蛋', portion: '1 隻 (大)', cals: 78 },
              ].map((item, i) => (
                <div key={i} className="py-3 flex justify-between items-center active:bg-gray-50 cursor-pointer">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.portion}</p>
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold text-emerald-600 text-sm mr-3">{item.cals}</span>
                    <Plus className="w-5 h-5 text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 全螢幕日曆 Modal（型別 + TODO：未來接每日營養 API）
// ---------------------------------------------------------------------------

interface FullCalendarModalProps {
  onClose: () => void;
}

const FullCalendarModal: React.FC<FullCalendarModalProps> = ({ onClose }) => {
  // TODO: 每日營養數據改為從後端取得，例如 GET /api/nutrition/day?date=... 或 GET /api/meals/summary?from=...&to=...
  return (
    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0f172a] z-[60] flex flex-col animate-in slide-in-from-bottom duration-200 text-white shadow-2xl">
      <div className="px-4 py-4 flex justify-between items-center bg-[#0f172a] sticky top-0">
        <div className="w-8"></div>
        <h2 className="font-bold text-lg">3月</h2>
        <button onClick={onClose}><X className="w-6 h-6 text-gray-300" /></button>
      </div>
      <div className="p-4 flex-1">
        <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-400 mb-6">
          <div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div><div>日</div>
        </div>
        <div className="grid grid-cols-7 gap-y-6 gap-x-2 text-center text-sm font-medium">
          <div className="text-gray-600">23</div><div className="text-gray-600">24</div><div className="text-gray-600">25</div><div className="text-gray-600">26</div><div className="text-gray-600">27</div><div className="text-gray-600">28</div><div className="text-gray-600">1</div>
          <div>2</div><div>3</div><div>4</div><div>5</div><div>6</div><div>7</div><div>8</div>
          <div>9</div><div>10</div><div>11</div><div>12</div><div>13</div><div>14</div><div>15</div>
          <div>16</div><div className="bg-emerald-500 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/50">17</div><div>18</div><div>19</div><div>20</div><div>21</div><div>22</div>
          <div>23</div><div>24</div><div>25</div><div>26</div><div>27</div><div>28</div><div>29</div>
          <div>30</div><div>31</div><div className="text-gray-600">1</div><div className="text-gray-600">2</div><div className="text-gray-600">3</div><div className="text-gray-600">4</div><div className="text-gray-600">5</div>
        </div>
        <div className="mt-8 flex justify-between px-2 text-sm text-emerald-500 font-bold cursor-pointer">
          <span>今天</span>
          <span>查看飲食總結月曆</span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 目標值設定頁（型別 + TODO：未來接 TDEE/目標 API）
// ---------------------------------------------------------------------------

interface MacroGoalsPageProps {
  onClose: () => void;
}

const MacroGoalsPage: React.FC<MacroGoalsPageProps> = ({ onClose }) => {
  const { toast } = useToast();
  const [cals, setCals] = useState(2500);
  const [carbsPct, setCarbsPct] = useState(40);
  const [proteinPct, setProteinPct] = useState(40);
  const [fatPct, setFatPct] = useState(20);

  const carbsGrams = Math.round((cals * (carbsPct / 100)) / 4);
  const proteinGrams = Math.round((cals * (proteinPct / 100)) / 4);
  const fatGrams = Math.round((cals * (fatPct / 100)) / 9);

  const handleSave = () => {
    // TODO: 呼叫後端更新目標（例如 PUT /api/user/tdee 或專用 nutrition goals endpoint）
    toast({ title: '營養目標已更新！' });
    onClose();
  };

  return (
    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#121212] z-[100] flex flex-col animate-in slide-in-from-right duration-200 text-gray-200 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-4 bg-[#1e1e1e] border-b border-gray-800 shadow-md">
        <button onClick={onClose} className="p-1 -ml-1"><ChevronRight className="w-6 h-6 rotate-180" /></button>
        <h2 className="font-bold text-lg text-white">我的目標</h2>
        <button onClick={handleSave} className="text-[15px] text-gray-200 font-medium hover:text-white transition-colors">儲存</button>
      </div>
      <div className="flex-1 overflow-y-auto pb-10">
        <div className="px-4 pt-6 pb-2"><h3 className="text-emerald-500 font-bold text-[13px] mb-3 tracking-wide">熱量目標值</h3></div>
        <div className="bg-[#1e1e1e] px-4 py-3 border-y border-gray-800 flex justify-between items-center">
          <span className="text-white text-[17px]">卡路里</span>
          <div className="flex items-center">
            <input type="number" value={cals} onChange={e => setCals(Number(e.target.value))} className="bg-[#333333] text-white text-right w-24 px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-emerald-500" />
            <span className="ml-3 text-gray-400 text-[17px]">卡</span>
          </div>
        </div>
        <div className="px-4 py-4">
          <p className="text-[13px] text-gray-400 leading-relaxed mb-4">fatsecret以你的每日建議攝取量（RDA）來計算出能達到你的理想體重的每日卡路里攝取目標。</p>
          <div className="text-right"><button className="text-emerald-500 text-[13px] font-bold tracking-wide">計算我的RDA</button></div>
        </div>
        <div className="px-4 pt-4 pb-2"><h3 className="text-emerald-500 font-bold text-[13px] mb-3 tracking-wide">巨量營養素目標值</h3></div>
        <div className="bg-[#1e1e1e] border-y border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
            <div><div className="text-white text-[17px] tracking-wide">碳水化合物</div><div className="text-gray-400 text-sm mt-0.5">{carbsGrams}克</div></div>
            <div className="flex items-center"><input type="number" value={carbsPct} onChange={e => setCarbsPct(Number(e.target.value))} className="bg-[#333333] text-white text-right w-20 px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-emerald-500" /><span className="ml-3 text-gray-400 text-[17px]">%</span></div>
          </div>
          <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
            <div><div className="text-white text-[17px] tracking-wide">蛋白質</div><div className="text-gray-400 text-sm mt-0.5">{proteinGrams}克</div></div>
            <div className="flex items-center"><input type="number" value={proteinPct} onChange={e => setProteinPct(Number(e.target.value))} className="bg-[#333333] text-white text-right w-20 px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-emerald-500" /><span className="ml-3 text-gray-400 text-[17px]">%</span></div>
          </div>
          <div className="px-4 py-3 flex justify-between items-center">
            <div><div className="text-white text-[17px] tracking-wide">脂肪</div><div className="text-gray-400 text-sm mt-0.5">{fatGrams}克</div></div>
            <div className="flex items-center"><input type="number" value={fatPct} onChange={e => setFatPct(Number(e.target.value))} className="bg-[#333333] text-white text-right w-20 px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-emerald-500" /><span className="ml-3 text-gray-400 text-[17px]">%</span></div>
          </div>
        </div>
        <div className="px-4 py-4 text-right"><button className="text-emerald-500 text-[13px] font-bold tracking-wide">使用克數</button></div>
        <div className="px-4 pt-4 pb-2"><h3 className="text-emerald-500 font-bold text-[13px] mb-3 tracking-wide">設定每日目標值</h3></div>
        <div className="bg-[#1e1e1e] px-4 py-4 border-y border-gray-800"><p className="text-[13px] text-gray-400">為一週內的不同天建立自訂目標值。</p></div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 飲食區塊（型別）
// ---------------------------------------------------------------------------

interface MealItem {
  name: string;
  portion: string;
  cals: number;
}

interface MealSectionProps {
  title: string;
  items: MealItem[];
  onAdd: () => void;
}

const MealSection: React.FC<MealSectionProps> = ({ title, items, onAdd }) => {
  const totalCals = items.reduce((sum, item) => sum + item.cals, 0);
  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
        <h3 className="font-bold text-gray-800 text-sm tracking-wide">{title}</h3>
        <span className="text-xs font-bold text-gray-500">{totalCals} kcal</span>
      </div>
      <div className="divide-y divide-gray-50">
        {items.map((item, idx) => (
          <div key={idx} className="p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-gray-900 text-sm">{item.name}</p>
              <p className="text-xs text-gray-400">{item.portion}</p>
            </div>
            <span className="font-bold text-gray-700 text-sm">{item.cals} <span className="text-[10px] text-gray-400 font-normal">kcal</span></span>
          </div>
        ))}
      </div>
      <button onClick={onAdd} className="w-full text-left px-4 py-3 text-emerald-600 font-bold text-sm hover:bg-emerald-50 transition-colors flex items-center">
        <Plus className="w-4 h-4 mr-1" /> 新增食物
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// App Shell
// ---------------------------------------------------------------------------

const EMPTY_ROUTINE_FOR_FREE_WORKOUT: WorkoutRoutine = {
  id: 'free-workout',
  name: '自由訓練',
  notes: '',
  scheduledDate: '',
  isCompleted: false,
  exercises: [],
};

export default function FitBuddyPro() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [role, setRole] = useState<ViewMode>('CLIENT');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedFoodDayIndex, setSelectedFoodDayIndex] = useState(1);
  const [showClientLogger, setShowClientLogger] = useState(false);
  const [showCoachBuilder, setShowCoachBuilder] = useState(false);
  const [showMealLogger, setShowMealLogger] = useState(false);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [showGoalsPage, setShowGoalsPage] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [selectedRoutine, setSelectedRoutine] = useState<WorkoutRoutine | null>(null);

  const isCoach = role === 'COACH';
  const { routine: upcomingRoutine, isLoading: isLoadingRoutine, error: routineError } = useUpcomingRoutine({
    clientId: user?.id ?? null,
    enabled: !isCoach,
  });

  useEffect(() => {
    if (routineError) {
      toast({
        variant: 'destructive',
        title: '無法載入課表',
        description: routineError.message || '請稍後再試。',
      });
    }
  }, [routineError, toast]);

  const foodDayTitles = ['昨天', '今天', '明天', '星期四', '星期五', '星期六', '星期日'];
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  const mockDataAvailable = [true, true, false, false, false, false, false];

  const themeClass = isCoach ? 'bg-[#0f172a] text-slate-200' : 'bg-gray-50 text-gray-900';
  const headerClass = isCoach ? 'bg-[#1e293b]/90 border-slate-800' : 'bg-white/90 border-gray-100';
  const bottomNavClass = isCoach ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-gray-100';

  const openWorkoutLogger = (routine: WorkoutRoutine) => {
    setSelectedRoutine(routine);
    setShowClientLogger(true);
  };

  const ClientDashboard = () => (
    <div className="pb-24 animate-in fade-in space-y-6">
      <div className="px-4 pt-6">
        <h3 className="font-bold text-gray-800 mb-3 text-lg tracking-tight">總結數據</h3>
        <NutritionRing eaten={2302} target={2500} burned={198} />
      </div>

      <div className="px-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800 flex items-center"><CalendarDays className="w-4 h-4 mr-1 text-blue-500" /> 今日排程</h3>
        </div>
        {isLoadingRoutine ? (
          <div className="bg-gray-200 rounded-[20px] p-5 animate-pulse">
            <div className="h-5 bg-gray-300 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-300 rounded w-1/2" />
          </div>
        ) : routineError ? (
          <div className="bg-gray-100 border border-gray-200 rounded-[20px] p-5 text-center text-gray-500 text-sm">
            暫時無法載入課表
          </div>
        ) : !upcomingRoutine ? (
          <div className="bg-gray-50 border border-gray-200 rounded-[20px] p-5 text-center">
            <p className="text-gray-500 text-sm font-medium">暫時沒有教練指定課表</p>
            <p className="text-gray-400 text-xs mt-1">教練排課後會顯示在這裡</p>
          </div>
        ) : (
          <div
            onClick={() => openWorkoutLogger(upcomingRoutine)}
            className="bg-blue-600 rounded-[20px] p-5 text-white shadow-lg shadow-blue-200/50 cursor-pointer active:scale-95 transition-transform relative overflow-hidden group"
          >
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded backdrop-blur-sm mb-2 inline-block">教練指定 (Coach Assigned)</span>
                <h4 className="text-lg font-black tracking-wide">{upcomingRoutine.name}</h4>
                <p className="text-xs text-blue-100 mt-1">{upcomingRoutine.exercises.length} 個動作 • 預計 45 分鐘</p>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"><ChevronRight className="w-6 h-6 text-white" /></div>
            </div>
            <Dumbbell className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12 group-hover:scale-110 transition-transform" />
          </div>
        )}
      </div>

      <div className="px-4 grid grid-cols-2 gap-3">
        <button className="bg-white border border-gray-100 text-gray-900 p-4 rounded-[20px] shadow-sm flex flex-col justify-between h-28 hover:border-blue-200 transition-colors">
          <div className="bg-blue-50 w-10 h-10 rounded-full flex items-center justify-center"><Dumbbell className="w-5 h-5 text-blue-500" /></div>
          <div className="text-left mt-2"><p className="font-bold text-sm">自由訓練</p><p className="text-[10px] text-gray-400">Free Workout</p></div>
        </button>
        <button onClick={() => setActiveTab('food')} className="bg-white border border-gray-100 text-gray-900 p-4 rounded-[20px] shadow-sm flex flex-col justify-between h-28 hover:border-emerald-200 transition-colors">
          <div className="bg-emerald-50 w-10 h-10 rounded-full flex items-center justify-center"><Utensils className="w-5 h-5 text-emerald-500" /></div>
          <div className="text-left mt-2"><p className="font-bold text-sm">記錄飲食</p><p className="text-[10px] text-gray-400">Log Food</p></div>
        </button>
      </div>
    </div>
  );

  const CoachDashboard = () => (
    <div className="pb-24 px-4 pt-4 animate-in fade-in space-y-6">
      <div className="bg-red-500/10 border border-red-500/20 rounded-[20px] p-4">
        <div className="flex items-center space-x-2 text-red-400 mb-3">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-bold text-sm tracking-wide">需要關注 (Needs Attention)</h3>
        </div>
        <div className="space-y-3">
          <div className="bg-[#1e293b] p-3 rounded-xl shadow-sm flex items-center justify-between border border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <div>
                <p className="text-sm font-bold text-slate-200">Jason Chan</p>
                <p className="text-xs text-red-400">連續 3 組 RPE 達 10 (過度訓練)</p>
              </div>
            </div>
            <button className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"><Mic className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="bg-[#1e293b] border border-slate-700 p-4 rounded-[20px] shadow-sm flex flex-col justify-between h-24 hover:bg-slate-800 transition-colors">
          <MessageCircle className="w-5 h-5 text-[#25D366]" />
          <div className="text-left"><p className="text-xs font-bold text-slate-300">WhatsApp 邀請</p></div>
        </button>
        <button className="bg-[#1e293b] border border-slate-700 p-4 rounded-[20px] shadow-sm flex flex-col justify-between h-24 hover:bg-slate-800 transition-colors">
          <QrCode className="w-5 h-5 text-blue-400" />
          <div className="text-left"><p className="text-xs font-bold text-slate-300">掃描 QR Code</p></div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-[20px] border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">本月營收</p>
          <p className="text-2xl font-bold text-white">HKD 24k</p>
        </div>
        <div className="bg-[#1e293b] p-5 rounded-[20px] border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">活躍學生</p>
          <p className="text-2xl font-bold text-white">18 / 20</p>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-slate-200 mb-3 tracking-wide">學員管理 (Clients)</h3>
        <div className="bg-[#1e293b] rounded-[20px] border border-slate-700 divide-y divide-slate-800 overflow-hidden">
          {['Jason Chan', 'Emily Wong', 'David Lee'].map((name, i) => (
            <div key={i} className="p-4 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400">{name[0]}</div>
                  <div>
                    <p className="text-sm font-bold text-slate-200">{name}</p>
                    <p className="text-[10px] text-slate-500">{i === 0 ? '需排本週課表' : '進度良好'}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex space-x-2">
                <button onClick={() => { setSelectedClientName(name); setShowCoachBuilder(true); }} className="flex-1 bg-blue-600 text-white text-xs py-2 rounded-lg font-bold flex items-center justify-center hover:bg-blue-700 shadow-sm">
                  <Plus className="w-3 h-3 mr-1" /> 排課表
                </button>
                <button className="flex-1 bg-slate-800 text-slate-300 text-xs py-2 rounded-lg font-bold hover:bg-slate-700">查看數據</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const WorkoutTab: React.FC<{ onStartWorkout: () => void }> = ({ onStartWorkout }) => (
    <div className="p-4 pb-24 animate-in fade-in space-y-6 mt-2">
      <button onClick={onStartWorkout} className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-2xl flex items-center justify-center space-x-2 shadow-lg shadow-blue-200 active:scale-95 transition-transform">
        <Plus className="w-6 h-6" /><span>開始空課表 (Empty Workout)</span>
      </button>
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800 text-lg">我的課表</h3>
          <div className="flex space-x-2">
            <button className="text-gray-600 bg-gray-100 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center"><Search className="w-3 h-3 mr-1" /> 探索</button>
            <button className="text-blue-600 bg-blue-50 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center"><Plus className="w-3 h-3 mr-1" /> 新增</button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-white border border-gray-100 p-4 rounded-[20px] shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <h4 className="font-bold text-gray-900 text-lg">Legs Day (Hypertrophy)</h4>
              <button><MoreHorizontal className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">Barbell Squat, Romanian Deadlift (Barbell), Leg Extension (Machine), Seated Calf Raise</p>
            <button onClick={onStartWorkout} className="w-full bg-gray-50 hover:bg-gray-100 text-blue-600 font-bold py-2.5 rounded-xl transition-colors active:scale-95 text-sm">開始訓練 (Start Routine)</button>
          </div>
          <div className="bg-white border border-gray-100 p-4 rounded-[20px] shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <h4 className="font-bold text-gray-900 text-lg">Chest and Triceps</h4>
              <button><MoreHorizontal className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">Push Up, Bench Press (Barbell), Incline Bench Press (Dumbbell), Chest Fly (Machine), Tricep Extension</p>
            <button onClick={onStartWorkout} className="w-full bg-gray-50 hover:bg-gray-100 text-blue-600 font-bold py-2.5 rounded-xl transition-colors active:scale-95 text-sm">開始訓練 (Start Routine)</button>
          </div>
        </div>
      </div>
    </div>
  );

  const FoodTab = () => (
    <div className="pb-24 animate-in fade-in relative">
      <div className="px-4 pt-6 pb-2 space-y-4">
        <div className="flex justify-between items-center px-1">
          {weekDays.map((day, idx) => {
            const isActive = idx === selectedFoodDayIndex;
            const hasData = mockDataAvailable[idx];
            return (
              <div key={idx} onClick={() => setSelectedFoodDayIndex(idx)} className="flex flex-col items-center space-y-2 cursor-pointer group">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-[2.5px] transition-all duration-200 ${isActive ? 'border-emerald-500 scale-110' : (hasData ? 'bg-[#3b414f] border-[#3b414f] text-emerald-400' : 'border-gray-200 text-transparent')}`}>
                  {hasData && !isActive ? <Check className="w-4 h-4" strokeWidth={3} /> : null}
                </div>
                <span className={`text-[11px] font-medium ${isActive ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>{day}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center space-x-2">
          <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
          <span className="text-xs font-bold text-orange-500">27</span>
          <span className="text-xs text-gray-400">27 天食物連續紀錄</span>
          <Info className="w-3 h-3 text-gray-300 ml-auto" />
        </div>
      </div>

      <div className="sticky top-[60px] z-20 bg-white/95 backdrop-blur-xl shadow-sm border-b border-gray-100 py-3 px-4 mb-4 flex justify-between items-center text-center">
        <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 mb-0.5">脂肪</span><span className="text-[13px] font-bold text-gray-800">54.47</span></div>
        <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 mb-0.5">碳水</span><span className="text-[13px] font-bold text-gray-800">174.91</span></div>
        <div className="flex flex-col items-center"><span className="text-[10px] text-gray-500 mb-0.5">蛋白質</span><span className="text-[13px] font-bold text-gray-800">256.96</span></div>
        <div className="flex flex-col items-center pl-3 border-l border-gray-200"><span className="text-[10px] text-gray-800 font-bold mb-0.5">卡路里</span><span className="text-lg font-black text-gray-900 leading-none tracking-tight">2302</span></div>
      </div>

      <div className="px-4 space-y-4">
        <MealSection title="早餐 (Breakfast)" items={[{ name: '燕麥片', portion: '1 碗 (熟)', cals: 155 }, { name: '黑咖啡', portion: '1 杯', cals: 5 }]} onAdd={() => setShowMealLogger(true)} />
        <MealSection title="午餐 (Lunch)" items={[{ name: '譚仔雲南米線 (清湯, 雞肉, 走韭菜)', portion: '1 碗', cals: 680 }, { name: '凍檸茶 (少甜)', portion: '1 杯', cals: 85 }]} onAdd={() => setShowMealLogger(true)} />
        <MealSection title="晚餐 (Dinner)" items={[]} onAdd={() => setShowMealLogger(true)} />
        <MealSection title="小食/其他 (Snacks)" items={[]} onAdd={() => setShowMealLogger(true)} />
      </div>
    </div>
  );

  const SocialTab = () => (
    <div className="p-4 pb-24 animate-in fade-in space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`font-bold text-2xl tracking-tight ${isCoach ? 'text-white' : 'text-gray-900'}`}>動態牆</h2>
        <button className={`p-2 rounded-full ${isCoach ? 'bg-slate-800 text-slate-300' : 'bg-gray-100 text-gray-600'}`}><Users className="w-5 h-5" /></button>
      </div>

      <div className={`p-4 rounded-[20px] shadow-sm border ${isCoach ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className={`font-bold text-sm ${isCoach ? 'text-slate-200' : 'text-gray-800'}`}>🏆 狂熱健身小隊</h3>
          <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded flex items-center"><Flame className="w-3 h-3 mr-1" /> 14 天連勝</span>
        </div>
        <div className="flex space-x-2">
          {['A', 'B', 'C', 'D'].map((m, i) => (
            <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-500' : 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300'}`}>{m}</div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-3">還有 1 位隊員今天尚未打卡，催促一下以免斷連勝！</p>
      </div>

      <div className="space-y-4">
        <div className={`p-4 rounded-[20px] shadow-sm border ${isCoach ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">JC</div>
            <div><p className={`font-bold text-sm ${isCoach ? 'text-white' : 'text-gray-900'}`}>Jason Chan</p><p className="text-[10px] text-gray-400">2 小時前 • Chest Day</p></div>
          </div>
          <p className={`text-sm mb-3 ${isCoach ? 'text-slate-300' : 'text-gray-700'}`}>突破了 Bench Press 個人紀錄！爽！🔥</p>
          <div className="flex space-x-2">
            <button className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs py-2 rounded-lg font-bold flex items-center justify-center transition-colors">
              <ThumbsUp className="w-4 h-4 mr-1.5" /> 虛擬擊掌
            </button>
          </div>
        </div>

        <div className={`p-4 rounded-[20px] shadow-sm border ${isCoach ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center font-bold">EW</div>
            <div><p className={`font-bold text-sm ${isCoach ? 'text-white' : 'text-gray-900'}`}>Emily Wong</p><p className="text-[10px] text-gray-400">已經 2 天沒有活動了</p></div>
          </div>
          <button className="w-full bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs py-2 rounded-lg font-bold flex items-center justify-center transition-colors">
            <Send className="w-4 h-4 mr-1.5" /> 幽默 Nudge: "Go to the Gym!"
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`max-w-md mx-auto min-h-screen relative font-sans leading-relaxed tracking-wide transition-colors duration-300 ${themeClass}`}>
      <header className={`sticky top-0 z-30 backdrop-blur-xl px-4 py-3 border-b flex justify-between items-center h-[60px] ${headerClass}`}>
        <div className="flex items-center w-1/3">
          {activeTab === 'dashboard' && (
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black italic ${isCoach ? 'bg-blue-600 text-white' : 'bg-black text-white'}`}>FB</div>
              <span className="font-bold tracking-tight">{isCoach ? 'Coach View' : 'FitBuddy'}</span>
            </div>
          )}
          {activeTab === 'food' && (
            <button onClick={() => setShowGoalsPage(true)} className="p-1.5 bg-emerald-100 rounded-full text-emerald-600 hover:bg-emerald-200 transition-colors shadow-sm"><Target className="w-5 h-5" /></button>
          )}
        </div>

        <div className="flex-1 flex justify-center items-center">
          {activeTab === 'food' && <h2 className="font-bold text-lg tracking-tight">{foodDayTitles[selectedFoodDayIndex]}</h2>}
          {activeTab === 'social' && <h2 className="font-bold text-lg tracking-tight">社群</h2>}
        </div>

        <div className="flex items-center justify-end space-x-3 w-1/3">
          {activeTab === 'food' && (
            <button onClick={() => setShowFullCalendar(true)} className="p-1.5 bg-gray-100 rounded-full text-gray-600 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"><Calendar className="w-5 h-5" /></button>
          )}
          <button
            onClick={() => setRole(r => (r === 'CLIENT' ? 'COACH' : 'CLIENT'))}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors shadow-sm ${isCoach ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            <SwitchCamera className="w-3.5 h-3.5" />
            <span>{isCoach ? 'Coach' : 'Client'}</span>
          </button>
        </div>
      </header>

      {activeTab === 'dashboard' && (isCoach ? <CoachDashboard /> : <ClientDashboard />)}
      {activeTab === 'workout' && <WorkoutTab onStartWorkout={() => openWorkoutLogger(upcomingRoutine ?? EMPTY_ROUTINE_FOR_FREE_WORKOUT)} />}
      {activeTab === 'food' && <FoodTab />}
      {activeTab === 'social' && <SocialTab />}
      {activeTab === 'profile' && <div className="p-4"><h2 className="font-bold">個人檔案</h2></div>}

      {showClientLogger && selectedRoutine && (
        <ClientWorkoutLogger
          routine={selectedRoutine}
          onClose={() => { setShowClientLogger(false); setSelectedRoutine(null); }}
        />
      )}
      {showCoachBuilder && <CoachRoutineBuilder clientName={selectedClientName} onClose={() => setShowCoachBuilder(false)} />}
      {showMealLogger && <ClientMealLogger onClose={() => setShowMealLogger(false)} />}
      {showFullCalendar && <FullCalendarModal onClose={() => setShowFullCalendar(false)} />}
      {showGoalsPage && <MacroGoalsPage onClose={() => setShowGoalsPage(false)} />}

      <nav className={`fixed bottom-0 left-0 right-0 z-40 mx-auto flex w-full max-w-md justify-around border-t py-2 pb-6 transition-colors duration-300 ${bottomNavClass}`}>
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: '概覽' },
          { id: 'workout', icon: Dumbbell, label: '訓練' },
          { id: 'food', icon: Utensils, label: '飲食' },
          { id: 'social', icon: Users, label: '社群' },
          { id: 'profile', icon: UserCircle, label: '我的' },
        ].map((item) => {
          const isActive = activeTab === item.id;
          const activeColor = isCoach ? 'text-blue-400' : 'text-blue-600';
          const inactiveColor = isCoach ? 'text-slate-500' : 'text-gray-400';
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center space-y-1 w-16 pt-2 ${isActive ? activeColor : inactiveColor}`}
            >
              <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { request, normalizeApiError } from '@/lib/api-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface WorkoutPlanEditorProps {
  selectedClientId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  restSeconds?: number;
  notes?: string;
}

interface CoachClient {
  clientId: string;
  username: string;
  email: string;
}

export default function WorkoutPlanEditor({
  selectedClientId,
  onClose,
  onRefresh,
}: WorkoutPlanEditorProps) {
  const { toast } = useToast();
  const [clients, setClients] = useState<Array<{ id: string; username: string; email: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [clientId, setClientId] = useState(selectedClientId || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([
    { id: '1', name: '', sets: 3, reps: 10 },
  ]);
  const [weekDays, setWeekDays] = useState<number[]>([]);
  const [duration, setDuration] = useState<number>(4);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (selectedClientId) {
      setClientId(selectedClientId);
    }
    fetchClients();
  }, [selectedClientId]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await request.get<CoachClient[]>('/api/coaches/clients');
      setClients(data.map((c: CoachClient) => ({
        id: c.clientId,
        username: c.username,
        email: c.email,
      })));
    } catch (err) {
      const normalized = normalizeApiError(err);
      toast({
        title: '載入失敗',
        description: normalized.message || 'Failed to fetch clients',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddExercise = () => {
    setExercises([
      ...exercises,
      { id: Date.now().toString(), name: '', sets: 3, reps: 10 },
    ]);
  };

  const handleRemoveExercise = (id: string) => {
    setExercises(exercises.filter((e) => e.id !== id));
  };

  const handleUpdateExercise = (id: string, field: keyof Exercise, value: any) => {
    setExercises(
      exercises.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const handleToggleWeekDay = (day: number) => {
    if (weekDays.includes(day)) {
      setWeekDays(weekDays.filter((d) => d !== day));
    } else {
      setWeekDays([...weekDays, day].sort());
    }
  };

  const weekDayLabels = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId || !name || exercises.length === 0 || weekDays.length === 0 || !duration) {
      toast({
        title: '錯誤',
        description: '請填寫所有必填字段',
        variant: 'destructive',
      });
      return;
    }

    // Validate exercises
    const invalidExercises = exercises.filter((e) => !e.name.trim());
    if (invalidExercises.length > 0) {
      toast({
        title: '錯誤',
        description: '請填寫所有動作名稱',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await request.post('/api/workout-plans', {
        clientId,
        name,
        description: description || null,
        exercises,
        weekDays,
        duration,
        notes: notes || null,
      });

      toast({
        title: '成功',
        description: '訓練計劃已創建',
      });

      // Reset form
      setName('');
      setDescription('');
      setExercises([{ id: '1', name: '', sets: 3, reps: 10 }]);
      setWeekDays([]);
      setDuration(4);
      setNotes('');
      onRefresh();
    } catch (err) {
      const normalized = normalizeApiError(err);
      toast({
        title: '創建失敗',
        description: normalized.message || 'Failed to create workout plan',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">創建訓練計劃</h2>
        <p className="text-muted-foreground">為您的客戶創建一個新的訓練計劃</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 選擇客戶 */}
        <div className="space-y-2">
          <Label htmlFor="client">選擇客戶 *</Label>
          <Select value={clientId} onValueChange={setClientId} disabled={loading || !!selectedClientId}>
            <SelectTrigger id="client">
              <SelectValue placeholder="選擇客戶" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.username} ({client.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 計劃名稱 */}
        <div className="space-y-2">
          <Label htmlFor="name">計劃名稱 *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：增肌訓練計劃"
            required
          />
        </div>

        {/* 描述 */}
        <div className="space-y-2">
          <Label htmlFor="description">描述</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="計劃的詳細描述..."
            rows={3}
          />
        </div>

        {/* 訓練動作 */}
        <div className="space-y-2">
          <Label>訓練動作 *</Label>
          <div className="space-y-4">
            {exercises.map((exercise, index) => (
              <Card key={exercise.id} className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-medium">動作 {index + 1}</h4>
                  {exercises.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveExercise(exercise.id)}
                    >
                      移除
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>動作名稱 *</Label>
                    <Input
                      value={exercise.name}
                      onChange={(e) =>
                        handleUpdateExercise(exercise.id, 'name', e.target.value)
                      }
                      placeholder="例如：深蹲"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>組數 *</Label>
                    <Input
                      type="number"
                      value={exercise.sets}
                      onChange={(e) =>
                        handleUpdateExercise(exercise.id, 'sets', parseInt(e.target.value) || 0)
                      }
                      min="1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>次數 *</Label>
                    <Input
                      type="number"
                      value={exercise.reps}
                      onChange={(e) =>
                        handleUpdateExercise(exercise.id, 'reps', parseInt(e.target.value) || 0)
                      }
                      min="1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>重量 (kg)</Label>
                    <Input
                      type="number"
                      value={exercise.weight || ''}
                      onChange={(e) =>
                        handleUpdateExercise(exercise.id, 'weight', parseFloat(e.target.value) || undefined)
                      }
                      min="0"
                      step="0.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>休息時間 (秒)</Label>
                    <Input
                      type="number"
                      value={exercise.restSeconds || ''}
                      onChange={(e) =>
                        handleUpdateExercise(exercise.id, 'restSeconds', parseInt(e.target.value) || undefined)
                      }
                      min="0"
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label>備註</Label>
                  <Textarea
                    value={exercise.notes || ''}
                    onChange={(e) =>
                      handleUpdateExercise(exercise.id, 'notes', e.target.value)
                    }
                    placeholder="動作要點..."
                    rows={2}
                  />
                </div>
              </Card>
            ))}
            <Button type="button" variant="outline" onClick={handleAddExercise}>
              + 添加動作
            </Button>
          </div>
        </div>

        {/* 訓練日 */}
        <div className="space-y-2">
          <Label>訓練日 *</Label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <Button
                key={day}
                type="button"
                variant={weekDays.includes(day) ? 'default' : 'outline'}
                onClick={() => handleToggleWeekDay(day)}
              >
                {weekDayLabels[day - 1]}
              </Button>
            ))}
          </div>
          {weekDays.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-muted-foreground">
                已選擇：{weekDays.map((d) => weekDayLabels[d - 1]).join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* 持續時間 */}
        <div className="space-y-2">
          <Label htmlFor="duration">持續時間 (週) *</Label>
          <Input
            id="duration"
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
            min="1"
            required
          />
        </div>

        {/* 備註 */}
        <div className="space-y-2">
          <Label htmlFor="notes">備註</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="計劃的額外備註..."
            rows={3}
          />
        </div>

        {/* 提交按鈕 */}
        <div className="flex gap-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? '創建中...' : '創建計劃'}
          </Button>
          {selectedClientId && (
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}


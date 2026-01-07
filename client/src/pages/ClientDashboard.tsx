import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';

interface WorkoutPlan {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'completed';
  duration: number;
  startDate: string | null;
  endDate: string | null;
  exercises: unknown[];
  weekDays: number[];
  createdAt: string;
  updatedAt: string;
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.id) {
      fetchPlans();
    }
  }, [user?.id]);

  const fetchPlans = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const response = await apiClient.get(`/api/workout-plans/client/${user.id}`);
      const data = response.data;
      setPlans(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch plans';
      setError(errorMessage);
      toast({
        title: '載入失敗',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      draft: 'secondary',
      active: 'default',
      completed: 'outline',
    };

    const labels: Record<string, string> = {
      draft: '草稿',
      active: '進行中',
      completed: '已完成',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const weekDayLabels = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* 頭部 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Your Training Plans</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.firstName || user?.email || 'User'}!
        </p>
      </div>

      {/* 計劃列表 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-3/4 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3 mb-4" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-6">
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-6 py-4 rounded-lg">
            {error}
          </div>
        </Card>
      ) : plans.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-6 py-4 rounded-lg">
            No training plans assigned yet. Please contact your coach.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold flex-1 mr-2">
                  {plan.name}
                </h2>
                {getStatusBadge(plan.status)}
              </div>

              {plan.description && (
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                  {plan.description}
                </p>
              )}

              <div className="space-y-2 text-sm mb-4">
                <p className="text-foreground">
                  <strong>持續時間:</strong> {plan.duration} 週
                </p>
                <p className="text-foreground">
                  <strong>每週訓練日:</strong> {plan.weekDays.length} 天
                  {plan.weekDays.length > 0 && (
                    <span className="ml-2 text-muted-foreground">
                      ({plan.weekDays.map((d) => weekDayLabels[d - 1]).join(', ')})
                    </span>
                  )}
                </p>
                <p className="text-foreground">
                  <strong>訓練動作:</strong> {plan.exercises?.length || 0} 個
                </p>
                {plan.startDate && (
                  <p className="text-muted-foreground text-xs">
                    開始日期: {new Date(plan.startDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              <Button className="w-full" variant="default">
                View Details
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


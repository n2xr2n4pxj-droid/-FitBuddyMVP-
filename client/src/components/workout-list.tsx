import { format } from "date-fns";
import type { Workout } from "@shared/schema";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function WorkoutList({ workouts }: { workouts: Workout[] }) {
  if (workouts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-workouts">
        <Activity className="w-12 h-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No workouts logged today</p>
        <p className="text-sm text-muted-foreground">Use the form above to log your first workout</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workouts.map((workout) => (
        <div
          key={workout.id}
          className="p-4 rounded-lg border bg-card hover-elevate"
          data-testid={`workout-item-${workout.id}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold" data-testid={`workout-type-${workout.id}`}>
                  {workout.workoutType}
                </h4>
                <Badge variant="secondary" data-testid={`workout-duration-${workout.id}`}>
                  {workout.durationMinutes} min
                </Badge>
              </div>
              {workout.notes && (
                <p className="text-sm text-muted-foreground" data-testid={`workout-notes-${workout.id}`}>
                  {workout.notes}
                </p>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(workout.date), "h:mm a")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

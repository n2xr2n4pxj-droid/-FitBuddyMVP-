import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { insertWorkoutSchema, type InsertWorkout } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const WORKOUT_TYPES = [
  "Run",
  "Walk",
  "Bike",
  "Swim",
  "Strength Training",
  "Yoga",
  "Pilates",
  "HIIT",
  "Sports",
  "Dancing",
  "Other",
];

export function WorkoutForm() {
  const { toast } = useToast();
  
  const form = useForm<InsertWorkout>({
    resolver: zodResolver(insertWorkoutSchema),
    defaultValues: {
      workoutType: "Run",
      durationMinutes: 30,
      date: new Date(),
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertWorkout) => {
      await apiRequest("POST", "/api/workouts", data);
    },
    onSuccess: () => {
      const today = format(new Date(), "yyyy-MM-dd");
      // Invalidate exact keys used by dashboard queries
      queryClient.invalidateQueries({ queryKey: ["/api/workouts", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/daily", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/weekly"] });
      toast({
        title: "Workout logged!",
        description: "Your workout has been successfully recorded.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to log workout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertWorkout) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="workoutType">Workout Type</Label>
        <Select
          value={form.watch("workoutType")}
          onValueChange={(value) => form.setValue("workoutType", value)}
        >
          <SelectTrigger id="workoutType" data-testid="select-workout-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKOUT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.workoutType && (
          <p className="text-sm text-destructive">{form.formState.errors.workoutType.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="durationMinutes">Duration (minutes)</Label>
        <Input
          id="durationMinutes"
          type="number"
          min="1"
          {...form.register("durationMinutes", { valueAsNumber: true })}
          placeholder="30"
          data-testid="input-duration"
        />
        {form.formState.errors.durationMinutes && (
          <p className="text-sm text-destructive">{form.formState.errors.durationMinutes.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          {...form.register("notes")}
          placeholder="How did it feel? Any achievements?"
          rows={3}
          data-testid="input-notes"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={mutation.isPending}
        data-testid="button-submit-workout"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Logging...
          </>
        ) : (
          "Log Workout"
        )}
      </Button>
    </form>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { insertMealSchema, type InsertMeal } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type FoodSearchResult = {
  fdcId: number;
  description: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export function MealForm() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const form = useForm<InsertMeal>({
    resolver: zodResolver(insertMealSchema),
    defaultValues: {
      foodName: "",
      calories: "0",
      protein: "0",
      carbs: "0",
      fat: "0",
      mealType: "breakfast",
      date: new Date(),
    },
  });

  const { data: searchResults = [], isLoading: isSearching } = useQuery<FoodSearchResult[]>({
    queryKey: ["/api/nutrition/search", searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/nutrition/search/${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertMeal) => {
      await apiRequest("POST", "/api/meals", data);
    },
    onSuccess: () => {
      const today = format(new Date(), "yyyy-MM-dd");
      queryClient.invalidateQueries({ queryKey: ["/api/meals", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/daily", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/weekly"] });
      toast({
        title: "Meal logged!",
        description: "Your meal has been successfully recorded.",
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
        description: "Failed to log meal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertMeal) => {
    mutation.mutate(data);
  };

  const selectFood = (food: FoodSearchResult) => {
    form.setValue("foodName", food.description);
    form.setValue("calories", String(food.calories || 0));
    form.setValue("protein", String(food.protein || 0));
    form.setValue("carbs", String(food.carbs || 0));
    form.setValue("fat", String(food.fat || 0));
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label htmlFor="foodName">Food Name</Label>
            <Input
              id="foodName"
              {...form.register("foodName")}
              placeholder="e.g., Grilled Chicken Breast"
              data-testid="input-food-name"
            />
          </div>
          <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="mt-6"
                data-testid="button-search-food"
              >
                <Search className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Search USDA Food Database</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Search for foods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-query"
                />
                {isSearching && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                {!isSearching && searchResults.length > 0 && (
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {searchResults.map((food) => (
                        <button
                          key={food.fdcId}
                          type="button"
                          onClick={() => selectFood(food)}
                          className="w-full p-4 text-left rounded-lg border bg-card hover-elevate active-elevate-2"
                          data-testid={`food-result-${food.fdcId}`}
                        >
                          <div className="font-medium">{food.description}</div>
                          {food.brandName && (
                            <div className="text-sm text-muted-foreground">{food.brandName}</div>
                          )}
                          <div className="text-sm text-muted-foreground mt-2">
                            {food.calories && `${Math.round(food.calories)} cal`}
                            {food.protein && ` • ${Math.round(food.protein)}g protein`}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No results found. Try a different search term.
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {form.formState.errors.foodName && (
          <p className="text-sm text-destructive">{form.formState.errors.foodName.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="calories">Calories</Label>
          <Input
            id="calories"
            type="number"
            step="0.1"
            {...form.register("calories")}
            placeholder="0"
            data-testid="input-calories"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="protein">Protein (g)</Label>
          <Input
            id="protein"
            type="number"
            step="0.1"
            {...form.register("protein")}
            placeholder="0"
            data-testid="input-protein"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="carbs">Carbs (g)</Label>
          <Input
            id="carbs"
            type="number"
            step="0.1"
            {...form.register("carbs")}
            placeholder="0"
            data-testid="input-carbs"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fat">Fat (g)</Label>
          <Input
            id="fat"
            type="number"
            step="0.1"
            {...form.register("fat")}
            placeholder="0"
            data-testid="input-fat"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mealType">Meal Type</Label>
        <Select
          value={form.watch("mealType")}
          onValueChange={(value) => form.setValue("mealType", value as "breakfast" | "lunch" | "dinner" | "snack")}
        >
          <SelectTrigger id="mealType" data-testid="select-meal-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="breakfast">Breakfast</SelectItem>
            <SelectItem value="lunch">Lunch</SelectItem>
            <SelectItem value="dinner">Dinner</SelectItem>
            <SelectItem value="snack">Snack</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={mutation.isPending}
        data-testid="button-submit-meal"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Logging...
          </>
        ) : (
          "Log Meal"
        )}
      </Button>
    </form>
  );
}

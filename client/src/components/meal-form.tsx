import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { insertMealSchema, type InsertMeal } from "@shared/schema";
import type { MealFormData, ServingSizeUnit, FoodSearchResult } from "@/types/meal";
import { calculateNutrientsForServing, getUSDAStandardValues } from "@/lib/nutrition";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { request } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function MealForm() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // 選中的食物
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
  
  // 基礎份量信息（來自 API）
  const [baseServingSize, setBaseServingSize] = useState<number | null>(null);
  const [baseServingUnit, setBaseServingUnit] = useState<ServingSizeUnit>("g");
  const [baseNutrients, setBaseNutrients] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);
  
  // 用戶實際份量
  const [userServingAmount, setUserServingAmount] = useState<number>(100);
  
  const form = useForm<InsertMeal>({
    resolver: zodResolver(insertMealSchema),
    defaultValues: {
      name: "", // 改為 name 以匹配 schema
      calories: "0",
      protein: "0",
      carbs: "0",
      fat: "0",
      mealType: "BREAKFAST",
      consumedAt: new Date(), // 改為 consumedAt 以匹配 schema
      servingSize: undefined,
      servingSizeUnit: "g",
      userServingAmount: undefined,
    },
  });

  const { data: searchResults = [], isLoading: isSearching, error: searchError } = useQuery<FoodSearchResult[]>({
    queryKey: ["/api/food/search", searchQuery],
    queryFn: async () => {
      return request.get<FoodSearchResult[]>(`/api/food/search?query=${encodeURIComponent(searchQuery)}`);
    },
    enabled: searchQuery.length >= 2,
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertMeal) => {
      console.log("🟡 [MealForm] mutationFn called with data:", data);
      try {
        const result = await apiRequest("POST", "/api/meals", data);
        console.log("🟡 [MealForm] API request successful:", result);
        return result;
      } catch (error) {
        console.error("🔴 [MealForm] API request failed:", error);
        throw error;
      }
    },
    onSuccess: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      // 先無效化查詢
      queryClient.invalidateQueries({ queryKey: ["/api/meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meals", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/daily", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary/weekly"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tdee/today-progress"] });
      
      // 強制立即重新獲取今天的餐點數據
      await queryClient.refetchQueries({ queryKey: ["/api/meals", today] });
      
      toast({
        title: "Meal logged!",
        description: "Your meal has been successfully recorded.",
      });
      form.reset();
      setSelectedFood(null);
      setBaseServingSize(null);
      setBaseServingUnit("g");
      setBaseNutrients(null);
      setUserServingAmount(100);
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
    console.log("🟢 [MealForm] onSubmit called with data:", data);
    console.log("🟢 [MealForm] selectedFood:", selectedFood);
    
    // 優先使用用戶手動輸入的名稱，否則使用選擇的食物名稱
    // 如果兩者都沒有，表單驗證應該已經阻止了提交
    const mealName = (data.name && data.name.trim()) 
      ? data.name.trim() 
      : (selectedFood?.description || "");
    
    // 如果名稱仍然是空的，這不應該發生（因為 schema 驗證），但為了安全起見還是檢查
    if (!mealName || !mealName.trim()) {
      console.error("🔴 [MealForm] Meal name is empty!");
      toast({
        title: "Error",
        description: "Please enter a food name or select a food from the search.",
        variant: "destructive",
      });
      return;
    }
    
    // 確保 consumedAt 設置為當前時間（如果沒有提供）
    const consumedAt = data.consumedAt || new Date();
    
    const mealData: InsertMeal = {
      ...data,
      name: mealName.trim(),
      consumedAt: consumedAt instanceof Date ? consumedAt : new Date(consumedAt),
    };
    
    console.log("🟢 [MealForm] Final meal name:", mealName);
    console.log("🟢 [MealForm] consumedAt:", mealData.consumedAt);
    console.log("🟢 [MealForm] Submitting meal data:", mealData);
    mutation.mutate(mealData);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    console.log("🔵 [MealForm] Form submit event triggered");
    console.log("🔵 [MealForm] Form errors:", form.formState.errors);
    console.log("🔵 [MealForm] Form values:", form.getValues());
    // form.handleSubmit 會自動處理驗證和 preventDefault
    form.handleSubmit(onSubmit, (errors) => {
      console.error("🔴 [MealForm] Form validation failed:", errors);
    })(e);
  };

  // 更新營養計算邏輯
  const calculateNutrients = (userAmount: number) => {
    if (!baseServingSize || !baseNutrients || baseServingSize === 0) {
      return;
    }
    
    const { serving } = calculateNutrientsForServing(
      baseServingSize,
      {
        calories: baseNutrients.calories,
        protein: baseNutrients.protein,
        carbs: baseNutrients.carbs,
        fat: baseNutrients.fat,
      },
      userAmount
    );
    
    // 更新表單值
    form.setValue("calories", serving.calories.toFixed(2));
    form.setValue("protein", serving.protein.toFixed(2));
    form.setValue("carbs", serving.carbs.toFixed(2));
    form.setValue("fat", serving.fat.toFixed(2));
    
    // 保存份量信息
    form.setValue("servingSize", String(baseServingSize));
    form.setValue("servingSizeUnit", baseServingUnit);
    form.setValue("userServingAmount", String(userAmount));
  };

  // 更新 API 調用
  const handleFoodSelect = async (food: FoodSearchResult) => {
    try {
      console.log("Selected food:", food);
      console.log("servingSize:", food.servingSize);
      console.log("calories:", food.calories);
      
      // 保存選中的食物
      setSelectedFood(food);
      
      // ✅ 使用標準值庫（所有值都是每 100g）
      const description = food.description.toLowerCase();
      const standardValues = getUSDAStandardValues(description);
      
      // ✅ 如果有標準值，用標準值；否則用 API + 校正邏輯
      let servingSize, nutrients;
      
      if (standardValues) {
        // 使用標準值（最準確，所有值都是每 100g）
        servingSize = 100;
        nutrients = {
          calories: standardValues.calories,
          protein: standardValues.protein,
          carbs: standardValues.carbs,
          fat: standardValues.fat,
        };
        console.log("✅ Using standard values");
      } else {
        // 使用 API 值 + 自動校正
        servingSize = food.servingSize || 100;
        
        // ⚠️ 如果 servingSize 不是 100，自動標準化到 100g
        if (servingSize !== 100) {
          console.log("⚠️ Normalizing from", servingSize, "to 100g");
          nutrients = {
            calories: (food.calories || 0) / servingSize * 100,
            protein: (food.protein || 0) / servingSize * 100,
            carbs: (food.carbs || 0) / servingSize * 100,
            fat: (food.fat || 0) / servingSize * 100,
          };
          servingSize = 100; // 標準化為 100
        } else {
          nutrients = {
            calories: food.calories || 0,
            protein: food.protein || 0,
            carbs: food.carbs || 0,
            fat: food.fat || 0,
          };
        }
        console.log("⚠️ Using API values (auto-normalized)");
      }
      
      const servingUnit = (food.servingSizeUnit?.toLowerCase() === "ml" ? "ml" : "g") as ServingSizeUnit;
      
      setBaseServingSize(servingSize);
      setBaseServingUnit(servingUnit);
      setBaseNutrients(nutrients);
      setUserServingAmount(100);
      
      form.setValue("name", food.description);
      
      calculateNutrients(100);
      
      setIsSearchOpen(false);
      setSearchQuery("");
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "錯誤",
        description: "無法獲取食物詳細信息",
        variant: "destructive",
      });
    }
  };

  const selectFood = (food: FoodSearchResult) => {
    handleFoodSelect(food);
  };

  // Handle user serving amount change
  const handleServingAmountChange = (value: string) => {
    const amount = parseFloat(value);
    if (!isNaN(amount) && amount > 0) {
      setUserServingAmount(amount);
      form.setValue("userServingAmount", value);
      calculateNutrients(amount);
    } else if (value === "") {
      setUserServingAmount(100);
      form.setValue("userServingAmount", undefined);
      calculateNutrients(100); // Recalculate nutrients for base 100g serving
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label htmlFor="name">Food Name</Label>
            <Input
              id="name"
              {...form.register("name")}
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
                <DialogTitle>Search Food Database</DialogTitle>
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
                {searchError && (
                  <div className="text-center py-8">
                    <p className="text-destructive font-medium mb-2">搜索失敗</p>
                    <p className="text-sm text-muted-foreground">{searchError.message}</p>
                  </div>
                )}
                {!isSearching && !searchError && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No results found. Try a different search term.
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      {/* Serving Size Section */}
      {(baseServingSize !== null || form.watch("servingSize")) && (
        <div className="space-y-6 p-6 bg-muted/50 rounded-lg border-2">
          <Label className="text-lg font-semibold">份量 (Serving Size)</Label>
          <div className="space-y-3">
            <Label htmlFor="userServingAmount" className="text-base font-medium text-foreground">
              食用份量
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="userServingAmount"
                type="number"
                step="any"
                value={userServingAmount || ""}
                onChange={(e) => handleServingAmountChange(e.target.value)}
                placeholder="輸入份量（以100為參考）"
                className="flex-1 min-w-[50px] h-12 text-base"
                data-testid="input-user-serving-amount"
              />
              <div className="w-16 text-sm font-medium text-foreground flex items-center justify-center border rounded-md bg-background h-10">
                {form.watch("servingSizeUnit") || "g"}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="calories">Calories</Label>
          <Input
            id="calories"
            type="number"
            step="any"
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
            step="any"
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
            step="any"
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
            step="any"
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
          onValueChange={(value) => form.setValue("mealType", value as "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK")}
        >
          <SelectTrigger id="mealType" data-testid="select-meal-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BREAKFAST">Breakfast</SelectItem>
            <SelectItem value="LUNCH">Lunch</SelectItem>
            <SelectItem value="DINNER">Dinner</SelectItem>
            <SelectItem value="SNACK">Snack</SelectItem>
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

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { insertMealSchema, type InsertMeal } from "@shared/schema";
import type { Meal } from "@shared/schema";
import { useUpdateMeal } from "@/hooks/use-meals";
import { useToast } from "@/hooks/use-toast";
import { normalizeApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditMealModalProps {
  meal: Meal | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditMealModal({
  meal,
  isOpen,
  onClose,
}: EditMealModalProps) {
  const { toast } = useToast();
  const updateMeal = useUpdateMeal();

  // Store original values for calculation
  const [originalValues, setOriginalValues] = useState({
    servingSize: 0,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const form = useForm<InsertMeal>({
    resolver: zodResolver(insertMealSchema),
    defaultValues: {
      name: "",
      calories: "0",
      protein: "0",
      carbs: "0",
      fat: "0",
      mealType: "BREAKFAST",
      consumedAt: new Date(),
      servingSize: undefined,
      servingSizeUnit: "g",
      userServingAmount: undefined,
    },
  });

  // Update form when meal changes
  useEffect(() => {
    if (meal) {
      // 將 mealType 轉換為大寫格式以匹配 schema
      const mealTypeMap: Record<string, "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK"> = {
        "breakfast": "BREAKFAST",
        "BREAKFAST": "BREAKFAST",
        "lunch": "LUNCH",
        "LUNCH": "LUNCH",
        "dinner": "DINNER",
        "DINNER": "DINNER",
        "snack": "SNACK",
        "SNACK": "SNACK",
      };
      const mealType = mealTypeMap[meal.mealType?.toLowerCase() || "breakfast"] || "BREAKFAST";
      
      // Get original servingSize (standard serving size, not userServingAmount)
      const originalServingSize = Number(meal.servingSize || 100);
      
      // Get original nutrition values (these are the values for the original servingSize)
      const originalCalories = Number(meal.calories || 0);
      const originalProtein = Number(meal.protein || 0);
      const originalCarbs = Number(meal.carbs || 0);
      const originalFat = Number(meal.fat || 0);

      // Store original values for calculation
      setOriginalValues({
        servingSize: originalServingSize,
        calories: originalCalories,
        protein: originalProtein,
        carbs: originalCarbs,
        fat: originalFat,
      });

      // Use userServingAmount if available, otherwise use servingSize as current serving
      const currentServing = meal.userServingAmount 
        ? Number(meal.userServingAmount) 
        : originalServingSize;
      
      // Calculate nutrition values based on current serving if different from original
      let displayCalories = originalCalories;
      let displayProtein = originalProtein;
      let displayCarbs = originalCarbs;
      let displayFat = originalFat;
      
      if (currentServing !== originalServingSize && originalServingSize > 0) {
        const ratio = currentServing / originalServingSize;
        displayCalories = originalCalories * ratio;
        displayProtein = originalProtein * ratio;
        displayCarbs = originalCarbs * ratio;
        displayFat = originalFat * ratio;
      }
      
      form.reset({
        name: meal.name || "",
        calories: String(displayCalories.toFixed(2)),
        protein: String(displayProtein.toFixed(2)),
        carbs: String(displayCarbs.toFixed(2)),
        fat: String(displayFat.toFixed(2)),
        mealType: mealType,
        consumedAt: meal.consumedAt ? new Date(meal.consumedAt) : new Date(),
        servingSize: String(originalServingSize), // Always use original servingSize
        servingSizeUnit: (meal.servingSizeUnit === "g" || meal.servingSizeUnit === "ml") ? meal.servingSizeUnit : "g",
        userServingAmount: String(currentServing),
      });
    }
  }, [meal, form]);

  // Auto-calculate nutrition based on serving amount
  const handleServingAmountChange = (newAmount: string) => {
    // Allow empty input
    if (newAmount === "") {
      form.setValue("userServingAmount", "");
      return;
    }

    const amount = parseFloat(newAmount);
    
    if (isNaN(amount) || amount <= 0 || originalValues.servingSize === 0) {
      // Keep the input value but don't calculate
      form.setValue("userServingAmount", newAmount);
      return;
    }

    // Calculate ratio
    const ratio = amount / originalValues.servingSize;

    // Update all nutrition values proportionally
    form.setValue("calories", (originalValues.calories * ratio).toFixed(2));
    form.setValue("protein", (originalValues.protein * ratio).toFixed(2));
    form.setValue("carbs", (originalValues.carbs * ratio).toFixed(2));
    form.setValue("fat", (originalValues.fat * ratio).toFixed(2));
    form.setValue("userServingAmount", newAmount);
  };

  const onSubmit = async (data: InsertMeal) => {
    if (!meal) return;

    try {
      await updateMeal.mutateAsync({
        id: meal.id,
        meal: {
          name: data.name,
          // ✅ 保留原始標準份量
          servingSize: String(originalValues.servingSize),
          // ✅ 保存用戶實際份量
          userServingAmount: data.userServingAmount ? String(parseFloat(data.userServingAmount)) : undefined,
          calories: String(Math.round(parseFloat(data.calories))),
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          mealType: data.mealType,
          servingSizeUnit: data.servingSizeUnit,
        },
      });

      toast({
        title: "Meal updated!",
        description: "Your meal has been successfully updated.",
      });

      onClose();
    } catch (err) {
      const normalized = normalizeApiError(err);
      console.error("Failed to update meal:", err);
      toast({
        title: "Error",
        description: normalized.message || "Failed to update meal. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!isOpen || !meal) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-labelledby="edit-meal-title"
      aria-describedby="edit-meal-description"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 
            id="edit-meal-title"
            className="text-2xl font-bold text-gray-900 dark:text-white"
          >
            Edit Meal
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Add hidden description for accessibility */}
        <p id="edit-meal-description" className="sr-only">
          Update the meal information including food name, serving size, and nutritional values.
        </p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Food Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Food Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="Enter food name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Meal Type */}
          <div className="space-y-2">
            <Label htmlFor="mealType">Meal Type</Label>
            <Select
              value={form.watch("mealType")}
              onValueChange={(value) => form.setValue("mealType", value as "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select meal type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BREAKFAST">Breakfast</SelectItem>
                <SelectItem value="LUNCH">Lunch</SelectItem>
                <SelectItem value="DINNER">Dinner</SelectItem>
                <SelectItem value="SNACK">Snack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Original Serving Size (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="servingSize">
              Serving Size (g/ml)
              <span className="text-xs text-gray-500 ml-2">(Standard)</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="servingSize"
                type="number"
                step="any"
                {...form.register("servingSize")}
                readOnly
                className="bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
              />
              <div className="w-16 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-center border rounded-md bg-gray-50 dark:bg-gray-700 h-10">
                {form.watch("servingSizeUnit") || "g"}
              </div>
            </div>
          </div>

          {/* Your Serving Amount (Editable with auto-calculation) */}
          <div className="space-y-2">
            <Label htmlFor="userServingAmount">
              Your Serving Amount (g/ml)
              <span className="text-xs text-teal-500 ml-2">✨ Auto-calculates nutrition</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="userServingAmount"
                type="number"
                step="any"
                value={form.watch("userServingAmount") || ""}
                onChange={(e) => handleServingAmountChange(e.target.value)}
                placeholder="Enter your serving amount"
                className="border-teal-300 dark:border-teal-600 focus:ring-teal-500"
              />
              <div className="w-16 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-center border rounded-md bg-gray-50 dark:bg-gray-700 h-10">
                {form.watch("servingSizeUnit") || "g"}
              </div>
            </div>
          </div>

          {/* Nutrition Info - Read-only (auto-calculated) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="calories">Calories</Label>
              <Input
                id="calories"
                type="text"
                value={form.watch("calories")}
                readOnly
                className="bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protein">Protein (g)</Label>
              <Input
                id="protein"
                type="text"
                value={form.watch("protein")}
                readOnly
                className="bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carbs">Carbs (g)</Label>
              <Input
                id="carbs"
                type="text"
                value={form.watch("carbs")}
                readOnly
                className="bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fat">Fat (g)</Label>
              <Input
                id="fat"
                type="text"
                value={form.watch("fat")}
                readOnly
                className="bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateMeal.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMeal.isPending}>
              {updateMeal.isPending ? "Updating..." : "Update Meal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


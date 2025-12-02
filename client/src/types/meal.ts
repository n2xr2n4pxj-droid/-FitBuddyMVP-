/**
 * Meal-related types for the client application
 * 
 * These types extend or re-export types from the shared schema
 * and add client-specific type definitions.
 */

import type { Meal, InsertMeal } from "@shared/schema";

// Re-export shared types for convenience
export type { Meal, InsertMeal };

/**
 * Food search result from USDA API
 */
export type FoodSearchResult = {
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

/**
 * Meal type options
 */
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

/**
 * Serving size unit options
 */
export type ServingSizeUnit = "g" | "ml";

/**
 * Extended meal type with calculated fields for display
 */
export interface MealWithCalculations extends Meal {
  // Calculated display values
  caloriesDisplay: number;
  proteinDisplay: number;
  carbsDisplay: number;
  fatDisplay: number;
  // Serving size information
  servingSizeDisplay?: string;
  userServingAmountDisplay?: string;
}

/**
 * Meal form data (extends InsertMeal with optional fields for UI)
 */
export interface MealFormData extends Omit<InsertMeal, "date"> {
  date?: Date | string;
  // Serving size fields
  servingSize?: string;
  servingSizeUnit?: ServingSizeUnit;
  userServingAmount?: string;
}


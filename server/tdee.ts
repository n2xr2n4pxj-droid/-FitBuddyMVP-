export type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extra_active";

export type Gender = "male" | "female";

export interface TDEEInput {
  weight: number; // kg
  height: number; // cm
  age: number; // years
  gender: Gender;
  activityLevel: ActivityLevel;
}

export interface TDEEResult {
  bmr: number; // Basal Metabolic Rate
  tdee: number; // Total Daily Energy Expenditure
  activityMultiplier: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2, // Little or no exercise
  lightly_active: 1.375, // Light exercise 1-3 days/week
  moderately_active: 1.55, // Moderate exercise 3-5 days/week
  very_active: 1.725, // Hard exercise 6-7 days/week
  extra_active: 1.9, // Very hard exercise & physical job
};

/**
 * Calculate BMR using the Mifflin-St Jeor Equation
 * This is considered one of the most accurate BMR formulas
 */
function calculateBMR(
  weight: number,
  height: number,
  age: number,
  gender: Gender,
): number {
  const baseBMR = 10 * weight + 6.25 * height - 5 * age;

  if (gender === "male") {
    return baseBMR + 5;
  } else {
    return baseBMR - 161;
  }
}

/**
 * Calculate Total Daily Energy Expenditure (TDEE)
 * TDEE = BMR × Activity Multiplier
 */
export function calculateTDEE(input: TDEEInput): TDEEResult {
  const { weight, height, age, gender, activityLevel } = input;

  // Validate inputs
  if (weight <= 0 || height <= 0 || age <= 0) {
    throw new Error("Weight, height, and age must be positive numbers");
  }

  if (age > 120) {
    throw new Error("Age must be less than 120 years");
  }

  if (weight > 500) {
    throw new Error("Weight must be less than 500 kg");
  }

  if (height > 300) {
    throw new Error("Height must be less than 300 cm");
  }

  const bmr = calculateBMR(weight, height, age, gender);
  const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  const tdee = bmr * activityMultiplier;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    activityMultiplier,
  };
}

/**
 * Calculate recommended calorie intake for weight goals
 */
export function calculateCalorieGoal(
  tdee: number,
  goal: "lose" | "maintain" | "gain",
  rate: "slow" | "moderate" | "fast" = "moderate",
): number {
  if (goal === "maintain") {
    return tdee;
  }

  // Calorie deficit/surplus per week for weight change
  // 1 kg fat ≈ 7700 calories
  const deficitMap = {
    slow: 250, // ~0.25 kg/week
    moderate: 500, // ~0.5 kg/week
    fast: 750, // ~0.75 kg/week
  };

  const dailyAdjustment = deficitMap[rate];

  if (goal === "lose") {
    return Math.round(tdee - dailyAdjustment);
  } else {
    return Math.round(tdee + dailyAdjustment);
  }
}

/**
 * Calculate macronutrient distribution based on goal and calories
 * Returns grams of protein, carbs, and fat
 */
export function calculateMacros(
  weight: number, // kg
  goalCalories: number,
  goal: "lose" | "maintain" | "gain",
): { proteinG: number; carbsG: number; fatG: number } {
  // Protein: 2.2g/kg for bulking, 2.5g/kg for cutting
  const proteinMultiplier = goal === "gain" ? 2.2 : 2.5;
  const proteinG = Math.round(weight * proteinMultiplier);
  const proteinCalories = proteinG * 4; // 4 cal/g

  // Fat: 25-30% of total calories
  const fatPercentage = goal === "lose" ? 0.3 : 0.25;
  const fatCalories = Math.round(goalCalories * fatPercentage);
  const fatG = Math.round(fatCalories / 9); // 9 cal/g

  // Carbs: remaining calories
  const remainingCalories = goalCalories - proteinCalories - fatCalories;
  const carbsG = Math.round(remainingCalories / 4); // 4 cal/g

  return {
    proteinG,
    carbsG: Math.max(0, carbsG), // Ensure non-negative
    fatG,
  };
}

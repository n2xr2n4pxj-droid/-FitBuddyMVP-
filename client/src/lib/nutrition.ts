/**
 * Nutrition utility functions and data
 * 
 * Contains standard nutrition values and calculation helpers
 */

export type BaseNutrients = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/**
 * 標準值庫（硬編碼準確值）
 * 這些是常見食物的標準營養值（每 100g）
 */
export const STANDARD_VALUES: Record<string, BaseNutrients> = {
  // ===== 肉類 =====
  'chicken breast': {
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  },
  'beef': {
    calories: 250,
    protein: 26,
    carbs: 0,
    fat: 15,
  },
  'ground beef': {
    calories: 250,
    protein: 26,
    carbs: 0,
    fat: 15,
  },
  'pork': {
    calories: 242,
    protein: 27,
    carbs: 0,
    fat: 14,
  },
  'salmon': {
    calories: 208,
    protein: 20,
    carbs: 0,
    fat: 13,
  },
  'tuna': {
    calories: 144,
    protein: 23,
    carbs: 0,
    fat: 6,
  },
  
  // ===== 碳水化合物 =====
  'white rice': {
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
  },
  'brown rice': {
    calories: 112,
    protein: 2.6,
    carbs: 24,
    fat: 0.9,
  },
  'pasta': {
    calories: 131,
    protein: 5,
    carbs: 25,
    fat: 1.1,
  },
  'bread': {
    calories: 265,
    protein: 9,
    carbs: 49,
    fat: 3.2,
  },
  'oats': {
    calories: 389,
    protein: 17,
    carbs: 66,
    fat: 7,
  },
  'quinoa': {
    calories: 120,
    protein: 4.4,
    carbs: 21,
    fat: 1.9,
  },
  
  // ===== 蔬菜 =====
  'broccoli': {
    calories: 34,
    protein: 2.8,
    carbs: 7,
    fat: 0.4,
  },
  'spinach': {
    calories: 23,
    protein: 2.9,
    carbs: 3.6,
    fat: 0.4,
  },
  'carrot': {
    calories: 41,
    protein: 0.9,
    carbs: 10,
    fat: 0.2,
  },
  'tomato': {
    calories: 18,
    protein: 0.9,
    carbs: 3.9,
    fat: 0.2,
  },
  
  // ===== 水果 =====
  'banana': {
    calories: 89,
    protein: 1.1,
    carbs: 23,
    fat: 0.3,
  },
  'apple': {
    calories: 52,
    protein: 0.3,
    carbs: 14,
    fat: 0.2,
  },
  'orange': {
    calories: 47,
    protein: 0.9,
    carbs: 12,
    fat: 0.1,
  },
  
  // ===== 乳製品 =====
  'milk': {
    calories: 61,
    protein: 3.2,
    carbs: 4.8,
    fat: 3.3,
  },
  'greek yogurt': {
    calories: 59,
    protein: 10,
    carbs: 3.6,
    fat: 0.4,
  },
  'cheese': {
    calories: 402,
    protein: 25,
    carbs: 1.3,
    fat: 33,
  },
  
  // ===== 其他 =====
  'egg': {
    calories: 155,
    protein: 13,
    carbs: 1.1,
    fat: 11,
  },
  'peanut butter': {
    calories: 588,
    protein: 25,
    carbs: 20,
    fat: 50,
  },
  'almond': {
    calories: 579,
    protein: 21,
    carbs: 22,
    fat: 50,
  },
};

/**
 * 獲取食物的標準值
 * @param description 食物描述（會轉換為小寫進行匹配）
 * @returns 標準值對象，如果不存在則返回 null
 */
export function getStandardValues(description: string): BaseNutrients | null {
  const key = description.toLowerCase();
  return STANDARD_VALUES[key] || null;
}

// 向後兼容：保留舊函數名
export const getUSDAStandardValues = getStandardValues;
export const USDA_STANDARD_VALUES = STANDARD_VALUES;

/**
 * 標準化營養成分到 100g/ml
 * @param nutrients 營養成分對象
 * @param servingSize 當前份量
 * @returns 標準化後的營養成分（每 100g/ml）
 */
export function normalizeTo100g(nutrients: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}, servingSize: number): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  if (servingSize === 100) {
    return nutrients;
  }
  
  const ratio = 100 / servingSize;
  return {
    calories: nutrients.calories * ratio,
    protein: nutrients.protein * ratio,
    carbs: nutrients.carbs * ratio,
    fat: nutrients.fat * ratio,
  };
}

/**
 * 根據用戶份量計算營養成分
 * @param nutrientsPer100 每 100g/ml 的營養成分
 * @param userAmount 用戶實際食用份量
 * @returns 計算後的營養成分
 */
export function calculateNutrientsForAmount(
  nutrientsPer100: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  },
  userAmount: number
): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  const ratio = userAmount / 100;
  return {
    calories: nutrientsPer100.calories * ratio,
    protein: nutrientsPer100.protein * ratio,
    carbs: nutrientsPer100.carbs * ratio,
    fat: nutrientsPer100.fat * ratio,
  };
}

/**
 * 根據基礎份量與使用者實際食用份量，計算每 100g/ml 及實際份量的營養值
 *
 * @param baseServingSize  基礎份量（例如 100g、284g 等）
 * @param baseNutrients    對應 baseServingSize 的營養數值
 * @param userAmount       使用者實際食用份量（以「同一單位」計，如 g 或 ml）
 */
export function calculateNutrientsForServing(
  baseServingSize: number,
  baseNutrients: BaseNutrients,
  userAmount: number
) {
  if (!baseServingSize || baseServingSize === 0) {
    throw new Error("baseServingSize must be > 0");
  }
  // 先標準化到每 100 單位
  const per100 = {
    calories: (baseNutrients.calories / baseServingSize) * 100,
    protein: (baseNutrients.protein / baseServingSize) * 100,
    carbs: (baseNutrients.carbs / baseServingSize) * 100,
    fat: (baseNutrients.fat / baseServingSize) * 100,
  };

  // 再根據使用者實際份量計算
  const ratio = userAmount / 100;
  const serving = {
    calories: per100.calories * ratio,
    protein: per100.protein * ratio,
    carbs: per100.carbs * ratio,
    fat: per100.fat * ratio,
  };

  return { per100, serving };
}


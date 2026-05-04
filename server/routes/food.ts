// server/routes/food.ts
// Open Food Facts API 集成

import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { sendError } from '../lib/response';
import { ErrorCodes } from '@shared/error-codes';

const router = Router();

// Open Food Facts API 搜索函數
export const searchFoods = async (query: string) => {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,nutriments,code,brands`
    );
    
    if (!response.ok) {
      console.error('[Open Food Facts API] Error:', response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.products || data.products.length === 0) {
      return [];
    }
    
    // 轉換為標準格式
    const foods = data.products
      .filter((product: any) => product.product_name && product.nutriments) // 過濾掉沒有營養數據的產品
      .slice(0, 10)
      .map((product: any) => {
        const nutriments = product.nutriments || {};
        
        // Open Food Facts 的營養數據可能以每100g或每份為單位
        // energy-kcal_100g 或 energy-kcal (每份)
        const calories = nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0;
        const protein = nutriments['proteins_100g'] || nutriments['proteins'] || 0;
        const carbs = nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || 0;
        const fat = nutriments['fat_100g'] || nutriments['fat'] || 0;
        
        // 統一響應格式
        return {
          fdcId: product.code || product.id, // 使用 Open Food Facts 產品代碼作為 ID
          description: product.product_name, // 產品名稱作為描述
          brandName: product.brands || null, // 品牌名稱
          servingSize: 100, // Open Food Facts 默認以 100g 為單位
          servingSizeUnit: 'g',
          calories: Math.round(calories * 10) / 10, // 保留一位小數
          protein: Math.round(protein * 10) / 10,
          carbs: Math.round(carbs * 10) / 10,
          fat: Math.round(fat * 10) / 10, // 統一使用 fat 而不是 fats
        };
      });
    
    return foods;
  } catch (error) {
    console.error('[Open Food Facts API] Search error:', error);
    return [];
  }
};

// 搜索食物端點（需要認證）
// 路徑: GET /api/food/search?query=...
router.get('/search', isAuthenticated, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return sendError(
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Query required and must be at least 2 characters'
      );
    }
    
    console.log(`[Open Food Facts API] Searching for: "${query}"`);
    const foods = await searchFoods(query.trim());
    console.log(`[Open Food Facts API] Found ${foods.length} foods`);
    
    // 返回數組格式
    res.json(foods);
  } catch (error: any) {
    console.error('[Open Food Facts API] Error:', error);
    return sendError(res, 500, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to search foods');
  }
});

export default router;

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertMealSchema, insertWorkoutSchema } from "@shared/schema";
import { format } from "date-fns";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.json(null);
      }

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user || null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Meal endpoints
  app.get("/api/meals/:date?", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dateParam = req.params.date || format(new Date(), "yyyy-MM-dd");
      const date = new Date(dateParam);
      
      const meals = await storage.getMealsByUserAndDate(userId, date);
      res.json(meals);
    } catch (error) {
      console.error("Error fetching meals:", error);
      res.status(500).json({ message: "Failed to fetch meals" });
    }
  });

  app.post("/api/meals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertMealSchema.parse(req.body);
      
      const meal = await storage.createMeal(userId, validated);
      res.status(201).json(meal);
    } catch (error: any) {
      console.error("Error creating meal:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ message: "Invalid meal data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create meal" });
      }
    }
  });

  // Workout endpoints
  app.get("/api/workouts/:date?", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dateParam = req.params.date || format(new Date(), "yyyy-MM-dd");
      const date = new Date(dateParam);
      
      const workouts = await storage.getWorkoutsByUserAndDate(userId, date);
      res.json(workouts);
    } catch (error) {
      console.error("Error fetching workouts:", error);
      res.status(500).json({ message: "Failed to fetch workouts" });
    }
  });

  app.post("/api/workouts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertWorkoutSchema.parse(req.body);
      
      const workout = await storage.createWorkout(userId, validated);
      res.status(201).json(workout);
    } catch (error: any) {
      console.error("Error creating workout:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ message: "Invalid workout data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create workout" });
      }
    }
  });

  // Summary endpoints
  app.get("/api/summary/daily/:date?", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const dateParam = req.params.date || format(new Date(), "yyyy-MM-dd");
      const date = new Date(dateParam);
      
      const summary = await storage.getDailySummary(userId, date);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching daily summary:", error);
      res.status(500).json({ message: "Failed to fetch daily summary" });
    }
  });

  app.get("/api/summary/weekly", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summary = await storage.getWeeklySummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching weekly summary:", error);
      res.status(500).json({ message: "Failed to fetch weekly summary" });
    }
  });

  // USDA Nutrition API proxy
  app.get("/api/nutrition/search/:query", isAuthenticated, async (req, res) => {
    try {
      const { query } = req.params;
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(query)}&pageSize=10`;

      const response = await fetch(url);
      
      if (!response.ok) {
        console.error("USDA API error:", response.statusText);
        return res.status(response.status).json({ message: "Failed to search foods" });
      }

      const data = await response.json();
      
      // Transform USDA results to our format
      const foods = (data.foods || []).map((food: any) => {
        const nutrients = food.foodNutrients || [];
        
        // Find specific nutrients by nutrient ID
        const getNutrient = (nutrientId: number) => {
          const nutrient = nutrients.find((n: any) => n.nutrientId === nutrientId);
          return nutrient ? nutrient.value : undefined;
        };

        return {
          fdcId: food.fdcId,
          description: food.description,
          brandName: food.brandName,
          servingSize: food.servingSize,
          servingSizeUnit: food.servingSizeUnit,
          calories: getNutrient(1008), // Energy (kcal)
          protein: getNutrient(1003), // Protein
          carbs: getNutrient(1005), // Carbohydrates
          fat: getNutrient(1004), // Total fat
        };
      });

      res.json(foods);
    } catch (error) {
      console.error("Error searching nutrition:", error);
      res.status(500).json({ message: "Failed to search foods" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

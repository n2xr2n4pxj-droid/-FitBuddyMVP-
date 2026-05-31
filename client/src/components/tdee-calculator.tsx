import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TDEEResults {
  bmr: number;
  tdee: number;
  activityMultiplier: number;
  goalCalories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

export default function TDEECalculator() {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [activityLevel, setActivityLevel] = useState<string>("moderately_active");
  const [goal, setGoal] = useState<"lose" | "maintain" | "gain">("maintain");
  const [rate, setRate] = useState<"slow" | "moderate" | "fast">("moderate");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TDEEResults | null>(null);
  const { toast } = useToast();

  const calculateMacros = (tdee: number, goal: "lose" | "maintain" | "gain", rate: "slow" | "moderate" | "fast", weightKg: number) => {
    // Calculate goal calories based on goal and rate
    const deficitMap = {
      slow: 250,
      moderate: 500,
      fast: 750,
    };

    let goalCalories = tdee;
    if (goal === "lose") {
      goalCalories = tdee - deficitMap[rate];
    } else if (goal === "gain") {
      goalCalories = tdee + deficitMap[rate];
    }

    // Calculate macros
    // Protein: 2g per kg body weight
    const protein = Math.round(weightKg * 2);
    
    // Fat: 25% of total calories
    const fatCalories = goalCalories * 0.25;
    const fat = Math.round(fatCalories / 9); // 9 calories per gram of fat
    
    // Carbs: remaining calories
    const proteinCalories = protein * 4; // 4 calories per gram of protein
    const carbCalories = goalCalories - proteinCalories - fatCalories;
    const carbs = Math.round(carbCalories / 4); // 4 calories per gram of carbs

    return {
      goalCalories: Math.round(goalCalories),
      macros: {
        protein,
        carbs: Math.max(0, carbs),
        fat,
      },
    };
  };

  const calculateTDEE = async () => {
    if (!weight || !height || !age) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest("POST", "/api/tdee/calculate", {
        weight: parseFloat(weight),
        height: parseFloat(height),
        age: parseInt(age),
        gender,
        activityLevel,
      });
      
      // Calculate macros directly
      const macroData = calculateMacros(data.tdee, goal, rate, parseFloat(weight));
      
      setResults({
        bmr: data.bmr,
        tdee: data.tdee,
        activityMultiplier: data.activityMultiplier,
        ...macroData,
      });

      toast({
        title: "TDEE Calculated",
        description: "Your daily calorie needs have been calculated successfully",
      });
    } catch (error) {
      console.error("Error calculating TDEE:", error);
      toast({
        title: "Calculation failed",
        description: "Failed to calculate TDEE. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveToProfile = async () => {
    if (!results) return;

    try {
      await apiRequest("PUT", "/api/user/tdee", {
        gender,
        age: parseInt(age),
        heightCm: parseFloat(height),
        currentWeightKg: parseFloat(weight),
        activityLevel,
        bmr: results.bmr,
        tdee: results.tdee,
        goalCalories: results.goalCalories,
        proteinG: results.macros.protein,
        carbsG: results.macros.carbs,
        fatG: results.macros.fat,
      });

      toast({
        title: "Profile updated",
        description: "Your TDEE data has been saved to your profile",
      });
    } catch (error) {
      console.error("Error saving TDEE:", error);
      toast({
        title: "Save failed",
        description: "Failed to save TDEE to profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>TDEE Calculator</CardTitle>
          <CardDescription>
            Calculate your Total Daily Energy Expenditure and recommended macros
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="70"
                data-testid="input-weight"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="height">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                step="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="175"
                data-testid="input-height"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="30"
                data-testid="input-age"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={(value: "male" | "female") => setGender(value)}>
                <SelectTrigger id="gender" data-testid="select-gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity">Activity Level</Label>
              <Select value={activityLevel} onValueChange={setActivityLevel}>
                <SelectTrigger id="activity" data-testid="select-activity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary (little or no exercise)</SelectItem>
                  <SelectItem value="lightly_active">Lightly Active (1-3 days/week)</SelectItem>
                  <SelectItem value="moderately_active">Moderately Active (3-5 days/week)</SelectItem>
                  <SelectItem value="very_active">Very Active (6-7 days/week)</SelectItem>
                  <SelectItem value="extra_active">Extra Active (physical job + exercise)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal">Goal</Label>
              <Select value={goal} onValueChange={(value: "lose" | "maintain" | "gain") => setGoal(value)}>
                <SelectTrigger id="goal" data-testid="select-goal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lose">Lose Weight</SelectItem>
                  <SelectItem value="maintain">Maintain Weight</SelectItem>
                  <SelectItem value="gain">Gain Weight</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {goal !== "maintain" && (
              <div className="space-y-2">
                <Label htmlFor="rate">Rate</Label>
                <Select value={rate} onValueChange={(value: "slow" | "moderate" | "fast") => setRate(value)}>
                  <SelectTrigger id="rate" data-testid="select-rate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">Slow (~0.25 kg/week)</SelectItem>
                    <SelectItem value="moderate">Moderate (~0.5 kg/week)</SelectItem>
                    <SelectItem value="fast">Fast (~0.75 kg/week)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button
            onClick={calculateTDEE}
            disabled={loading}
            className="w-full"
            data-testid="button-calculate"
          >
            {loading ? "Calculating..." : "Calculate TDEE"}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Your personalized nutrition targets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Basal Metabolic Rate (BMR)</p>
                <p className="text-2xl font-bold" data-testid="text-bmr">{results.bmr} kcal/day</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Daily Energy Expenditure (TDEE)</p>
                <p className="text-2xl font-bold" data-testid="text-tdee">{results.tdee} kcal/day</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Goal Calories</p>
                <p className="text-2xl font-bold" data-testid="text-goal-calories">{results.goalCalories} kcal/day</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Activity Multiplier</p>
                <p className="text-2xl font-bold">{results.activityMultiplier}x</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-lg font-semibold mb-2">Recommended Macros</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Protein</p>
                  <p className="text-xl font-bold" data-testid="text-protein">{results.macros.protein}g</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Carbs</p>
                  <p className="text-xl font-bold" data-testid="text-carbs">{results.macros.carbs}g</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Fat</p>
                  <p className="text-xl font-bold" data-testid="text-fat">{results.macros.fat}g</p>
                </div>
              </div>
            </div>

            <Button
              onClick={saveToProfile}
              className="w-full"
              data-testid="button-save-profile"
            >
              Save to Profile
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

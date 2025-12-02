import { useState, useEffect } from "react";
import { useTDEEProfile, useCalculateTDEE } from "@/hooks/use-tdee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Target, TrendingUp, User } from "lucide-react";

export default function Profile() {
  const { data: profile, isLoading } = useTDEEProfile();
  const calculateTDEE = useCalculateTDEE();

  // Form state
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [activityLevel, setActivityLevel] = useState<string>("");
  const [goal, setGoal] = useState<string>("");

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setAge(profile.age?.toString() || "");
      setGender(profile.gender || "");
      setHeight(profile.height?.toString() || "");
      setWeight(profile.weight?.toString() || "");
      setActivityLevel(profile.activityLevel || "");
      setGoal(profile.goal || "");
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!age || !gender || !height || !weight || !activityLevel || !goal) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await calculateTDEE.mutateAsync({
        age: parseInt(age),
        gender: gender as 'male' | 'female',
        height: parseFloat(height),
        weight: parseFloat(weight),
        activityLevel: activityLevel as 'sedentary' | 'light' | 'moderate' | 'heavy' | 'athlete',
        goal: goal as 'extreme_loss' | 'weight_loss' | 'mild_loss' | 'maintain' | 'mild_gain' | 'weight_gain' | 'extreme_gain',
      });

      alert("TDEE calculated successfully!");
    } catch (error) {
      alert("Failed to calculate TDEE");
    }
  };

  const hasResults = profile?.tdee !== null && profile?.tdee !== undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Profile & TDEE Calculator</h1>

        <div className="grid gap-6">
          {/* TDEE Calculator Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Age */}
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="e.g., 25"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      required
                    />
                  </div>

                  {/* Gender */}
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={gender} onValueChange={setGender} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Height */}
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 175"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      required
                    />
                  </div>

                  {/* Weight */}
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 70"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Activity Level */}
                <div className="space-y-2">
                  <Label htmlFor="activity">Activity Level</Label>
                  <Select value={activityLevel} onValueChange={setActivityLevel} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your activity level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">
                        <div>
                          <div className="font-medium">Sedentary</div>
                          <div className="text-sm text-gray-500">Little or no exercise</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="light">
                        <div>
                          <div className="font-medium">Light Exercise</div>
                          <div className="text-sm text-gray-500">Exercise 1-3 times/week</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="moderate">
                        <div>
                          <div className="font-medium">Moderate Exercise</div>
                          <div className="text-sm text-gray-500">Exercise 4-5 times/week</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="heavy">
                        <div>
                          <div className="font-medium">Heavy Exercise</div>
                          <div className="text-sm text-gray-500">Daily exercise or intense 3-4 times/week</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="athlete">
                        <div>
                          <div className="font-medium">Athlete</div>
                          <div className="text-sm text-gray-500">Intense exercise 6-7 times/week</div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Goal */}
                <div className="space-y-2">
                  <Label htmlFor="goal">Goal</Label>
                  <Select value={goal} onValueChange={setGoal} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="extreme_loss">
                        <div>
                          <div className="font-medium">Extreme Weight Loss</div>
                          <div className="text-sm text-gray-500">-1000 cal/day (2 lbs/week)</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="weight_loss">
                        <div>
                          <div className="font-medium">Weight Loss</div>
                          <div className="text-sm text-gray-500">-500 cal/day (1 lb/week)</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="mild_loss">
                        <div>
                          <div className="font-medium">Mild Weight Loss</div>
                          <div className="text-sm text-gray-500">-250 cal/day (0.5 lb/week)</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="maintain">
                        <div>
                          <div className="font-medium">Maintain Weight</div>
                          <div className="text-sm text-gray-500">0 cal/day</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="mild_gain">
                        <div>
                          <div className="font-medium">Mild Weight Gain</div>
                          <div className="text-sm text-gray-500">+250 cal/day (0.5 lb/week)</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="weight_gain">
                        <div>
                          <div className="font-medium">Weight Gain</div>
                          <div className="text-sm text-gray-500">+500 cal/day (1 lb/week)</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="extreme_gain">
                        <div>
                          <div className="font-medium">Extreme Weight Gain</div>
                          <div className="text-sm text-gray-500">+1000 cal/day (2 lbs/week)</div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={calculateTDEE.isPending}
                >
                  {calculateTDEE.isPending ? "Calculating..." : "Calculate TDEE"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results */}
          {hasResults && (
            <>
              {/* Key Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Your Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="text-sm text-gray-600">BMR</div>
                      <div className="text-2xl font-bold text-gray-900">{Math.round(profile?.bmr || 0)}</div>
                      <div className="text-xs text-gray-500">cal/day</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-sm text-gray-600">TDEE</div>
                      <div className="text-2xl font-bold text-gray-900">{Math.round(profile?.tdee || 0)}</div>
                      <div className="text-xs text-gray-500">cal/day</div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="text-sm text-gray-600">BMI</div>
                      <div className="text-2xl font-bold text-gray-900">{profile?.bmi?.toFixed(1) || 0}</div>
                      <div className="text-xs text-gray-500">kg/m²</div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <div className="text-sm text-gray-600">Target</div>
                      <div className="text-2xl font-bold text-gray-900">{Math.round(profile?.targetCalories || 0)}</div>
                      <div className="text-xs text-gray-500">cal/day</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Macros */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Daily Macro Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Protein</span>
                        <span className="text-xs text-gray-500">{profile?.proteinRatio?.toFixed(0)}%</span>
                      </div>
                      <div className="text-3xl font-bold text-red-600">{Math.round(profile?.targetProtein || 0)}g</div>
                      <div className="text-xs text-gray-500 mt-1">4 cal/gram</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Carbs</span>
                        <span className="text-xs text-gray-500">{profile?.carbsRatio?.toFixed(0)}%</span>
                      </div>
                      <div className="text-3xl font-bold text-yellow-600">{Math.round(profile?.targetCarbs || 0)}g</div>
                      <div className="text-xs text-gray-500 mt-1">4 cal/gram</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Fat</span>
                        <span className="text-xs text-gray-500">{profile?.fatRatio?.toFixed(0)}%</span>
                      </div>
                      <div className="text-3xl font-bold text-green-600">{Math.round(profile?.targetFat || 0)}g</div>
                      <div className="text-xs text-gray-500 mt-1">9 cal/gram</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
    </div>
  );
}


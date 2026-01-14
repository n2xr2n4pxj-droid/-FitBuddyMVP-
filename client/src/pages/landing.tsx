import { Button } from "@/components/ui/button";
import { Activity, Utensils, TrendingUp, Users } from "lucide-react";
import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero Section */}
      <div className="relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
                Track Your Fitness Journey with{" "}
                <span className="text-emerald-500">FitBuddy</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto">
                Log meals, track workouts, and visualize your progress with smart nutrition insights powered by Open Food Facts
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-base px-8 py-6"
                onClick={() => setLocation("/register")}
                data-testid="button-get-started"
              >
                新用戶？免費註冊
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto text-base px-8 py-6 border-gray-700 hover:border-white/40 bg-transparent hover:bg-white/5 text-white"
                onClick={() => setLocation("/login")}
                data-testid="button-login"
              >
                已有帳號？登入
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<Utensils className="w-8 h-8 text-emerald-500" />}
              title="Meal Tracking"
              description="Log your meals with automatic nutrition lookup from food database"
            />
            <FeatureCard
              icon={<Activity className="w-8 h-8 text-emerald-500" />}
              title="Workout Logging"
              description="Track your exercises, duration, and stay consistent with your routine"
            />
            <FeatureCard
              icon={<TrendingUp className="w-8 h-8 text-emerald-500" />}
              title="Progress Charts"
              description="Visualize your calorie intake and workout trends over 7 days"
            />
            <FeatureCard
              icon={<Users className="w-8 h-8 text-emerald-500" />}
              title="Ready to Grow"
              description="Built for future social features and coach monitoring"
            />
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-slate-900/50 py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-white">
            How FitBuddy Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              step="1"
              title="Log Your Meals"
              description="Search for foods using the food database or enter nutrition manually. Track breakfast, lunch, dinner, and snacks."
            />
            <StepCard
              step="2"
              title="Record Workouts"
              description="Log your workout type, duration, and optional notes. Build a consistent exercise habit."
            />
            <StepCard
              step="3"
              title="Track Progress"
              description="View daily summaries and 7-day trend charts for calories and workout minutes. Stay motivated!"
            />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Ready to Start Your Fitness Journey?
          </h2>
          <p className="text-xl text-gray-400">
            Join FitBuddy today and take control of your health and fitness goals
          </p>
          <Button
            size="lg"
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-base px-8 py-6"
            onClick={() => setLocation("/register")}
            data-testid="button-cta-start"
          >
            立即開始
          </Button>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-lg border border-gray-700 bg-slate-900/50 hover:bg-slate-900/70 transition-colors" data-testid={`feature-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="space-y-4">
        <div className="w-16 h-16 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="text-center space-y-4" data-testid={`step-card-${step}`}>
      <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center text-2xl font-bold mx-auto">
        {step}
      </div>
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

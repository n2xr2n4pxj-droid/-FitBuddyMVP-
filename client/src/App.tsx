import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import TDEECalculator from "@/components/tdee-calculator";
import AuthPage from "@/pages/auth";
import Profile from "@/pages/profile";
import History from "@/pages/history";
import Trends from "@/pages/trends";
import Layout from "@/components/layout";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // While loading auth status, show loading page
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
  return (
    <Switch>
        <Route path="/" component={Landing} />
          <Route path="/login" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/tdee" component={TDEECalculator} />
        <Route path="/profile" component={Profile} />
        <Route path="/history" component={History} />
        <Route path="/trends" component={Trends} />
        <Route path="/" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

import { Link, useLocation } from "wouter";
import { Home, History, TrendingUp, User, LogOut } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "History", href: "/history", icon: History },
  { name: "Trends", href: "/trends", icon: TrendingUp },
  { name: "Profile & TDEE", href: "/profile", icon: User },
];

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { logout: authLogout } = useAuth();
  const { toast } = useToast();

  const logout = async () => {
    try {
      // 使用 auth store 的 logout 方法
      // 這會清除 token、用戶狀態和 React Query 緩存
      authLogout();
      
      // 顯示成功提示
      toast({
        title: "已登出",
        description: "您已成功登出",
      });
      
      // 延遲重定向以確保狀態已清除
      setTimeout(() => {
        setLocation("/login");
      }, 100);
    } catch (error) {
      console.error("Logout failed:", error);
      toast({
        title: "登出失敗",
        description: "無法完成登出，請稍後再試",
        variant: "destructive",
      });
    }
  };

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-teal-600 dark:text-teal-400">
          FitBuddy
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Track Your Fitness
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-teal-100 dark:bg-teal-900 text-teal-900 dark:text-teal-100"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}


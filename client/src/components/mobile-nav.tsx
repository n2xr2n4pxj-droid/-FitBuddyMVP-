import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  User, 
  History, 
  TrendingUp 
} from "lucide-react";

const navItems = [
  {
    href: "/",
    icon: <LayoutDashboard className="h-6 w-6" />,
    label: "Dashboard",
  },
  {
    href: "/history",
    icon: <History className="h-6 w-6" />,
    label: "History",
  },
  {
    href: "/trends",
    icon: <TrendingUp className="h-6 w-6" />,
    label: "Trends",
  },
  {
    href: "/profile",
    icon: <User className="h-6 w-6" />,
    label: "Profile",
  },
];

export default function MobileNav() {
  const [location] = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-50">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location === item.href;
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`
                flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors
                ${
                  isActive
                    ? "text-primary"
                    : "text-gray-600"
                }
              `}
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

